import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = "dwits";

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = await MongoClient.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    retryWrites: true,
    retryReads: true,
    maxPoolSize: 10,
  });

  const db = client.db(DB_NAME);
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();
    
    // Get distinct months from leader_board collection
    const months = await db.collection('leader_board')
      .distinct('month');
    
    // Sort months in descending order (newest first)
    const sortedMonths = months.sort((a, b) => {
      return new Date(b + '-01') - new Date(a + '-01');
    });
    
    // Format months for dropdown
    const formattedMonths = sortedMonths.map(month => {
      const date = new Date(month + '-01');
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      return {
        value: month,
        label: label
      };
    });
    
    res.status(200).json({
      months: formattedMonths
    });
    
  } catch (error) {
    console.error('Error fetching months:', error);
    
    // Return fallback months if database fails
    const currentDate = new Date();
    const fallbackMonths = [];
    
    for (let i = 0; i < 6; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthValue = date.toISOString().slice(0, 7);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      fallbackMonths.push({
        value: monthValue,
        label: monthLabel
      });
    }
    
    res.status(200).json({
      months: fallbackMonths,
      fallback: true
    });
  }
}