import React, { useState, useEffect } from 'react';
import { Employee, EmployeeFormData } from '../../types/employee';
import { X, Save, Loader2 } from 'lucide-react';

interface EmployeeFormProps {
  employee?: Employee | null;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const DEPARTMENTS = [
  'Sales',
  'Marketing',
  'Engineering',
  'Human Resources',
  'Finance',
  'Operations',
  'Customer Support',
  'Administration'
];

const POSITIONS = [
  'Manager',
  'Senior Associate',
  'Associate',
  'Team Lead',
  'Director',
  'Executive',
  'Intern',
  'Consultant'
];

const EmployeeForm: React.FC<EmployeeFormProps> = ({
  employee,
  onSubmit,
  onCancel,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<EmployeeFormData>({
    name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    hireDate: new Date().toISOString().split('T')[0],
    salary: 0,
    status: 'Active',
    address: '',
    emergencyContact: '',
    notes: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormData, string>>>({});

  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        department: employee.department,
        position: employee.position,
        hireDate: employee.hireDate.split('T')[0],
        salary: employee.salary,
        status: employee.status,
        address: employee.address || '',
        emergencyContact: employee.emergencyContact || '',
        notes: employee.notes || ''
      });
    }
  }, [employee]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof EmployeeFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    }

    if (!formData.department) {
      newErrors.department = 'Department is required';
    }

    if (!formData.position) {
      newErrors.position = 'Position is required';
    }

    if (!formData.hireDate) {
      newErrors.hireDate = 'Hire date is required';
    }

    if (formData.salary <= 0) {
      newErrors.salary = 'Salary must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'salary' ? parseFloat(value) || 0 : value
    }));

    // Clear error when user types
    if (errors[name as keyof EmployeeFormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Information */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          Personal Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full bg-[#1a1d24] border ${
                errors.name ? 'border-red-500' : 'border-gray-700'
              } rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="John Doe"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full bg-[#1a1d24] border ${
                errors.email ? 'border-red-500' : 'border-gray-700'
              } rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="john@example.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={`w-full bg-[#1a1d24] border ${
                errors.phone ? 'border-red-500' : 'border-gray-700'
              } rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="+44 123 456 7890"
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Address
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full bg-[#1a1d24] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="123 Main St, City"
            />
          </div>
        </div>
      </div>

      {/* Employment Information */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-gray-700">
          Employment Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className={`w-full bg-[#1a1d24] border ${
                errors.department ? 'border-red-500' : 'border-gray-700'
              } rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="">Select Department</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department}</p>}
          </div>

          {/* Position */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Position <span className="text-red-500">*</span>
            </label>
            <select
              name="position"
              value={formData.position}
              onChange={handleChange}
              className={`w-full bg-[#1a1d24] border ${
                errors.position ? 'border-red-500' : 'border-gray-700'
              } rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="">Select Position</option>
              {POSITIONS.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
            {errors.position && <p className="text-red-500 text-xs mt-1">{errors.position}</p>}
          </div>

          {/* Hire Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Hire Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="hireDate"
              value={formData.hireDate}
              onChange={handleChange}
              className={`w-full bg-[#1a1d24] border ${
                errors.hireDate ? 'border-red-500' : 'border-gray-700'
              } rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {errors.hireDate && <p className="text-red-500 text-xs mt-1">{errors.hireDate}</p>}
          </div>

          {/* Salary */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Salary (£) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="salary"
              value={formData.salary}
              onChange={handleChange}
              min="0"
              step="100"
              className={`w-full bg-[#1a1d24] border ${
                errors.salary ? 'border-red-500' : 'border-gray-700'
              } rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="50000"
            />
            {errors.salary && <p className="text-red-500 text-xs mt-1">{errors.salary}</p>}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full bg-[#1a1d24] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="On Leave">On Leave</option>
            </select>
          </div>

          {/* Emergency Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Emergency Contact
            </label>
            <input
              type="text"
              name="emergencyContact"
              value={formData.emergencyContact}
              onChange={handleChange}
              className="w-full bg-[#1a1d24] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Name - Phone"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Notes
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="w-full bg-[#1a1d24] border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Additional notes about the employee..."
        />
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-[#252932] transition-colors"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              {employee ? 'Update Employee' : 'Add Employee'}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default EmployeeForm;