import React from 'react';
import { GetServerSideProps } from 'next';
import AuthLayout from '../components/auth/AuthLayout';
import LoginForm from '../components/auth/LoginForm';

const LoginPage: React.FC = () => {
  return (
    <AuthLayout title="Login">
      <LoginForm />
    </AuthLayout>
  );
};

// Redirect if already authenticated
export const getServerSideProps: GetServerSideProps = async (context) => {
  const { withSessionRoute } = await import('../lib/session');

  // Return the result of withSessionRoute directly
  return withSessionRoute(context.req, context.res, async (req, res) => {
    // PROACTIVELY CLEAR LEGACY COOKIE to prevent loops
    // If the user has an old 'authToken' cookie, nuke it.
    if (context.req.cookies['authToken']) {
      context.res.setHeader('Set-Cookie', 'authToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    }

    // If user checks session and IS authenticated, redirect to admin
    if (req.session && req.session.user) {
      return {
        redirect: {
          destination: '/admin',
          permanent: false,
        },
      };
    }

    // If NOT authenticated, just render the login page (don't redirect/loop)
    return {
      props: {},
    };
  });
};

export default LoginPage;