import { withSessionRoute } from '../../../lib/session';
import { getCsrfToken } from '../../../lib/csrf';

/**
 * GET /api/auth/csrf-token
 * Returns a CSRF token for the current session
 */
export default function handler(req, res) {
    return withSessionRoute(req, res, async (req, res) => {
        if (req.method !== 'GET') {
            return res.status(405).json({
                success: false,
                message: 'Method not allowed'
            });
        }

        try {
            // Get or create CSRF token for this session
            const token = getCsrfToken(req);

            // Save session to persist the token
            await req.session.save();

            return res.status(200).json({
                success: true,
                csrfToken: token
            });
        } catch (error) {
            console.error('CSRF token generation error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    });
}
