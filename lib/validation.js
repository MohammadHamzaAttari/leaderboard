/**
 * Input validation and sanitization utilities
 * Prevents XSS, NoSQL injection, and validates data formats
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
export function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;

    // RFC 5322 compliant email regex (simplified)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate phone number (basic validation)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
export function isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;

    // Allow digits, spaces, hyphens, parentheses, plus sign
    const phoneRegex = /^[\d\s\-\(\)\+]{7,20}$/;

    return phoneRegex.test(phone);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} { valid: boolean, message: string }
 */
export function validatePasswordStrength(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, message: 'Password is required' };
    }

    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long' };
    }

    if (password.length > 128) {
        return { valid: false, message: 'Password must be less than 128 characters' };
    }

    // Check for at least one uppercase, one lowercase, one number
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
        return {
            valid: false,
            message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        };
    }

    return { valid: true, message: 'Password is strong' };
}

/**
 * Sanitize string to prevent XSS attacks
 * Removes/escapes potentially dangerous characters
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(str) {
    if (!str || typeof str !== 'string') return '';

    return str
        .trim()
        // Remove null bytes
        .replace(/\0/g, '')
        // Escape HTML special characters
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize object to prevent NoSQL injection
 * Removes MongoDB query operators from object keys
 * @param {object} obj - Object to sanitize
 * @returns {object} Sanitized object
 */
export function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
        // Remove keys that start with $ (MongoDB operators)
        if (key.startsWith('$')) {
            continue;
        }

        // Recursively sanitize nested objects
        if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value);
        } else if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

/**
 * Validate and sanitize employee data
 * @param {object} data - Employee data to validate
 * @returns {object} { valid: boolean, errors: array, sanitized: object }
 */
export function validateEmployeeData(data) {
    const errors = [];
    const sanitized = {};

    // Required fields
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        errors.push('Name is required');
    } else {
        sanitized.name = sanitizeString(data.name);
        if (sanitized.name.length > 100) {
            errors.push('Name must be less than 100 characters');
        }
    }

    if (!data.email || !isValidEmail(data.email)) {
        errors.push('Valid email is required');
    } else {
        sanitized.email = data.email.toLowerCase().trim();
    }

    // Optional fields
    if (data.phone) {
        if (!isValidPhone(data.phone)) {
            errors.push('Invalid phone number format');
        } else {
            sanitized.phone = data.phone.trim();
        }
    }

    if (data.role) {
        const validRoles = ['agent', 'sales_manager', 'admin', 'employee', 'manager'];
        if (!validRoles.includes(data.role)) {
            errors.push('Invalid role');
        } else {
            sanitized.role = data.role;
        }
    }

    if (data.ghl_user_id) {
        sanitized.ghl_user_id = sanitizeString(data.ghl_user_id);
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitized
    };
}

/**
 * Validate pagination parameters
 * @param {object} params - Query parameters
 * @returns {object} Validated pagination params
 */
export function validatePaginationParams(params) {
    const page = Math.max(1, parseInt(params.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(params.limit) || 10));

    return {
        page,
        limit,
        skip: (page - 1) * limit
    };
}

/**
 * Validate sort parameters
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort order (asc/desc)
 * @param {array} allowedFields - Allowed fields to sort by
 * @returns {object} Validated sort params
 */
export function validateSortParams(sortBy, sortOrder, allowedFields = []) {
    const validSortBy = allowedFields.includes(sortBy) ? sortBy : allowedFields[0] || 'createdAt';
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    return {
        sortBy: validSortBy,
        sortOrder: validSortOrder,
        sortObject: { [validSortBy]: validSortOrder === 'asc' ? 1 : -1 }
    };
}
