import { MongoClient } from 'mongodb';

// --- Configuration ---
// IMPORTANT: Ensure MONGODB_URI is set in your .env.local file
const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = "dwits"; // Match the database name from existing code

if (!MONGO_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside your .env.local file.');
}

// --- Database Connection Cache ---
// global override to prevent multiple connections in development
let cached = global.mongo;

if (!cached) {
    cached = global.mongo = { conn: null, promise: null };
}

export async function connectToDatabase() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {};

        const client = new MongoClient(MONGO_URI, opts);
        cached.promise = client.connect().then((client) => {
            return {
                client,
                db: client.db(DB_NAME),
            };
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}
