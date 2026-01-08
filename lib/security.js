import { RateLimiterMongo } from 'rate-limiter-flexible';
import { connectToDatabase } from './mongodb';
import { logSecurityEvent, getClientIp } from './audit';

// Cache for different rate limiters
const rateLimiters = new Map();

/**
 * Get client IP address from request
 * Handles proxies and X-Forwarded-For header
 * @param {object} req - Request object
 * @returns {string} IP address
 */
function getIpAddress(req) {
    return getClientIp(req);
}

/**
 * Create or get a rate limiter for a specific key
 * @param {string} key - Unique key for this rate limiter
 * @param {number} points - Number of requests allowed
 * @param {number} duration - Time window in seconds
 * @returns {Promise<RateLimiterMongo>}
 */
async function getRateLimiter(key, points, duration) {
    const limiterKey = `${key}_${points}_${duration}`;

    if (rateLimiters.has(limiterKey)) {
        return rateLimiters.get(limiterKey);
    }

    const { client } = await connectToDatabase();

    const limiter = new RateLimiterMongo({
        storeClient: client,
        dbName: 'dwits',
        keyPrefix: `rate_limit_${key}`,
        points,
        duration,
    });

    rateLimiters.set(limiterKey, limiter);
    return limiter;
}

/**
 * Check rate limit for a request
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {number} points - Number of requests allowed (default: 5)
 * @param {number} duration - Time window in seconds (default: 15 minutes)
 * @param {string} key - Optional custom key for rate limiting (default: endpoint-based)
 * @throws {Error} Throws 'RateLimitExceeded' if limit exceeded
 */
export async function checkRateLimit(req, res, points = 5, duration = 15 * 60, key = null) {
    try {
        const ipAddress = getIpAddress(req);
        const limiterKey = key || req.url || 'default';
        const limiter = await getRateLimiter(limiterKey, points, duration);

        // Consume 1 point
        const rateLimitRes = await limiter.consume(ipAddress, 1);

        // Add rate limit headers to response
        res.setHeader('X-RateLimit-Limit', points);
        res.setHeader('X-RateLimit-Remaining', rateLimitRes.remainingPoints);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimitRes.msBeforeNext).toISOString());

    } catch (rejRes) {
        // Rate limit exceeded
        const retryAfter = Math.ceil(rejRes.msBeforeNext / 1000);

        res.setHeader('X-RateLimit-Limit', points);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext).toISOString());
        res.setHeader('Retry-After', retryAfter);

        // Log security event
        await logSecurityEvent('rate_limit_exceeded', {
            ipAddress: getIpAddress(req),
            userAgent: req.headers['user-agent'],
            endpoint: req.url,
            message: `Rate limit exceeded: ${points} requests per ${duration} seconds`,
            metadata: {
                remainingPoints: 0,
                retryAfter
            }
        });

        res.status(429).json({
            success: false,
            message: 'Too many requests. Please try again later.',
            retryAfter
        });

        throw new Error('RateLimitExceeded');
    }
}

/**
 * Create a rate limit middleware with specific limits
 * @param {number} points - Number of requests allowed
 * @param {number} duration - Time window in seconds
 * @param {string} key - Optional custom key
 * @returns {Function} Middleware function
 */
export function createRateLimitMiddleware(points, duration, key = null) {
    return async (req, res, next) => {
        try {
            await checkRateLimit(req, res, points, duration, key);
            next();
        } catch (error) {
            if (error.message === 'RateLimitExceeded') {
                // Response already sent
                return;
            }
            next(error);
        }
    };
}
