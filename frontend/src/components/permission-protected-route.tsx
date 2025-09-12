import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { AccessDenied } from './access-denied'
import { Loader2 } from 'lucide-react'
// No need to import Permission type since we're using strings

interface PermissionProtectedRouteProps {
  children: React.ReactNode
  requiredPermissions: string[]
  fallbackComponent?: React.ComponentType
}

export function PermissionProtectedRoute({ 
  children, 
  requiredPermissions, 
  fallbackComponent: FallbackComponent 
}: PermissionProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth()
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  const hasAllPermissions = requiredPermissions.every(permission => 
    hasPermission(permission)
  )
  
  if (!hasAllPermissions) {
    return FallbackComponent ? <FallbackComponent /> : <AccessDenied />
  }
  
  return <>{children}</>
}
