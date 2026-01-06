import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = "dwits";
// ✅ Collection Name
const COLLECTION_NAME = "agent";

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    try {
      await cachedDb.admin().ping();
      return { client: cachedClient, db: cachedDb };
    } catch (error) {
      cachedClient = null;
      cachedDb = null;
    }
  }

  if (!MONGO_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  const client = new MongoClient(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 10,
  });

  await client.connect();
  const db = client.db(DB_NAME);

  // Ensure collection exists
  const collections = await db.listCollections({ name: COLLECTION_NAME }).toArray();
  if (collections.length === 0) {
    await db.createCollection(COLLECTION_NAME);
  }

  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

function generateEmployeeId() {
  const prefix = 'AGT';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

import { verifyAuth } from '../../../../lib/auth';
import { triggerAgentWebhook } from '../../../../lib/webhook';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    // ==========================================
    // GET REQUEST (Fetch Employees)
    // ==========================================
    if (req.method === 'GET') {
      const {
        page = 1,
        limit = 10,
        search = '',
        role = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
      const skip = (pageNum - 1) * limitNum;

      // Build Query
      const query = {};

      if (search && search.trim()) {
        const searchRegex = { $regex: search.trim(), $options: 'i' };
        query.$or = [
          { name: searchRegex },
          { email: searchRegex },
          { ghl_user_id: searchRegex },
          { phone: searchRegex }
        ];
      }

      if (role && role.trim()) {
        query.role = role.trim();
      }

      // Build sort
      const sort = {};
      const sortField = sortBy === 'name' ? 'name' : 'createdAt';
      sort[sortField] = sortOrder === 'asc' ? 1 : -1;

      // Execute queries
      const [employees, totalCount] = await Promise.all([
        collection.find(query).sort(sort).skip(skip).limit(limitNum).toArray(),
        collection.countDocuments(query)
      ]);

      // Calculate Stats (Optional)
      let stats = {
        totalEmployees: totalCount,
        activeEmployees: totalCount,
        inactiveEmployees: 0,
        onLeaveEmployees: 0
      };

      // Get Roles
      let roles = [];
      try {
        roles = await collection.distinct('role');
        roles = roles.filter(r => r && r.trim());
      } catch (e) {
        roles = ['agent', 'sales_manager', 'admin'];
      }

      return res.status(200).json({
        success: true,
        employees: employees.map(emp => ({
          ...emp,
          _id: emp._id.toString()
        })),
        pagination: {
          currentPage: pageNum,
          totalPages: Math.max(1, Math.ceil(totalCount / limitNum)),
          totalItems: totalCount,
          itemsPerPage: limitNum
        },
        stats,
        departmentCounts: {},
        departments: roles
      });
    }

    // ==========================================
    // POST REQUEST (Create Employee Manual)
    // ==========================================
    if (req.method === 'POST') {
      const employeeData = req.body;

      // Validate required fields
      if (!employeeData.name || !employeeData.email) {
        return res.status(400).json({
          success: false,
          message: `Name and Email are required.`
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(employeeData.email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Check for duplicate email
      const existingEmployee = await collection.findOne({
        email: employeeData.email.toLowerCase().trim()
      });

      if (existingEmployee) {
        return res.status(409).json({
          success: false,
          message: 'An employee with this email already exists.'
        });
      }

      // Create employee document with manual GHL ID
      const newEmployee = {
        employeeId: generateEmployeeId(),
        ghl_user_id: employeeData.ghl_user_id ? employeeData.ghl_user_id.trim() : '', // Save manual ID
        name: employeeData.name.trim(),
        email: employeeData.email.toLowerCase().trim(),
        phone: employeeData.phone ? employeeData.phone.trim() : '',
        role: employeeData.role || 'agent',
        status: 'Active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = await collection.insertOne(newEmployee);

      // Trigger webhook for agent creation
      const createdEmployee = {
        ...newEmployee,
        _id: result.insertedId.toString()
      };
      await triggerAgentWebhook('create', createdEmployee);

      return res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        employee: {
          ...newEmployee,
          _id: result.insertedId.toString()
        }
      });
    }

    // Handle disallowed methods
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`
    });

  } catch (error) {
    console.error('Employee API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
}