import { checkAndApplyRollover } from './lib/rollover.js';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = "dwits";

async function run() {
    console.log("Connecting to DB...");
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    console.log("Forcing rollover merge for 2026-01...");
    // First, delete rollover status to force re-run
    await db.collection('rollover_status').deleteOne({ month: '2026-01' });

    // Run the logic
    const result = await checkAndApplyRollover(db, '2026-01');
    console.log("Result:", result);

    await client.close();
}

run().catch(console.error);
