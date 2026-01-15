import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = "dwits";

export default async function handler(req, res) {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);

        const regex = new RegExp("Hussain|Ayan", 'i');
        const months = ['2025-12', '2026-01'];

        let results = [];

        for (const month of months) {
            const agents = await db.collection('leader_board').find({
                month: month,
                'Agent Name': regex
            }).toArray();
            results.push({ month, agents });
        }

        const employees = await db.collection('agent').find({
            name: regex
        }).toArray();
        results.push({ collection: 'agent', employees });

        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        // client.close(); // Keep open for now in serverless
    }
}
