const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://doadmin:48031d2wK6gt5x9S@db-mongodb-fra1-40589-c19b3d3d.mongo.ondigitalocean.com/admin?tls=true&authSource=admin&replicaSet=db-mongodb-fra1-40589";
const DB_NAME = "dwits";

async function checkRollover() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);

        console.log("Checking rollover_status collection:");
        const status = await db.collection('rollover_status').find({}).toArray();
        console.log(JSON.stringify(status, null, 2));

        console.log("\nChecking leader_board for any items with isRollover: true:");
        const agents = await db.collection('leader_board').find({}).toArray();

        let found = 0;
        agents.forEach(agent => {
            let pairs = [];
            try {
                if (typeof agent.commission_property_pair === 'string') {
                    pairs = JSON.parse(agent.commission_property_pair);
                } else if (Array.isArray(agent.commission_property_pair)) {
                    pairs = agent.commission_property_pair;
                }
            } catch (e) {
                // ignore
            }

            const rolloverItems = pairs.filter(p => p.isRollover === true);
            if (rolloverItems.length > 0) {
                console.log(`Agent: ${agent['Agent Name']}, Rollover Items: ${rolloverItems.length}`);
                console.log(JSON.stringify(rolloverItems, null, 2));
                found += rolloverItems.length;
            }
        });

        if (found === 0) {
            console.log("No rollover items found in any agent record.");
        } else {
            console.log(`\nTotal rollover items found: ${found}`);
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await client.close();
    }
}

checkRollover();
