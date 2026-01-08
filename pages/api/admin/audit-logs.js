import { connectToDatabase } from '../../../lib/mongodb';
import { withSessionRoute } from '../../../lib/session';
import { checkRateLimit } from '../../../lib/security';
import { createAuditContext } from '../../../lib/audit';
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

export default function handler(req, res) {
    return withSessionRoute(req, res, async (req, res) => {
        // Apply Helmet security headers
        await applyHelmet(req, res);

        if (req.method !== 'GET') {
            return res.status(405).json({
                success: false,
                message: 'Method not allowed'
            });
        }

        // Rate limiting: 30 requests per minute for audit log viewing
        try {
            await checkRateLimit(req, res, 30, 60, 'audit_logs');
        } catch (error) {
            if (error.message === 'RateLimitExceeded') {
                return;
            }
        }

        // Check authentication
        const user = req.session?.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        // Check if user is admin (optional - adjust based on your role system)
        if (user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Forbidden - Admin access required'
            });
        }

        try {
            const { db } = await connectToDatabase();
            const auditCollection = db.collection('audit_logs');

            // Parse query parameters
            const {
                page = 1,
                limit = 50,
                category = '',
                eventType = '',
                userId = '',
                startDate = '',
                endDate = ''
            } = req.query;

            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 50));
            const skip = (pageNum - 1) * limitNum;

            // Build query filter
            const query = {};

            if (category) {
                query.category = category;
            }

            if (eventType) {
                query.eventType = eventType;
            }

            if (userId) {
                query.userId = userId;
            }

            // Date range filter
            if (startDate || endDate) {
                query.timestamp = {};
                if (startDate) {
                    query.timestamp.$gte = new Date(startDate);
                }
                if (endDate) {
                    query.timestamp.$lte = new Date(endDate);
                }
            }

            // Fetch audit logs with pagination
            const [logs, totalCount] = await Promise.all([
                auditCollection
                    .find(query)
                    .sort({ timestamp: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .toArray(),
                auditCollection.countDocuments(query)
            ]);

            // Get distinct categories and event types for filtering
            const [categories, eventTypes] = await Promise.all([
                auditCollection.distinct('category'),
                auditCollection.distinct('eventType')
            ]);

            return res.status(200).json({
                success: true,
                logs: logs.map(log => ({
                    ...log,
                    _id: log._id.toString()
                })),
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.max(1, Math.ceil(totalCount / limitNum)),
                    totalItems: totalCount,
                    itemsPerPage: limitNum
                },
                filters: {
                    categories,
                    eventTypes
                }
            });

        } catch (error) {
            console.error('Audit logs API error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        }
    });
}
