import crypto from 'crypto';

/**
 * Generate a cryptographically secure CSRF token
 * @returns {string} A random token
 */
export function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate CSRF token from request against session token
 * @param {object} req - Request object with session
 * @param {string} tokenFromRequest - Token from request header or body
 * @returns {boolean} True if valid, false otherwise
 */
export function validateCsrfToken(req, tokenFromRequest) {
    const sessionToken = req.session?.csrfToken;

    if (!sessionToken || !tokenFromRequest) {
        return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(sessionToken),
        Buffer.from(tokenFromRequest)
    );
}

/**
 * Middleware to validate CSRF token on protected routes
 * Should be used after session middleware
 */
export function csrfProtection(req, res, next) {
    // Skip CSRF check for GET, HEAD, OPTIONS requests (safe methods)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // Get token from header or body
    const token = req.headers['x-csrf-token'] || req.body?._csrf;

    if (!validateCsrfToken(req, token)) {
        return res.status(403).json({
            success: false,
            message: 'Invalid CSRF token'
        });
    }

    next();
}

/**
 * Get or create CSRF token for the current session
 * @param {object} req - Request object with session
 * @returns {string} CSRF token
 */
export function getCsrfToken(req) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCsrfToken();
    }
    return req.session.csrfToken;
}

/**
 * Rotate CSRF token (generate new one)
 * Call this after sensitive operations for enhanced security
 * @param {object} req - Request object with session
 * @returns {string} New CSRF token
 */
export function rotateCsrfToken(req) {
    req.session.csrfToken = generateCsrfToken();
    return req.session.csrfToken;
}
