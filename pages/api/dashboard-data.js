import { MongoClient } from 'mongodb';

// --- Configuration ---
// IMPORTANT: Ensure MONGODB_URI is set in your .env.local file
// Example: MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<db-name>?retryWrites=true&w=majority
const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = "dwits"; // Replace with your actual database name if different

// --- Database Connection Cache ---
// This prevents establishing a new connection on every request, improving performance.
let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  // If we already have a cached client and DB, return them
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  // Check if the MongoDB URI is defined
  if (!MONGO_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside your .env.local file.');
  }

  // Connect to MongoDB
  const client = new MongoClient(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000, // Timeout for selecting a server
    socketTimeoutMS: 45000,       // Timeout for socket operations
    family: 4,                    // Force IPv4 connection for compatibility
    retryWrites: true,              // Enable write retryable operations
    retryReads: true,             // Enable read retryable operations
    maxPoolSize: 10,              // Max number of connections in the pool
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // Cache the client and DB for future requests
    cachedClient = client;
    cachedDb = db;

    return { client, db };
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

// --- Auto-Rollover Helper Functions ---
import { checkAndApplyRollover } from '../../lib/rollover';
// --- API Handler Function ---
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Get the selected month from the request body
  const { month } = req.body;

  // Validate month input
  if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: 'Invalid or missing month parameter. Expected format YYYY-MM.' });
  }

  try {
    const { db } = await connectToDatabase(); // Get database connection

    // --- Auto-Rollover Check ---
    // Check if rollover needs to be applied for this month
    const rolloverApplied = await checkAndApplyRollover(db, month);
    if (rolloverApplied) {
      console.log(`[Auto-Rollover] Applied for month: ${month}`);
    }

    // --- Fetch Leaderboard Data ---
    // Fetch records for the specified month from the 'leader_board' collection
    const leaderboard = await db.collection('leader_board')
      .find({ month: month }) // Filter by the requested month
      .project({ _id: 0 })     // Exclude the default _id field from results
      .sort({ Rank: 1 })       // Sort results by Rank in ascending order
      .toArray();              // Convert cursor to an array

    // If no data is found for the month, return a 404 response
    if (!leaderboard || leaderboard.length === 0) {
      return res.status(404).json({
        message: `No leaderboard data found for the month: ${month}`,
        leaderboard: [], // Return empty array for consistency
        team: { totalSales: 0, target: 100, totalSalesAbove10: 0 } // Default team data
      });
    }

    // --- Fetch Active Agents for Validation ---
    // We only want to display agents that currently exist in the 'agent' collection.
    // This filters out "zombie" records for deleted employees or duplicates.
    const activeAgents = await db.collection('agent').find({}, { projection: { ghl_user_id: 1 } }).toArray();
    const activeAgentIds = new Set(activeAgents.map(a => a.ghl_user_id).filter(id => id && id.trim() !== ''));

    // --- Filter Leaderboard Data ---
    const validLeaderboard = leaderboard.filter(agent => {
      if (!agent.userIdMonthId) return false; // Hide records without proper ID linkage
      const userId = agent.userIdMonthId.split('_')[0];
      return activeAgentIds.has(userId);
    });

    // If no data is found for the month after filtering
    if (!validLeaderboard || validLeaderboard.length === 0) {
      return res.status(200).json({ // Return 200 with empty list instead of 404 to handle "everyone deleted" case gracefully
        message: `No active agent data found for the month: ${month}`,
        leaderboard: [],
        team: { totalSales: 0, target: 100, totalSalesAbove10: 0 }
      });
    }

    // --- Fetch Team Data ---
    // We need a month identifier to query the 'team' collection.
    // Assuming 'monthId' exists in the 'leader_board' documents.
    const firstLeaderboardItem = validLeaderboard[0];
    const monthId = firstLeaderboardItem?.monthId ? parseInt(firstLeaderboardItem.monthId) : null;

    let teamDataFromDb = { total_sales_month: 0 }; // Default team data structure

    if (monthId !== null && !isNaN(monthId)) {
      const teamDoc = await db.collection('team')
        .findOne(
          { monthId: monthId }, // Filter by the extracted monthId
          { projection: { _id: 0, total_sales_month: 1 } } // Only retrieve total_sales_month
        );
      teamDataFromDb = teamDoc || { total_sales_month: 0 }; // Use found doc or default if null
    } else {
      console.warn(`Could not determine monthId from leaderboard data for month: ${month}. Team data may be incomplete.`);
    }

    // --- Transform Leaderboard Data ---
    // Map the raw MongoDB documents to the structure expected by the frontend interface.
    const transformedLeaderboard = validLeaderboard.map(item => ({
      rank: parseInt(item.Rank) || 0,
      name: String(item['Agent Name'] || 'Unknown'), // Ensure name is always a string
      sales: parseInt(item.Sales) || 0,
      above_10: parseInt(item['Above 10']) || 0,
      commission: parseFloat(item['Commission (£)']) || 0, // Handle potential non-numeric values
      bonus: parseFloat(item['Bonus (£)']) || 0, // Handle potential non-numeric values

      // === EARNED FIELD ===
      // Map the MongoDB field 'Earned (£)' to the frontend's 'commissionEarned' field
      commissionEarned: parseFloat(item['Earned (£)']) || 0,

      // === EARNED DETAILS ===
      // Pass through the earnedDetails array from MongoDB
      // This contains the breakdown of earned amounts by property
      earnedDetails: item.earnedDetails || [], // Array of { propertyCode, commission }

      // === COMMISSION DETAILS (existing) ===
      // Include commission breakdown for detailed view
      commission_property_pair: item.commission_property_pair || null,

      // Other fields
      propertyCode: item.propertyCode || null, // Keep if used elsewhere
    }));

    // --- Transform Team Data ---
    // Calculate team-level metrics for the frontend
    const transformedTeam = {
      // Use the fetched total_sales_month if available, otherwise fallback to summing leaderboard sales
      totalSales: teamDataFromDb.total_sales_month || transformedLeaderboard.reduce((sum, agent) => sum + agent.sales, 0),
      target: 100, // Assuming a static target of 100 for now. Make this dynamic if needed.
      // Count agents who achieved "Above 10" sales
      totalSalesAbove10: transformedLeaderboard.filter(agent => agent.above_10 > 0).length
    };

    // --- Send Response ---
    res.status(200).json({
      leaderboard: transformedLeaderboard,
      team: transformedTeam
    });

  } catch (error) {
    console.error('Dashboard API Error:', error); // Log the error on the server side

    // Send a standardized error response to the client
    res.status(500).json({
      message: 'Failed to retrieve dashboard data.',
      error: error.message || 'An unknown server error occurred.', // Include specific error message if available
      hint: 'Please ensure: 1) The MongoDB URI in your .env.local file is correct and accessible, 2) Your server has network access to MongoDB, 3) MongoDB Atlas IP Whitelist includes your server\'s IP address, 4) The collection name ("leader_board", "team") and field names ("Earned (£)", "Rank", etc.) match your MongoDB schema.'
    });
  }
}