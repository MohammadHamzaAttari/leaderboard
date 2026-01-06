import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  Users,
  Home,
  ChevronLeft,
  ChevronRight,
  Building2,
  Menu,
  X,
  LogOut,
  Bell,
  Settings
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const router = useRouter();

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { href: '/admin/employees', label: 'Employees', icon: <Users size={20} /> },
    { href: '/admin/settings', label: 'Settings', icon: <Settings size={20} /> },
    { href: '/', label: 'Sales Dashboard', icon: <Home size={20} /> },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') {
      return router.pathname === '/admin';
    }
    return router.pathname.startsWith(href) && href !== '/';
  };

  const handleLogout = async () => {
    // Clear localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');

    // Call logout API to clear server-side cookie
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Redirect to login
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-[#1a1d24] text-white font-sans">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Narrower for better content utilization */}
      <aside
        className={`fixed left-0 top-0 h-full bg-[#1a1d24] border-r border-gray-800 z-50 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-56'
          } ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg font-bold">D</span>
              </div>
              <span className="font-bold text-white">Admin</span>
            </div>
          )}
          {sidebarCollapsed && (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-white text-lg font-bold">D</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-2 rounded-lg hover:bg-[#252932] text-gray-400 hover:text-white transition-colors"
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-[#252932] text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive(item.href)
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/30'
                : 'text-gray-400 hover:bg-[#252932] hover:text-white'
                }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* User Profile & Logout - Bottom */}
        {!sidebarCollapsed && (
          <div className="absolute bottom-4 left-0 right-0 px-3">
            <div className="bg-[#252932] rounded-lg p-3 border border-gray-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">A</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">Admin</div>
                  <div className="text-xs text-gray-400 truncate">Administrator</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:text-red-300 transition-colors text-sm font-medium"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        )}

        {sidebarCollapsed && (
          <div className="absolute bottom-4 left-0 right-0 px-2">
            <button
              onClick={handleLogout}
              className="w-full p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:text-red-300 transition-colors flex items-center justify-center"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        )}
      </aside>

      {/* Main Content - Optimized for 90% content area */}
      <div
        className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-56'
          }`}
      >
        {/* Header with Notification Bell */}
        <header className="border-b border-gray-800 bg-[#1a1d24] sticky top-0 z-30 backdrop-blur-sm bg-opacity-95">
          <div className="px-4 py-3 w-full">
            <div className="flex items-center justify-between">
              {/* Mobile Menu Button */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-lg bg-[#252932] border border-gray-700 text-gray-400 hover:text-white"
                >
                  <Menu size={20} />
                </button>
              </div>

              {/* Title - Centered on mobile, left-aligned on desktop */}
              <div className="flex-1 lg:flex-none">
                <h1 className="text-xl font-bold text-white text-center lg:text-left">{title}</h1>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button className="relative p-2 rounded-lg bg-[#252932] border border-gray-700 text-gray-400 hover:text-white transition-colors">
                  <Bell size={20} />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </button>
                <div className="hidden sm:flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">Admin Panel</div>
                    <div className="text-xs text-gray-400">DWITS Management</div>
                  </div>
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">A</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content - Maximum viewport utilization */}
        <main className="p-4 lg:p-6 max-w-[1920px]">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;