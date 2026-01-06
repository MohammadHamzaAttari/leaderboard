import React, { useState } from 'react';
import { GetServerSideProps } from 'next';
import AdminLayout from '../../components/admin/AdminLayout';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Key } from 'lucide-react';

const AdminSettings: React.FC = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        // Client-side validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            setMessage({ type: 'error', text: 'All fields are required' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'New password must be at least 6 characters long' });
            return;
        }

        if (currentPassword === newPassword) {
            setMessage({ type: 'error', text: 'New password must be different from current password' });
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/admin/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
            });

            const data = await response.json();

            if (response.ok) {
                setMessage({ type: 'success', text: data.message || 'Password changed successfully' });
                // Clear form
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setMessage({ type: 'error', text: data.message || 'Failed to change password' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'An error occurred' });
        } finally {
            setLoading(false);
        }
    };

    const passwordStrength = (password: string): { strength: string, color: string } => {
        if (password.length === 0) return { strength: '', color: '' };
        if (password.length < 6) return { strength: 'Weak', color: 'text-red-400' };
        if (password.length < 10) return { strength: 'Medium', color: 'text-yellow-400' };
        return { strength: 'Strong', color: 'text-green-400' };
    };

    const strength = passwordStrength(newPassword);

    return (
        <AdminLayout title="Settings">
            <div className="max-w-2xl mx-auto">
                <div className="bg-gradient-to-br from-[#252932] to-[#1f2229] rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Key className="text-blue-400" size={24} />
                            Change Password
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">Update your admin account credentials</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Message Alert */}
                        {message && (
                            <div className={`flex items-start gap-3 p-4 rounded-xl border ${message.type === 'success'
                                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                                }`}>
                                {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{message.text}</p>
                                </div>
                            </div>
                        )}

                        {/* Current Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Current Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full bg-[#1a1d24] border border-gray-700 rounded-lg pl-10 pr-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter current password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                >
                                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                New Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-[#1a1d24] border border-gray-700 rounded-lg pl-10 pr-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter new password (min. 6 characters)"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                >
                                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {newPassword && (
                                <p className={`text-xs mt-2 ${strength.color}`}>
                                    Password strength: {strength.strength}
                                </p>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-[#1a1d24] border border-gray-700 rounded-lg pl-10 pr-12 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Re-enter new password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {confirmPassword && newPassword !== confirmPassword && (
                                <p className="text-xs text-red-400 mt-2">Passwords do not match</p>
                            )}
                            {confirmPassword && newPassword === confirmPassword && (
                                <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                                    <CheckCircle size={12} /> Passwords match
                                </p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <div className="flex items-center gap-3 pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-lg text-white font-semibold transition-all shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Key size={18} />
                                        Change Password
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Security Tips */}
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-6">
                            <h4 className="text-sm font-semibold text-blue-400 mb-2">Password Security Tips:</h4>
                            <ul className="text-xs text-gray-400 space-y-1">
                                <li>• Use at least 6 characters (longer is better)</li>
                                <li>• Mix uppercase and lowercase letters</li>
                                <li>• Include numbers and special characters</li>
                                <li>• Don't reuse passwords from other accounts</li>
                                <li>• Change your password regularly</li>
                            </ul>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
    const token = context.req.cookies['authToken'];

    if (!token) {
        return {
            redirect: {
                destination: '/login',
                permanent: false,
            },
        };
    }

    return {
        props: {},
    };
};

export default AdminSettings;
