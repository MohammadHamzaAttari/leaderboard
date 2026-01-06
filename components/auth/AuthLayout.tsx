import React, { ReactNode } from 'react';
import Head from 'next/head';
import Image from 'next/image';

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ 
  children, 
  title = 'Login' 
}) => {
  return (
    <>
      <Head>
        <title>{title} | Your Company</title>
        <meta name="description" content="Secure login portal" />
      </Head>
      
      <div className="min-h-screen flex">
        {/* Left Side - Decorative */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          {/* Animated Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 animate-gradient-xy"></div>
          
          {/* Floating Shapes */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-blob"></div>
            <div className="absolute top-40 -right-40 w-80 h-80 bg-purple-300/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-40 left-40 w-80 h-80 bg-pink-300/20 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
            <div className="mb-8">
              <Image
                src="/logo.png"
                alt="Logo"
                width={120}
                height={120}
                className="drop-shadow-2xl"
              />
            </div>
            
            <h1 className="text-4xl font-bold mb-4 text-center">
              Welcome Back!
            </h1>
            <p className="text-lg text-white/80 text-center max-w-md">
              Access your dashboard and manage your business with our powerful tools.
            </p>
            
            {/* Features List */}
            <div className="mt-12 space-y-4">
              {[
                '📊 Real-time Analytics',
                '👥 Employee Management',
                '📈 Performance Tracking',
                '🔒 Secure & Reliable',
              ].map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 text-white/90 animate-fadeInUp"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <span className="text-xl">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthLayout;