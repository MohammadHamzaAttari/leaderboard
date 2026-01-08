import { withSessionRoute } from '../../../lib/session';
import { logAuthEvent, createAuditContext } from '../../../lib/audit';
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
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
      const auditContext = createAuditContext(req);
      const userEmail = req.session?.user?.email;
      const userId = req.session?.user?.userId;

      // Log logout event before destroying session
      await logAuthEvent('logout', {
        ...auditContext,
        email: userEmail,
        userId,
        success: true,
        message: 'User logged out'
      });

      // Destroy session and clear CSRF token
      req.session.destroy();

      return res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });
}