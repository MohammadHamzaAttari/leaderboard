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
import { withSessionRoute } from '../../../../lib/session';
import { validateCsrfToken } from '../../../../lib/csrf';
import { validateEmployeeData } from '../../../../lib/validation';
import { checkRateLimit } from '../../../../lib/security';
import { logAdminAction, createAuditContext } from '../../../../lib/audit';
import helmet from 'helmet';

// Apply Helmet middleware for security headers
function applyHelmet(req, res) {
  return new Promise((resolve, reject) => {
    helmet()(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export default async function handler(req, res) {
  return withSessionRoute(req, res, async (req, res) => {
    // Apply Helmet security headers
    await applyHelmet(req, res);

    // Rate limiting: 20 requests per minute for admin endpoints
    try {
      await checkRateLimit(req, res, 20, 60, 'admin_employee_detail');
    } catch (error) {
      if (error.message === 'RateLimitExceeded') {
        return;
      }
    }

    const user = verifyAuth(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const auditContext = createAuditContext(req);
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
          // CSRF Protection for state-changing requests
          const csrfToken = req.headers['x-csrf-token'];
          if (!validateCsrfToken(req, csrfToken)) {
            await logAdminAction('update_employee_failed', {
              ...auditContext,
              targetId: id,
              message: 'CSRF token validation failed',
              metadata: { reason: 'invalid_csrf_token' }
            });
            return res.status(403).json({
              success: false,
              message: 'Invalid CSRF token'
            });
          }

          const updateData = req.body;

          // Validate update data
          const validation = validateEmployeeData(updateData);
          if (!validation.valid) {
            await logAdminAction('update_employee_failed', {
              ...auditContext,
              targetId: id,
              message: 'Validation failed',
              metadata: { errors: validation.errors }
            });
            return res.status(400).json({
              success: false,
              message: 'Validation failed',
              errors: validation.errors
            });
          }

          const existingEmployee = await collection.findOne({ _id: new ObjectId(id) });
          if (!existingEmployee) {
            return res.status(404).json({
              success: false,
              message: 'Employee not found'
            });
          }

          // Check for duplicate email using sanitized data
          const sanitizedData = validation.sanitized;
          if (sanitizedData.email && sanitizedData.email !== existingEmployee.email) {
            const duplicateEmail = await collection.findOne({
              email: sanitizedData.email,
              _id: { $ne: new ObjectId(id) }
            });
            if (duplicateEmail) {
              await logAdminAction('update_employee_failed', {
                ...auditContext,
                targetId: id,
                message: 'Duplicate email',
                metadata: { email: sanitizedData.email }
              });
              return res.status(409).json({
                success: false,
                message: 'An employee with this email already exists.'
              });
            }
          }

          // Build update document with sanitized data
          const updateDoc = {
            $set: {
              name: sanitizedData.name || existingEmployee.name,
              email: sanitizedData.email || existingEmployee.email,
              phone: sanitizedData.phone || existingEmployee.phone,
              role: sanitizedData.role || existingEmployee.role,
              ghl_user_id: sanitizedData.ghl_user_id || existingEmployee.ghl_user_id,
              updatedAt: new Date().toISOString()
            }
          };

          await collection.updateOne({ _id: new ObjectId(id) }, updateDoc);
          const updatedEmployee = await collection.findOne({ _id: new ObjectId(id) });

          // Log successful update
          await logAdminAction('update_employee', {
            ...auditContext,
            targetId: id,
            targetType: 'employee',
            changes: { updated: updateDoc.$set },
            message: `Updated employee: ${updatedEmployee.name}`
          });

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
          // CSRF Protection for state-changing requests
          const csrfToken = req.headers['x-csrf-token'];
          if (!validateCsrfToken(req, csrfToken)) {
            await logAdminAction('delete_employee_failed', {
              ...auditContext,
              targetId: id,
              message: 'CSRF token validation failed',
              metadata: { reason: 'invalid_csrf_token' }
            });
            return res.status(403).json({
              success: false,
              message: 'Invalid CSRF token'
            });
          }

          const employee = await collection.findOne({ _id: new ObjectId(id) });

          if (!employee) {
            return res.status(404).json({
              success: false,
              message: 'Employee not found'
            });
          }

          await collection.deleteOne({ _id: new ObjectId(id) });

          // Log successful deletion
          await logAdminAction('delete_employee', {
            ...auditContext,
            targetId: id,
            targetType: 'employee',
            changes: { deleted: employee },
            message: `Deleted employee: ${employee.name}`
          });

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
  });
}