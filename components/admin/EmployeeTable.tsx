import React from 'react';
import { Edit2, Trash2, Eye, Mail, Phone, Hash, Shield } from 'lucide-react';

// Update interface to match your actual MongoDB data
import { Employee } from '../../types/employee';

interface EmployeeTableProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onView: (employee: Employee) => void;
  isLoading?: boolean;
}

const EmployeeTable: React.FC<EmployeeTableProps> = ({
  employees = [], // Default to empty array
  onEdit,
  onDelete,
  onView,
  isLoading
}) => {

  const getRoleBadge = (role: string) => {
    const normalizeRole = role?.toLowerCase() || 'agent';
    if (normalizeRole.includes('manager')) {
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    }
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const getInitials = (name: string) => {
    return (name || '??')
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    if (!name) return 'from-gray-500 to-gray-600';
    const colors = [
      'from-blue-500 to-blue-600',
      'from-purple-500 to-purple-600',
      'from-green-500 to-green-600',
      'from-orange-500 to-orange-600',
      'from-pink-500 to-pink-600',
      'from-cyan-500 to-cyan-600'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-400">Loading agents...</span>
        </div>
      </div>
    );
  }

  if (!employees || employees.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No agents found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-[#2d3139] text-gray-300 font-semibold border-b border-gray-700">
          <div className="col-span-4 text-sm">Agent Name & Email</div>
          <div className="col-span-2 text-sm">Phone</div>
          <div className="col-span-2 text-sm">Role</div>
          <div className="col-span-3 text-sm">GHL ID</div>
          <div className="col-span-1 text-sm text-right">Actions</div>
        </div>

        {/* Table Body */}
        <div className="max-h-[60vh] overflow-y-auto">
          {employees.map((employee) => (
            <div
              key={employee._id}
              className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-800 bg-[#252932] hover:bg-[#2d3139] transition-colors duration-150 items-center"
            >
              {/* Name & Email (Col Span 4) */}
              <div className="col-span-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${getAvatarColor(employee.name)} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white text-sm font-bold">{getInitials(employee.name)}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-white font-medium truncate">{employee.name}</div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 truncate">
                    <Mail size={12} />
                    <span className="truncate">{employee.email}</span>
                  </div>
                </div>
              </div>

              {/* Phone (Col Span 2) */}
              <div className="col-span-2 text-gray-300 text-sm flex items-center gap-2">
                <Phone size={12} className="text-gray-500" />
                {employee.phone || 'N/A'}
              </div>

              {/* Role (Col Span 2) */}
              <div className="col-span-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadge(employee.role)}`}>
                  <Shield size={10} className="mr-1" />
                  {employee.role?.toUpperCase().replace('_', ' ') || 'AGENT'}
                </span>
              </div>

              {/* GHL ID (Col Span 3) */}
              <div className="col-span-3 text-gray-400 text-xs font-mono flex items-center gap-1 truncate">
                <Hash size={10} />
                {employee.ghl_user_id || 'Not Linked'}
              </div>

              {/* Actions (Col Span 1) */}
              <div className="col-span-1 flex items-center justify-end gap-1">
                <button
                  onClick={() => onEdit(employee)}
                  className="p-2 rounded-lg hover:bg-[#1a1d24] text-gray-400 hover:text-yellow-400 transition-colors"
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => onDelete(employee)}
                  className="p-2 rounded-lg hover:bg-[#1a1d24] text-gray-400 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmployeeTable;