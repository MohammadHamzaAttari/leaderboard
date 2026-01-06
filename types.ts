export interface Employee {
  _id?: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
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
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'manager';
  avatar?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  logout: () => void;
}