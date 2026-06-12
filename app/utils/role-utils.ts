/**
 * Utility functions for role-based access control
 * Supports multiple roles per user
 */

export type UserRole = 'doctor' | 'hospitalAdmin' | 'superAdmin';

/**
 * Check if user has a specific role
 */
export function hasRole(userRoles: string[] | undefined, role: UserRole): boolean {
  if (!userRoles || !Array.isArray(userRoles)) {
    return false;
  }
  return userRoles.includes(role);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userRoles: string[] | undefined, roles: UserRole[]): boolean {
  if (!userRoles || !Array.isArray(userRoles)) {
    return false;
  }
  return roles.some(role => userRoles.includes(role));
}

/**
 * Check if user has all of the specified roles
 */
export function hasAllRoles(userRoles: string[] | undefined, roles: UserRole[]): boolean {
  if (!userRoles || !Array.isArray(userRoles)) {
    return false;
  }
  return roles.every(role => userRoles.includes(role));
}

/**
 * Check if user is a doctor
 */
export function isDoctor(userRoles: string[] | undefined): boolean {
  return hasRole(userRoles, 'doctor');
}

/**
 * Check if user is a hospital admin
 */
export function isHospitalAdmin(userRoles: string[] | undefined): boolean {
  return hasRole(userRoles, 'hospitalAdmin');
}

/**
 * Check if user is a super admin
 */
export function isSuperAdmin(userRoles: string[] | undefined): boolean {
  return hasRole(userRoles, 'superAdmin');
}

/**
 * Get primary role (highest priority role)
 * Priority: superAdmin > hospitalAdmin > doctor
 */
export function getPrimaryRole(userRoles: string[] | undefined): UserRole {
  if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) {
    return 'doctor';
  }
  
  if (userRoles.includes('superAdmin')) return 'superAdmin';
  if (userRoles.includes('hospitalAdmin')) return 'hospitalAdmin';
  return 'doctor';
}

/**
 * Format roles for display
 */
export function formatRoles(userRoles: string[] | undefined): string {
  if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) {
    return 'Doctor';
  }
  
  const roleNames: Record<string, string> = {
    doctor: 'Doctor',
    hospitalAdmin: 'Hospital Admin',
    superAdmin: 'Super Admin'
  };
  
  return userRoles.map(role => roleNames[role] || role).join(', ');
}

