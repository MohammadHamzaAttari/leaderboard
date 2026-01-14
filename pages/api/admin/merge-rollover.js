import { MongoClient } from 'mongodb';

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
        throw new Error('Please define the MONGODB_URI environment variable.');
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

// --- Helper Functions ---

/**
 * Get previous month in YYYY-MM format
 */
function getPreviousMonth(monthStr) {
    if (!monthStr) return null;
    try {
        const [year, month] = monthStr.split('-').map(Number);
        const date = new Date(year, month - 2, 1); // month is 0-indexed, so month-2 for previous
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } catch (e) {
        console.error("Error calculating previous month:", e);
        return null;
    }
}

/**
 * Format month string for display (e.g., "2025-12" -> "December 2025")
 */
function formatMonthLabel(monthStr) {
    if (!monthStr) return 'Unknown';
    try {
        const date = new Date(monthStr + '-01');
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch (e) {
        return monthStr;
    }
}

/**
 * Parse commission_property_pair string or array
 */
function parseCommissionPairs(rawData) {
    if (!rawData) return [];

    if (Array.isArray(rawData)) {
        return rawData;
    }

    if (typeof rawData === 'string') {
        try {
            let cleanString = rawData.replace(/\\"/g, '"');
            const parsed = JSON.parse(cleanString);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error("Error parsing commission_property_pair:", e);
            return [];
        }
    }

    return [];
}

/**
 * Get incomplete commissions (not in earnedDetails)
 */
function getIncompleteCommissions(commissionPairs, earnedDetails) {
    const earnedCodes = new Set(
        (earnedDetails || [])
            .map(d => d.propertyCode?.trim().toLowerCase())
            .filter(Boolean)
    );

    return commissionPairs.filter(pair => {
        if (!pair) return false;
        const commValue = pair.commissionValue;
        if (commValue === null || commValue === undefined || commValue === '' || commValue === 'null') return false;
        const numValue = parseFloat(commValue);
        if (isNaN(numValue) || numValue === 0) return false;

        const normalizedCode = pair.propertyCode?.trim().toLowerCase();
        return normalizedCode && !earnedCodes.has(normalizedCode);
    });
}

// --- API Handler ---
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed. Use POST.' });
    }

    try {
        const { db } = await connectToDatabase();

        // Get target month from request body, default to current month
        let targetMonth = req.body?.targetMonth;
        if (!targetMonth) {
            const now = new Date();
            targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        // Validate month format
        if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
            return res.status(400).json({ message: 'Invalid month format. Use YYYY-MM.' });
        }

        const previousMonth = getPreviousMonth(targetMonth);
        if (!previousMonth) {
            return res.status(400).json({ message: 'Could not calculate previous month.' });
        }

        console.log(`[Merge Rollover] Target: ${targetMonth}, Source: ${previousMonth}`);

        // Fetch previous month data
        const previousMonthData = await db.collection('leader_board')
            .find({ month: previousMonth })
            .project({ _id: 0, 'Agent Name': 1, commission_property_pair: 1, earnedDetails: 1 })
            .toArray();

        if (!previousMonthData || previousMonthData.length === 0) {
            return res.status(200).json({
                message: `No previous month data found for ${previousMonth}`,
                merged: 0,
                targetMonth,
                previousMonth
            });
        }

        // Build a map of agent name -> incomplete commissions from previous month
        const rolloverMap = new Map();
        const sourceMonthLabel = formatMonthLabel(previousMonth);

        for (const agent of previousMonthData) {
            const agentName = (agent['Agent Name'] || '').trim();
            if (!agentName) continue;

            const commissionPairs = parseCommissionPairs(agent.commission_property_pair);
            const earnedDetails = agent.earnedDetails || [];

            // Get incomplete commissions and add source identification
            const incomplete = getIncompleteCommissions(commissionPairs, earnedDetails);

            if (incomplete.length > 0) {
                const rolloverItems = incomplete.map(pair => ({
                    commissionValue: pair.commissionValue,
                    propertyCode: pair.propertyCode,
                    sourceMonth: previousMonth,
                    sourceMonthLabel: sourceMonthLabel,
                    isRollover: true
                }));

                rolloverMap.set(agentName.toLowerCase(), rolloverItems);
            }
        }

        if (rolloverMap.size === 0) {
            return res.status(200).json({
                message: `No incomplete commissions found in ${previousMonth} to roll over`,
                merged: 0,
                targetMonth,
                previousMonth
            });
        }

        // Fetch current month data and merge rollover items
        const currentMonthData = await db.collection('leader_board')
            .find({ month: targetMonth })
            .toArray();

        if (!currentMonthData || currentMonthData.length === 0) {
            return res.status(404).json({
                message: `No data found for target month ${targetMonth}`,
                targetMonth,
                previousMonth
            });
        }

        let totalMerged = 0;
        let agentsUpdated = 0;
        const updateResults = [];

        for (const agentRecord of currentMonthData) {
            const agentName = (agentRecord['Agent Name'] || '').trim();
            const agentKey = agentName.toLowerCase();

            if (!rolloverMap.has(agentKey)) {
                continue; // No rollover data for this agent
            }

            const rolloverItems = rolloverMap.get(agentKey);
            const currentPairs = parseCommissionPairs(agentRecord.commission_property_pair);

            // Check which rollover items already exist (to avoid re-adding on multiple runs)
            const existingRolloverCodes = new Set(
                currentPairs
                    .filter(p => p.isRollover === true)
                    .map(p => `${p.propertyCode?.trim().toLowerCase()}_${p.sourceMonth}`)
            );

            // Filter out rollover items that are already present
            const newRolloverItems = rolloverItems.filter(item => {
                const key = `${item.propertyCode?.trim().toLowerCase()}_${item.sourceMonth}`;
                return !existingRolloverCodes.has(key);
            });

            if (newRolloverItems.length === 0) {
                continue; // All rollover items already exist
            }

            // Merge: current pairs + new rollover items
            const mergedPairs = [...currentPairs, ...newRolloverItems];

            // Update the database record
            const updateResult = await db.collection('leader_board').updateOne(
                { _id: agentRecord._id },
                {
                    $set: {
                        commission_property_pair: JSON.stringify(mergedPairs),
                        rollover_merged_at: new Date().toISOString(),
                        rollover_source_month: previousMonth
                    }
                }
            );

            if (updateResult.modifiedCount > 0) {
                agentsUpdated++;
                totalMerged += newRolloverItems.length;
                updateResults.push({
                    agent: agentName,
                    itemsAdded: newRolloverItems.length,
                    propertyCodes: newRolloverItems.map(i => i.propertyCode)
                });
            }
        }

        console.log(`[Merge Rollover] Completed: ${agentsUpdated} agents, ${totalMerged} items merged`);

        return res.status(200).json({
            success: true,
            message: `Successfully merged rollover data from ${previousMonth} into ${targetMonth}`,
            targetMonth,
            previousMonth,
            agentsUpdated,
            totalItemsMerged: totalMerged,
            details: updateResults
        });

    } catch (error) {
        console.error('[Merge Rollover] Error:', error);
        return res.status(500).json({
            message: 'Failed to merge rollover data',
            error: error.message
        });
    }
}
