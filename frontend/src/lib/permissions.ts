/**
 * Role-Based Access Control (RBAC) Permissions Configuration
 * Defines which roles have access to which permissions
 */

export const PERMISSIONS = {
  // Work Orders
  'work_orders:read': ['admin', 'manager', 'technician', 'sales'],
  'work_orders:write': ['admin', 'manager', 'technician'],
  'work_orders:delete': ['admin', 'manager', 'technician'],
  
  // Repair Tickets
  'repair_tickets:read': ['admin', 'manager', 'technician', 'sales'],
  'repair_tickets:write': ['admin', 'manager', 'technician'],
  'repair_tickets:delete': ['admin', 'manager', 'technician'],
  
  // Inventory
  'inventory:read': ['admin', 'manager', 'technician', 'sales'],
  'inventory:write': ['admin', 'manager', 'technician', 'sales'],
  'inventory:delete': ['admin', 'manager', 'technician', 'sales'],
  
  // Customers
  'customers:read': ['admin', 'manager', 'technician', 'sales'],
  'customers:write': ['admin', 'manager', 'technician', 'sales'],
  'customers:delete': ['admin', 'manager', 'technician', 'sales'],
  
  // Machine Management
  'machines:read': ['admin', 'manager', 'technician', 'sales'],
  'machines:write': ['admin', 'manager', 'sales'],
  'machines:assign': ['admin', 'manager', 'sales'],
  
  // Reports & Analytics
  'reports:read': ['admin', 'manager', 'technician', 'sales'],
  'analytics:read': ['admin', 'manager', 'technician', 'sales'],
  
  // Pipeline & Leads
  'pipeline:read': ['admin', 'manager', 'sales'],
  'pipeline:write': ['admin', 'manager', 'sales'],
  'pipeline:delete': ['admin', 'manager', 'sales'],
  
  // Quote Management
  'quotes:read': ['admin', 'manager', 'sales'],
  'quotes:write': ['admin', 'manager', 'sales'],
  'quotes:delete': ['admin', 'manager', 'sales'],
  
  // Sales Reports
  'sales_reports:read': ['admin', 'manager', 'sales'],
  'sales_reports:write': ['admin', 'manager', 'sales'],
  'sales_reports:delete': ['admin', 'manager', 'sales'],
  
  // User Management
  'users:read': ['admin', 'manager'],
  'users:write': ['admin'],
  'users:delete': ['admin'],
  
  // Settings
  'settings:read': ['admin', 'manager'],
  'settings:write': ['admin']
} as const

// Define roles as a const array
export const ROLES = ['admin', 'manager', 'technician', 'sales'] as const

// Export all permission keys as an array for runtime use
export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as string[]

// Export a type guard function to check if a string is a valid role
export function isValidRole(role: string): boolean {
  return ROLES.includes(role as any)
}

// Export a type guard function to check if a string is a valid permission
export function isValidPermission(permission: string): boolean {
  return PERMISSION_KEYS.includes(permission)
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: string, permission: string): boolean {
  if (!isValidRole(role) || !isValidPermission(permission)) {
    return false
  }
  const allowedRoles = PERMISSIONS[permission as keyof typeof PERMISSIONS] || []
  return allowedRoles.includes(role)
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: string, permissions: string[]): boolean {
  return permissions.some(permission => hasPermission(role, permission))
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: string, permissions: string[]): boolean {
  return permissions.every(permission => hasPermission(role, permission))
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: string): string[] {
  return PERMISSION_KEYS.filter(permission => 
    hasPermission(role, permission)
  )
}
