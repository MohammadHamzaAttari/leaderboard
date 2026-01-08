// Clear rate limit data from MongoDB
const { MongoClient } = require('mongodb');

async function clearRateLimits() {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
        console.error('Error: MONGODB_URI environment variable not set');
        process.exit(1);
    }

    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db('dwits');

        // Clear all rate limit collections
        const collections = await db.listCollections().toArray();
        const rateLimitCollections = collections.filter(c => c.name.includes('rate_limit'));

        console.log(`Found ${rateLimitCollections.length} rate limit collections`);

        for (const collection of rateLimitCollections) {
            const result = await db.collection(collection.name).deleteMany({});
            console.log(`✓ Cleared ${result.deletedCount} documents from ${collection.name}`);
        }

        console.log('\n✅ All rate limits cleared successfully!');
        console.log('You can now log in again.');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.close();
    }
}

clearRateLimits();
