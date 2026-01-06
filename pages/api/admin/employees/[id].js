import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = "dwits";

// ✅ CHANGE COLLECTION NAME HERE
const COLLECTION_NAME = "agent";  // Change to your new name, e.g., "staff", "team_members", etc.

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

import { verifyAuth } from '../../../../lib/auth';
import { triggerAgentWebhook } from '../../../../lib/webhook';

export default async function handler(req, res) {
  const user = verifyAuth(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { id } = req.query;

  // Validate ObjectId
  if (!id || !ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid employee ID format'
    });
  }

  try {
    const { db } = await connectToDatabase();
    // ✅ Updated to use constant
    const collection = db.collection(COLLECTION_NAME);

    switch (req.method) {
      case 'GET': {
        const employee = await collection.findOne({ _id: new ObjectId(id) });

        if (!employee) {
          return res.status(404).json({
            success: false,
            message: 'Employee not found'
          });
        }

        return res.status(200).json({
          success: true,
          employee: {
            ...employee,
            _id: employee._id.toString()
          }
        });
      }

      case 'PUT': {
        const updateData = req.body;

        const existingEmployee = await collection.findOne({ _id: new ObjectId(id) });
        if (!existingEmployee) {
          return res.status(404).json({
            success: false,
            message: 'Employee not found'
          });
        }

        // Check for duplicate email
        if (updateData.email) {
          const duplicateEmail = await collection.findOne({
            email: updateData.email.toLowerCase().trim(),
            _id: { $ne: new ObjectId(id) }
          });
          if (duplicateEmail) {
            return res.status(409).json({
              success: false,
              message: 'An employee with this email already exists.'
            });
          }
        }

        const updateDoc = {
          $set: {
            name: updateData.name?.trim() || existingEmployee.name,
            email: updateData.email?.toLowerCase().trim() || existingEmployee.email,
            phone: updateData.phone?.trim() || existingEmployee.phone,
            department: updateData.department?.trim() || existingEmployee.department,
            position: updateData.position?.trim() || existingEmployee.position,
            hireDate: updateData.hireDate || existingEmployee.hireDate,
            salary: updateData.salary !== undefined ? parseFloat(updateData.salary) : existingEmployee.salary,
            status: updateData.status || existingEmployee.status,
            address: updateData.address?.trim() ?? existingEmployee.address,
            emergencyContact: updateData.emergencyContact?.trim() ?? existingEmployee.emergencyContact,
            notes: updateData.notes?.trim() ?? existingEmployee.notes,
            updatedAt: new Date().toISOString()
          }
        };

        await collection.updateOne({ _id: new ObjectId(id) }, updateDoc);
        const updatedEmployee = await collection.findOne({ _id: new ObjectId(id) });

        // Trigger webhook for agent update
        const employeeData = {
          ...updatedEmployee,
          _id: updatedEmployee._id.toString()
        };
        await triggerAgentWebhook('update', employeeData);

        return res.status(200).json({
          success: true,
          message: 'Employee updated successfully',
          employee: {
            ...updatedEmployee,
            _id: updatedEmployee._id.toString()
          }
        });
      }

      case 'DELETE': {
        const employee = await collection.findOne({ _id: new ObjectId(id) });

        if (!employee) {
          return res.status(404).json({
            success: false,
            message: 'Employee not found'
          });
        }

        await collection.deleteOne({ _id: new ObjectId(id) });

        // Trigger webhook for agent deletion
        const deletedEmployeeData = {
          ...employee,
          _id: employee._id.toString()
        };
        await triggerAgentWebhook('delete', deletedEmployeeData);

        return res.status(200).json({
          success: true,
          message: 'Employee deleted successfully',
          deletedEmployee: {
            ...employee,
            _id: employee._id.toString()
          }
        });
      }

      default:
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({
          success: false,
          message: `Method ${req.method} Not Allowed`
        });
    }
  } catch (error) {
    console.error('Employee API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
}