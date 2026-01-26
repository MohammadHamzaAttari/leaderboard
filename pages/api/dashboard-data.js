import { MongoClient } from 'mongodb';
import { checkAndApplyRollover } from '../../lib/rollover';

// --- Configuration ---
const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = "dwits";

// --- Database Connection Cache ---
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  if (!MONGO_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside your .env.local file.');
  }

  const client = new MongoClient(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    retryWrites: true,
    retryReads: true,
    maxPoolSize: 10,
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    cachedClient = client;
    cachedDb = db;
    return { client, db };
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

// --- API Handler Function ---
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { month } = req.body;

  if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: 'Invalid or missing month parameter. Expected format YYYY-MM.' });
  }

  try {
    const { db } = await connectToDatabase();

    // --- Auto-Rollover Check ---
    await checkAndApplyRollover(db, month);

    // --- Default Bonus Data ---
    const defaultBonuses = {
      teamBonus: {
        amount: 1500,
        target: 100,
        currentSales: 0,
        isUnlocked: false,
        progress: 0,
        remaining: 100,
        status: 'LOCKED'
      },
      firstTo20: {
        amount: 1000,
        target: 20,
        claimed: false,
        winner: null,
        closestAgent: null
      }
    };

    // --- Fetch Leaderboard Data ---
    const leaderboard = await db.collection('leader_board')
      .find({ month: month })
      .project({ _id: 0 })
      .sort({ Rank: 1 })
      .toArray();

    if (!leaderboard || leaderboard.length === 0) {
      return res.status(404).json({
        message: `No leaderboard data found for the month: ${month}`,
        leaderboard: [],
        team: { totalSales: 0, target: 100, totalSalesAbove10: 0 },
        bonuses: defaultBonuses
      });
    }

    // --- Fetch Active Agents for Validation & Name Lookup ---
    const activeAgents = await db.collection('agent').find({}, { projection: { ghl_user_id: 1, name: 1 } }).toArray();
    
    // Create maps for quick lookup
    const activeAgentIds = new Set(activeAgents.map(a => a.ghl_user_id).filter(id => id && id.trim() !== ''));
    const agentNameMap = {};
    activeAgents.forEach(a => {
      if(a.ghl_user_id) agentNameMap[a.ghl_user_id] = a.name;
    });

    // --- Filter Leaderboard Data ---
    const validLeaderboard = leaderboard.filter(agent => {
      if (!agent.userIdMonthId) return false;
      const userId = agent.userIdMonthId.split('_')[0];
      return activeAgentIds.has(userId);
    });

    if (!validLeaderboard || validLeaderboard.length === 0) {
      return res.status(200).json({
        message: `No active agent data found for the month: ${month}`,
        leaderboard: [],
        team: { totalSales: 0, target: 100, totalSalesAbove10: 0 },
        bonuses: defaultBonuses
      });
    }

    // --- Fetch Team Data ---
    const firstLeaderboardItem = validLeaderboard[0];
    const monthId = firstLeaderboardItem?.monthId ? parseInt(firstLeaderboardItem.monthId) : null;

    let teamDataFromDb = { 
      total_sales_month: 0,
      team_unlock_condition_met: false,
      first_to_20_winner_id: null,
      first_to_20_winner_name: null,
      first_to_20_claimed_at: null
    };

    if (monthId !== null && !isNaN(monthId)) {
      const teamDoc = await db.collection('team')
        .findOne(
          { month_id: String(monthId) },
          { projection: { _id: 0 } }
        );
      if (teamDoc) {
        teamDataFromDb = teamDoc;
      }
    }

    // --- Transform Leaderboard Data ---
    const transformedLeaderboard = validLeaderboard.map(item => {
      // ✅ FIX 1: Check both (£) and (€) keys for the bonus
      const firstTo20Val = 
        parseFloat(item['First to 20 Bonus (£)']) || 
        parseFloat(item['First to 20 Bonus (€)']) || 
        0;

      return {
        rank: parseInt(item.Rank) || 0,
        name: String(item['Agent Name'] || 'Unknown'),
        sales: parseInt(item.Sales) || 0,
        above_10: parseInt(item['Above 10']) || 0,
        commission: parseFloat(item['Commission (£)']) || 0,
        
        // This is the Speed Bonus (£50)
        bonus: parseFloat(item['Bonus (£)']) || 0, 
        
        commissionEarned: parseFloat(item['Earned (£)']) || 0,
        earnedDetails: item.earnedDetails || [],
        
        // First to 20 Data
        isFirstTo20Winner: item.is_first_to_20_winner || false,
        firstTo20Bonus: firstTo20Val,

        commission_property_pair: (() => {
          let mainList = item.commission_property_pair || [];
          if (typeof mainList === 'string') {
            try { mainList = JSON.parse(mainList); } catch (e) { mainList = []; }
          }
          if (!Array.isArray(mainList)) mainList = [];

          let rolloverList = item.rollover_commission_list || [];
          if (typeof rolloverList === 'string') {
            try { rolloverList = JSON.parse(rolloverList); } catch (e) { rolloverList = []; }
          }
          if (!Array.isArray(rolloverList)) rolloverList = [];

          const combined = [...mainList];
          const existingKeys = new Set(combined.map(p => `${(p.propertyCode || '').toLowerCase()}_${p.sourceMonth || ''}`));

          for (const rItem of rolloverList) {
            const key = `${(rItem.propertyCode || '').toLowerCase()}_${rItem.sourceMonth || ''}`;
            if (!existingKeys.has(key)) {
              combined.push(rItem);
              existingKeys.add(key);
            }
          }
          return combined;
        })(),
        propertyCode: item.propertyCode || null,
        userIdMonthId: item.userIdMonthId || null,
      };
    });

    // --- Calculate Team Totals ---
    const totalTeamSales = teamDataFromDb.total_sales_month || 
      transformedLeaderboard.reduce((sum, agent) => sum + agent.sales, 0);

    // --- Transform Team Data ---
    const transformedTeam = {
      totalSales: totalTeamSales,
      target: 100,
      totalSalesAbove10: transformedLeaderboard.filter(agent => agent.above_10 > 0).length
    };

    // ============================================
    // 🎯 BONUS CALCULATIONS
    // ============================================

    // TEAM BONUS POT
    const isTeamBonusUnlocked = totalTeamSales >= 100;
    const teamBonusProgress = Math.min((totalTeamSales / 100) * 100, 100);
    
    const teamBonus = {
      amount: 1500,
      target: 100,
      currentSales: totalTeamSales,
      isUnlocked: isTeamBonusUnlocked,
      progress: Math.round(teamBonusProgress * 10) / 10,
      remaining: Math.max(100 - totalTeamSales, 0),
      status: isTeamBonusUnlocked ? 'UNLOCKED' : 'LOCKED'
    };

    // FIRST TO 20 BONUS
    let firstTo20 = {
      amount: 1000,
      target: 20,
      claimed: false,
      winner: null,
      closestAgent: null
    };

    if (teamDataFromDb.first_to_20_winner_id) {
      firstTo20.claimed = true;
      
      // ✅ FIX 2: If name is missing/Unknown in DB, look it up from activeAgents
      let winnerName = teamDataFromDb.first_to_20_winner_name;
      if (!winnerName || winnerName === 'Unknown') {
        winnerName = agentNameMap[teamDataFromDb.first_to_20_winner_id] || 'Unknown';
      }

      firstTo20.winner = {
        id: teamDataFromDb.first_to_20_winner_id,
        name: winnerName,
        claimedAt: teamDataFromDb.first_to_20_claimed_at
      };
    } else {
      // Check leaderboard if team DB failed but leaderboard has flag
      const leaderboardWinner = transformedLeaderboard.find(a => a.isFirstTo20Winner);
      if (leaderboardWinner) {
        firstTo20.claimed = true;
        firstTo20.winner = {
            id: null,
            name: leaderboardWinner.name,
            claimedAt: null
        };
      } else {
        // Find closest agent
        const underTwenty = transformedLeaderboard
            .filter(a => a.sales > 0 && a.sales < 20)
            .sort((a, b) => b.sales - a.sales);
        
        if (underTwenty.length > 0) {
            firstTo20.closestAgent = {
            name: underTwenty[0].name,
            sales: underTwenty[0].sales,
            remaining: 20 - underTwenty[0].sales
            };
        }
      }
    }

    const bonuses = {
      teamBonus,
      firstTo20
    };

    res.status(200).json({
      leaderboard: transformedLeaderboard,
      team: transformedTeam,
      bonuses: bonuses
    });

  } catch (error) {
    console.error('Dashboard API Error:', error);
    res.status(500).json({
      message: 'Failed to retrieve dashboard data.',
      error: error.message || 'An unknown server error occurred.',
    });
  }
}