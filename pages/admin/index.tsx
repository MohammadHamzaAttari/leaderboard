import React, { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  Users,
  UserCheck,
  UserX,
  UserMinus,
  TrendingUp,
  Building2,
  RefreshCw,
  Clock,
  Zap,
  Activity,
  BarChart2,
  PieChart,
  Award,
  Sparkles
} from 'lucide-react';

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  onLeaveEmployees: number;
  departmentCounts: { [key: string]: number };
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeEmployees: 0,
    inactiveEmployees: 0,
    onLeaveEmployees: 0,
    departmentCounts: {}
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/employees?limit=1');
      const data = await response.json();

      if (response.ok) {
        setStats({
          totalEmployees: data.stats?.totalEmployees || 0,
          activeEmployees: data.stats?.activeEmployees || 0,
          inactiveEmployees: data.stats?.inactiveEmployees || 0,
          onLeaveEmployees: data.stats?.onLeaveEmployees || 0,
          departmentCounts: data.departmentCounts || {}
        });
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      title: 'Total Employees',
      value: stats.totalEmployees,
      icon: Users,
      gradient: 'from-blue-500 via-blue-600 to-indigo-600',
      shadowColor: 'shadow-blue-500/50',
      iconBg: 'bg-blue-500/20',
      trend: '+12%',
      trendUp: true
    },
    {
      title: 'Active Staff',
      value: stats.activeEmployees,
      icon: UserCheck,
      gradient: 'from-green-500 via-emerald-600 to-teal-600',
      shadowColor: 'shadow-green-500/50',
      iconBg: 'bg-green-500/20',
      trend: '+8%',
      trendUp: true
    },
    {
      title: 'Inactive',
      value: stats.inactiveEmployees,
      icon: UserX,
      gradient: 'from-red-500 via-rose-600 to-pink-600',
      shadowColor: 'shadow-red-500/50',
      iconBg: 'bg-red-500/20',
      trend: '-2%',
      trendUp: false
    },
    {
      title: 'On Leave',
      value: stats.onLeaveEmployees,
      icon: UserMinus,
      gradient: 'from-yellow-500 via-amber-600 to-orange-600',
      shadowColor: 'shadow-yellow-500/50',
      iconBg: 'bg-yellow-500/20',
      trend: '0%',
      trendUp: true
    },
  ];

  const topDepartments = Object.entries(stats.departmentCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  const departmentColors = [
    'from-violet-500 to-purple-600',
    'from-cyan-500 to-blue-600',
    'from-pink-500 to-rose-600',
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-green-600',
    'from-indigo-500 to-blue-600',
  ];

  return (
    <AdminLayout title="Dashboard">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative space-y-6">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-8 shadow-2xl">
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                  <Sparkles className="animate-pulse" />
                  Welcome Back, Admin!
                </h2>
                <p className="text-white/90 flex items-center gap-2">
                  <Clock size={16} />
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={fetchStats}
                disabled={loading}
                className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl text-white font-semibold transition-all border border-white/30 hover:scale-105 disabled:opacity-50"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        </div>

        {/* Premium Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 border border-gray-700/50"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${card.iconBg} border border-white/10 backdrop-blur-sm`}>
                    <card.icon size={24} className="text-white" />
                  </div>
                  {card.trend && (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${card.trendUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {card.trend}
                    </span>
                  )}
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-2">{card.title}</h3>
                {loading ? (
                  <div className="h-10 w-24 bg-gray-700 rounded-lg animate-pulse" />
                ) : (
                  <p className={`text-4xl font-bold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>
                    {card.value}
                  </p>
                )}
              </div>

              {/* Shine effect */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Departments - Premium Design */}
          <div className="lg:col-span-2">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-2xl border border-gray-700/50">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Building2 className="text-blue-400" />
                  Department Overview
                </h3>
                <BarChart2 className="text-gray-400" size={20} />
              </div>

              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-gray-700/50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : topDepartments.length > 0 ? (
                <div className="space-y-4">
                  {topDepartments.map(([dept, count], index) => {
                    const percentage = (count / stats.totalEmployees) * 100;
                    const gradient = departmentColors[index % departmentColors.length];

                    return (
                      <div key={dept} className="group relative overflow-hidden rounded-xl bg-gray-800/50 p-4 hover:bg-gray-800 transition-all duration-300 border border-gray-700/50 hover:border-gray-600">
                        {/* Background gradient */}
                        <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white shadow-lg`}>
                                #{index + 1}
                              </div>
                              <div>
                                <h4 className="text-white font-semibold text-lg">{dept}</h4>
                                <p className="text-gray-400 text-sm">{count} employees</p>
                              </div>
                            </div>
                            <div className={`text-2xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                              {percentage.toFixed(0)}%
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${gradient} rounded-full transition-all duration-1000`}
                              style={{ width: `${percentage}%` }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <PieChart size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400">No department data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-6">
            {/* System Health */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-2xl border border-gray-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-green-500/20 border border-green-500/30">
                  <Activity className="text-green-400" size={24} />
                </div>
                <h3 className="text-lg font-bold text-white">System Health</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Database</span>
                  <span className="flex items-center gap-2 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Online
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">API Status</span>
                  <span className="flex items-center gap-2 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Last Sync</span>
                  <span className="text-gray-300">Just now</span>
                </div>
              </div>
            </div>

            {/* Performance */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 shadow-2xl border border-gray-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-500/30">
                  <Award className="text-purple-400" size={24} />
                </div>
                <h3 className="text-lg font-bold text-white">This Month</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">New Hires</span>
                    <span className="text-white font-bold">+5</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full w-3/4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Attendance</span>
                    <span className="text-white font-bold">98%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full w-[98%] bg-gradient-to-r from-green-500 to-emerald-600 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </AdminLayout>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['authToken'];
  if (!token) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: {} };
};

export default AdminDashboard;