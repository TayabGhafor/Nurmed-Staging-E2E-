export const COOKIE_EXPIRES = 30;

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role?: string[]; // Array of roles: can be doctor, hospitalAdmin, superAdmin, or combinations
  hospital_id?: number;
  department?: string;
  registration_number?: string;
  sur_name?: string;
}

export interface ApiError {
  message: string;
  status?: number;
}

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  status?: number;
  detail?: string;
}
