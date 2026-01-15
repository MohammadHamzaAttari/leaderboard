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
import { checkAndApplyRollover, getPreviousMonth } from '../../../lib/rollover';

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

        console.log(`[Merge Rollover - Manual] Target: ${targetMonth}, Source: ${previousMonth}`);

        // Force run logic - bypass "already applied" check if needed, but for now we follow idempotent
        // To truly force, we might need a flag, but for now let's just run logic.
        // Actually, the shared logic prevents re-run if marked applied. 
        // For admin manual merge, we probably want to *force* it.
        // So let's delete the status first to force re-evaluation.
        await db.collection('rollover_status').deleteOne({ month: targetMonth });

        const result = await checkAndApplyRollover(db, targetMonth);

        return res.status(200).json({
            success: result.applied,
            message: result.message || 'Rollover process completed',
            targetMonth,
            previousMonth,
            itemsMerged: result.itemsMerged,
            details: result // Pass through full details
        });

    } catch (error) {
        console.error('[Merge Rollover] Error:', error);
        return res.status(500).json({
            message: 'Failed to merge rollover data',
            error: error.message
        });
    }
}
