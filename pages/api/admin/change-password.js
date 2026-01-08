import bcrypt from 'bcryptjs';
import { connectToDatabase } from '../../../lib/mongodb';
import { withSessionRoute } from '../../../lib/session';
import { validateCsrfToken } from '../../../lib/csrf';
import { validatePasswordStrength } from '../../../lib/validation';
import { checkRateLimit } from '../../../lib/security';
import { logAdminAction, createAuditContext } from '../../../lib/audit';
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

        if (req.method !== 'POST') {
            return res.status(405).json({ message: 'Method not allowed' });
        }

        // Rate limiting: 3 attempts per 15 minutes for password changes
        try {
            await checkRateLimit(req, res, 3, 15 * 60, 'change_password');
        } catch (error) {
            if (error.message === 'RateLimitExceeded') {
                return;
            }
        }

        const auditContext = createAuditContext(req);

        try {
            const user = req.session.user;

            if (!user) {
                return res.status(401).json({ message: 'Authentication required. Please login again.' });
            }

            // CSRF Protection
            const csrfToken = req.headers['x-csrf-token'];
            if (!validateCsrfToken(req, csrfToken)) {
                await logAdminAction('change_password_failed', {
                    ...auditContext,
                    message: 'CSRF token validation failed',
                    metadata: { reason: 'invalid_csrf_token' }
                });
                return res.status(403).json({ message: 'Invalid CSRF token' });
            }

            const { currentPassword, newPassword, confirmPassword } = req.body;

            // Validation
            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.status(400).json({ message: 'All fields are required' });
            }

            if (newPassword !== confirmPassword) {
                return res.status(400).json({ message: 'New passwords do not match' });
            }

            // Validate password strength
            const passwordValidation = validatePasswordStrength(newPassword);
            if (!passwordValidation.valid) {
                await logAdminAction('change_password_failed', {
                    ...auditContext,
                    message: 'Password validation failed',
                    metadata: { reason: passwordValidation.message }
                });
                return res.status(400).json({ message: passwordValidation.message });
            }

            if (currentPassword === newPassword) {
                return res.status(400).json({ message: 'New password must be different from current password' });
            }

            // Connect to database
            const { db } = await connectToDatabase();

            // Find user by email from session
            const userInDb = await db.collection('users').findOne({ email: user.email });

            if (!userInDb) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Verify current password
            const isPasswordValid = await bcrypt.compare(currentPassword, userInDb.password);
            if (!isPasswordValid) {
                await logAdminAction('change_password_failed', {
                    ...auditContext,
                    message: 'Incorrect current password',
                    metadata: { reason: 'invalid_current_password' }
                });
                return res.status(401).json({ message: 'Current password is incorrect' });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password in database
            await db.collection('users').updateOne(
                { email: user.email },
                {
                    $set: {
                        password: hashedPassword,
                        updatedAt: new Date()
                    }
                }
            );

            // Log successful password change
            await logAdminAction('change_password', {
                ...auditContext,
                message: 'Password changed successfully',
                metadata: { email: user.email }
            });

            return res.status(200).json({
                success: true,
                message: 'Password changed successfully'
            });

        } catch (error) {
            console.error('Change password error:', error);
            return res.status(500).json({
                message: 'Internal server error',
                error: error.message
            });
        }
    });
}
