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

  return new Promise((resolve, reject) => {
    withSessionRoute(context.req, context.res, async (req, res) => {
      // If user checks session and IS authenticated, redirect to admin
      if (req.session && req.session.user) {
        resolve({
          redirect: {
            destination: '/admin',
            permanent: false,
          },
        });
        return;
      }

      // If NOT authenticated, just render the login page (don't redirect/loop)
      resolve({
        props: {},
      });
    }).catch(reject);
  });
};

export default LoginPage;