export interface Employee {
  _id?: string;
  employeeId: string;
  ghl_user_id?: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  role?: string;
  hireDate: string;
  salary: number;
  status: 'Active' | 'Inactive' | 'On Leave';
  avatar?: string;
  address?: string;
  emergencyContact?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeFormData {
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  hireDate: string;
  salary: number;
  status: 'Active' | 'Inactive' | 'On Leave';
  address?: string;
  emergencyContact?: string;
  notes?: string;
}

export interface EmployeeStats {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  onLeaveEmployees: number;
  departmentCounts: { [key: string]: number };
  recentHires: number;
}