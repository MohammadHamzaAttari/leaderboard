import { connectToDatabase } from '../../../lib/mongodb';
import bcrypt from 'bcryptjs';
import { withSessionRoute } from '../../../lib/session';
import { checkRateLimit } from '../../../lib/security';
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

    const auditContext = createAuditContext(req);

    try {
      // 1. Rate Limiting: 5 attempts per 15 mins for login
      await checkRateLimit(req, res, 5, 15 * 60, 'login');

      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        await logAuthEvent('login_failed', {
          ...auditContext,
          email: email || 'unknown',
          success: false,
          message: 'Missing credentials'
        });

        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
        });
      }

      const { db } = await connectToDatabase();

      // Query database for user
      const user = await db.collection('users').findOne({ email });

      if (!user) {
        await logAuthEvent('login_failed', {
          ...auditContext,
          email,
          success: false,
          message: 'Invalid credentials - user not found'
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        await logAuthEvent('login_failed', {
          ...auditContext,
          email,
          userId: user._id.toString(),
          success: false,
          message: 'Invalid credentials - wrong password'
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // 2. Session-based Auth: Store user info in session
      const userSession = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      };

      req.session.user = userSession;
      await req.session.save();

      // Log successful login
      await logAuthEvent('login_success', {
        ...auditContext,
        email: user.email,
        userId: user._id.toString(),
        success: true,
        message: 'Login successful'
      });

      // Return user data (excluding password)
      const { password: _, ...userWithoutPassword } = user;

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        user: userWithoutPassword,
      });

    } catch (error) {
      if (error.message === 'RateLimitExceeded') {
        // Response already sent by checkRateLimit
        // Log already handled in security.js
        return;
      }

      console.error('Login error:', error);

      await logAuthEvent('login_error', {
        ...auditContext,
        success: false,
        message: 'Internal server error during login',
        metadata: { error: error.message }
      });

      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  });
}