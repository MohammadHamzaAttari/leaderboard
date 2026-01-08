import { withSessionRoute } from './session';

export function verifyAuth(req) {
    // With express-session, user data is in req.session.user
    // Note: This requires the API route to be wrapped with withSessionRoute
    // For getServerSideProps, we also need to apply the session middleware manually or use a wrapper.
    const user = req.session && req.session.user;

    if (!user) {
        return null;
    }

    return user;
}

/**
 * Middleware to validate session for server-side rendered pages
 * Use this in getServerSideProps to protect admin routes
 */
export async function withSessionPage(context, handler) {
    return new Promise((resolve, reject) => {
        withSessionRoute(context.req, context.res, async (req, res) => {
            // Check if user is authenticated via session
            if (!req.session || !req.session.user) {
                resolve({
                    redirect: {
                        destination: '/login',
                        permanent: false,
                    },
                });
                return;
            }

            // User is authenticated, call the handler
            try {
                const result = await handler(req, res, req.session.user);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }).catch(reject);
    });
}

/**
 * Simple helper to check auth and redirect if not authenticated
 * Returns props with user data if authenticated
 */
export async function requireAuth(context) {
    return withSessionPage(context, async (req, res, user) => {
        return {
            props: {
                user,
            },
        };
    });
}
