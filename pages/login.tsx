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
  const { withSessionPage } = await import('../lib/auth');

  // Use session-based authentication check
  return withSessionPage(context, async (req, res, user) => {
    // User is already authenticated, redirect to admin dashboard
    return {
      redirect: {
        destination: '/admin',
        permanent: false,
      },
    };
  }).catch(() => {
    // Not authenticated or session error, show login page
    return {
      props: {},
    };
  });
};

export default LoginPage;