import React, { useState, useEffect, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import AdminLayout from '../../components/admin/AdminLayout';
import EmployeeTable from '../../components/admin/EmployeeTable';
import EmployeeModal from '../../components/admin/EmployeeModal';
import { Employee, EmployeeFormData } from '../../types/employee';
import {
  Plus,
  Search,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  CheckCircle,
  Users,
  Filter,
  SlidersHorizontal
} from 'lucide-react';

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20 // Increased from 10 to 20
  });

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const fetchEmployees = useCallback(async (page = 1) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20', // Increased from 10
        ...(searchQuery && { search: searchQuery }),
        ...(filterDepartment && { department: filterDepartment }),
        ...(filterStatus && { status: filterStatus })
      });

      const response = await fetch(`/api/admin/employees?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch employees');
      }

      setEmployees(data.employees || []);
      setPagination(data.pagination || {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 10
      });
      setDepartments(data.departments || []);
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      showToast('error', error.message || 'Failed to load employees');
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterDepartment, filterStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, filterDepartment, filterStatus]);

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setModalOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setModalOpen(true);
  };

  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setModalOpen(true);
  };

  const handleDeleteClick = (employee: Employee) => {
    setDeleteConfirm(employee);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    // Ensure we have a GHL ID to use for deletion
    const targetId = deleteConfirm.ghl_user_id;
    if (!targetId) {
      showToast('error', 'Cannot delete: Employee is missing GHL ID');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/admin/employees/${targetId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete employee');
      }

      showToast('success', `${deleteConfirm.name} has been deleted`);
      setDeleteConfirm(null);
      fetchEmployees(pagination.currentPage);
    } catch (error: any) {
      showToast('error', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (data: Partial<Employee>) => {
    try {
      setIsSubmitting(true);

      let url = '/api/admin/employees';
      let method = 'POST';

      if (selectedEmployee) {
        const targetId = selectedEmployee.ghl_user_id;
        if (!targetId) {
          throw new Error('Cannot update: Employee is missing GHL ID');
        }
        url = `/api/admin/employees/${targetId}`;
        method = 'PUT';
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Operation failed');
      }

      showToast('success', selectedEmployee
        ? 'Employee updated successfully'
        : 'Employee added successfully'
      );

      setModalOpen(false);
      setSelectedEmployee(null);
      fetchEmployees(selectedEmployee ? pagination.currentPage : 1);
    } catch (error: any) {
      showToast('error', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToCSV = () => {
    if (employees.length === 0) {
      showToast('error', 'No employees to export');
      return;
    }

    const headers = ['ID', 'Name', 'Email', 'Phone', 'Department', 'Position', 'Hire Date', 'Salary', 'Status'];
    const csvContent = [
      headers.join(','),
      ...employees.map(emp => [
        emp.employeeId,
        `"${emp.name}"`,
        emp.email,
        emp.phone,
        emp.department,
        emp.position,
        emp.hireDate,
        emp.salary,
        emp.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('success', 'Export completed');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterDepartment('');
    setFilterStatus('');
  };

  const hasActiveFilters = searchQuery || filterDepartment || filterStatus;

  return (
    <AdminLayout title="Employee Management">
      {/* Toast Notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border ${toast.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
          >
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span className="text-xs font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {/* Ultra-Compact Header: Stats + Filters + Actions in ONE ROW */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tiny Stats Pills */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <Users size={14} className="text-blue-400" />
            <span className="text-xs text-blue-400 font-medium">{loading ? '...' : pagination.totalItems}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
            <span className="text-xs text-green-400 font-medium">Page {pagination.currentPage}/{pagination.totalPages}</span>
          </div>

          {/* Search - Compact */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1a1d24] border border-gray-700 rounded-lg pl-8 pr-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Filters - Inline & Tiny */}
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="bg-[#1a1d24] border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Depts</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-[#1a1d24] border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="On Leave">On Leave</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 transition-all"
              title="Clear"
            >
              <X size={14} />
            </button>
          )}

          {/* Action Buttons - Compact */}
          <button
            onClick={exportToCSV}
            disabled={employees.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#252932] hover:bg-[#2d3139] rounded-lg text-gray-300 transition-all border border-gray-700 disabled:opacity-50 text-xs"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={() => fetchEmployees(pagination.currentPage)}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#252932] hover:bg-[#2d3139] rounded-lg text-gray-300 transition-all border border-gray-700 text-xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleAddEmployee}
            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-lg text-white transition-all shadow-lg text-xs font-semibold"
          >
            <Plus size={14} />
            Add Employee
          </button>
        </div>

        {/* Employee Table - Maximum Space */}
        <div className="bg-[#252932] rounded-lg shadow-xl border border-gray-800 overflow-hidden">
          <EmployeeTable
            employees={employees}
            onEdit={handleEditEmployee}
            onDelete={handleDeleteClick}
            onView={handleViewEmployee}
            isLoading={loading}
          />
        </div>

        {/* Compact Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between bg-[#252932] rounded-lg px-3 py-2 border border-gray-800">
            <p className="text-xs text-gray-400">
              {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1}-{Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems}
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchEmployees(pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1 || loading}
                className="p-1 rounded bg-[#1a1d24] hover:bg-[#2d3139] text-gray-300 disabled:opacity-50 border border-gray-700"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-0.5">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.currentPage >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => fetchEmployees(pageNum)}
                      disabled={loading}
                      className={`w-7 h-7 rounded text-xs font-medium transition-all ${pagination.currentPage === pageNum
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                        : 'bg-[#1a1d24] text-gray-300 hover:bg-[#2d3139] border border-gray-700'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => fetchEmployees(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages || loading}
                className="p-1 rounded bg-[#1a1d24] hover:bg-[#2d3139] text-gray-300 disabled:opacity-50 border border-gray-700"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Empty State - Compact */}
        {!loading && employees.length === 0 && !hasActiveFilters && (
          <div className="bg-[#252932] rounded-lg border border-gray-800 p-8 text-center">
            <Users size={32} className="mx-auto text-blue-400 mb-2" />
            <h3 className="text-sm font-semibold text-white mb-1">No Employees Yet</h3>
            <button
              onClick={handleAddEmployee}
              className="inline-flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg text-white text-sm mt-3"
            >
              <Plus size={16} />
              Add Employee
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <EmployeeModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedEmployee(null);
        }}
        initialData={selectedEmployee}
        title={selectedEmployee ? 'Edit Employee' : 'Add Employee'}
        onSubmit={handleFormSubmit}
      />

      {/* Delete Confirmation Modal - Premium */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isSubmitting && setDeleteConfirm(null)}
          />
          <div className="relative bg-gradient-to-br from-[#252932] to-[#1f2229] border border-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Delete Employee?</h3>
              <p className="text-gray-400 mb-6">
                Are you sure you want to delete <span className="font-semibold text-white">{deleteConfirm.name}</span>?
                <br />
                <span className="text-red-400 text-sm">This action cannot be undone.</span>
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-6 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-[#1a1d24] transition-all"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white transition-all disabled:opacity-50 shadow-lg shadow-red-600/30"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Employee'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </AdminLayout>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { requireAuth } = await import('../../lib/auth');
  return requireAuth(context);
};

export default EmployeesPage;