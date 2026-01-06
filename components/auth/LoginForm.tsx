import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Eye, EyeOff, User, Lock, Loader2, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const LoginForm: React.FC = () => {
  const router = useRouter();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await login({
        email: formData.email,
        password: formData.password,
        rememberMe: formData.rememberMe,
      });

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/admin');
        }, 1500);
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Success State
  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-20 h-20 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center animate-bounce-in">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome Back!
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Redirecting to dashboard...
        </p>
        <div className="mt-6">
          <div className="flex justify-center gap-1">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-10">
        {/* Mobile Logo */}
        <div className="lg:hidden mb-8">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <img src="/logo.png" alt="Logo" className="h-12 w-12 object-contain" />
          </div>
        </div>

        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Welcome Back
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-base">
          Please enter your credentials to continue
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                        rounded-xl text-red-600 dark:text-red-400 text-sm animate-shake">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Field */}
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Email Address
          </label>
          <div className="relative">
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200
              ${focusedField === 'email' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
              <User className="w-5 h-5" />
            </div>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter your email address"
              className={`w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 
                       border-2 rounded-xl transition-all duration-200 outline-none
                       text-gray-900 dark:text-white placeholder-gray-400
                       ${focusedField === 'email'
                  ? 'border-indigo-500 dark:border-indigo-400 ring-4 ring-indigo-500/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              autoComplete="email"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Password
          </label>
          <div className="relative">
            <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200
              ${focusedField === 'password' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
              <Lock className="w-5 h-5" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter your password"
              className={`w-full pl-12 pr-12 py-4 bg-white dark:bg-gray-800 
                       border-2 rounded-xl transition-all duration-200 outline-none
                       text-gray-900 dark:text-white placeholder-gray-400
                       ${focusedField === 'password'
                  ? 'border-indigo-500 dark:border-indigo-400 ring-4 ring-indigo-500/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 
                       hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleInputChange}
                className="sr-only peer"
              />
              <div className="w-5 h-5 border-2 border-gray-300 dark:border-gray-600 rounded-md
                            peer-checked:bg-indigo-600 peer-checked:border-indigo-600
                            transition-all duration-200 flex items-center justify-center
                            group-hover:border-indigo-400">
                <svg
                  className={`w-3 h-3 text-white transition-all duration-200 ${formData.rememberMe ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 
                           dark:group-hover:text-white transition-colors select-none">
              Remember me
            </span>
          </label>

          <a
            href="/forgot-password"
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 
                     hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors
                     hover:underline underline-offset-2"
          >
            Forgot password?
          </a>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-4 px-6 mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 
                   hover:from-indigo-700 hover:to-purple-700
                   text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30
                   hover:shadow-xl hover:shadow-indigo-500/40
                   focus:outline-none focus:ring-4 focus:ring-indigo-500/50
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg
                   transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]
                   flex items-center justify-center gap-3 group relative overflow-hidden"
        >
          {/* Button Shine Effect */}
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          Protected by enterprise-grade security
        </p>
        <div className="flex justify-center items-center gap-4 mt-3">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Lock className="w-3 h-3" />
            <span>256-bit SSL</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;