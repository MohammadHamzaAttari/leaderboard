import session from 'express-session';
import MongoStore from 'connect-mongo';
import { connectToDatabase } from './mongodb';

const SECRET = process.env.SESSION_SECRET || 'super-secret-session-key-change-it-in-production-please-12345';

// Helper to get the client promise solely for MongoStore
const clientPromise = connectToDatabase().then(({ client }) => client);

export const sessionConfig = {
    secret: SECRET,
    resave: false,
    saveUninitialized: false, // Don't create session until something stored
    store: MongoStore.create({
        clientPromise: clientPromise,
        dbName: 'dwits',
        ttl: 8 * 60 * 60, // 8 hours
    }),
    cookie: {
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        httpOnly: true,
        // In production behind proxy, secure should be based on X-Forwarded-Proto header
        // Setting to 'auto' or checking the protocol in the proxy setting handles this
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    },
    // Trust the first proxy (nginx, Cloudflare, etc.) for secure cookie detection
    proxy: process.env.NODE_ENV === 'production',
};

// Middleware wrapper for Next.js API routes
export async function withSessionRoute(req, res, handler) {
    await new Promise((resolve, reject) => {
        session(sessionConfig)(req, res, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
    return handler(req, res);
}
