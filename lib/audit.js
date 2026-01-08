import { connectToDatabase } from './mongodb';

/**
 * Security audit logging module
 * Logs authentication events, admin actions, and security events
 */

/**
 * Log an audit event to the database
 * @param {object} eventData - Event data to log
 * @returns {Promise<void>}
 */
export async function logAuditEvent(eventData) {
    try {
        const { db } = await connectToDatabase();
        const auditCollection = db.collection('audit_logs');

        const auditEntry = {
            timestamp: new Date(),
            ...eventData,
            // Add server context
            serverTimestamp: new Date().toISOString(),
        };

        await auditCollection.insertOne(auditEntry);
    } catch (error) {
        // Don't throw errors from audit logging - log to console instead
        console.error('Audit logging error:', error);
    }
}

/**
 * Log authentication event
 * @param {string} eventType - 'login_success', 'login_failed', 'logout'
 * @param {object} data - Event data
 */
export async function logAuthEvent(eventType, data) {
    await logAuditEvent({
        category: 'authentication',
        eventType,
        userId: data.userId || null,
        email: data.email || null,
        ipAddress: data.ipAddress || 'unknown',
        userAgent: data.userAgent || 'unknown',
        success: data.success !== false,
        message: data.message || '',
        metadata: data.metadata || {}
    });
}

/**
 * Log admin action
 * @param {string} action - 'create_employee', 'update_employee', 'delete_employee', etc.
 * @param {object} data - Action data
 */
export async function logAdminAction(action, data) {
    await logAuditEvent({
        category: 'admin_action',
        action,
        userId: data.userId,
        email: data.email,
        targetId: data.targetId || null,
        targetType: data.targetType || null,
        changes: data.changes || {},
        ipAddress: data.ipAddress || 'unknown',
        userAgent: data.userAgent || 'unknown',
        metadata: data.metadata || {}
    });
}

/**
 * Log security event
 * @param {string} eventType - 'rate_limit_exceeded', 'csrf_failure', 'invalid_token', etc.
 * @param {object} data - Event data
 */
export async function logSecurityEvent(eventType, data) {
    await logAuditEvent({
        category: 'security',
        eventType,
        userId: data.userId || null,
        email: data.email || null,
        ipAddress: data.ipAddress || 'unknown',
        userAgent: data.userAgent || 'unknown',
        endpoint: data.endpoint || '',
        message: data.message || '',
        metadata: data.metadata || {}
    });
}

/**
 * Get client IP address from request
 * Handles proxies and X-Forwarded-For header
 * @param {object} req - Request object
 * @returns {string} IP address
 */
export function getClientIp(req) {
    // Check X-Forwarded-For header (for proxies/load balancers)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // X-Forwarded-For can contain multiple IPs, get the first one
        return forwarded.split(',')[0].trim();
    }

    // Check X-Real-IP header
    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'];
    }

    // Fallback to socket remote address
    return req.socket?.remoteAddress || 'unknown';
}

/**
 * Get user agent from request
 * @param {object} req - Request object
 * @returns {string} User agent
 */
export function getUserAgent(req) {
    return req.headers['user-agent'] || 'unknown';
}

/**
 * Create audit context from request
 * @param {object} req - Request object
 * @returns {object} Audit context
 */
export function createAuditContext(req) {
    return {
        ipAddress: getClientIp(req),
        userAgent: getUserAgent(req),
        userId: req.session?.user?.userId || null,
        email: req.session?.user?.email || null,
    };
}
