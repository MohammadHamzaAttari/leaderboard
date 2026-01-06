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
  // Check for auth cookie/token
  const token = context.req.cookies['authToken'];
  
  if (token) {
    return {
      redirect: {
        destination: '/admin',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export default LoginPage;