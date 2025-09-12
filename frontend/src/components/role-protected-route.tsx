import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { AccessDenied } from './access-denied'
import { Loader2 } from 'lucide-react'
import { ROLES } from '@/lib/permissions'

interface RoleProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: string[]
  fallbackComponent?: React.ComponentType
}

export function RoleProtectedRoute({ 
  children, 
  allowedRoles, 
  fallbackComponent: FallbackComponent 
}: RoleProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  
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
  
  if (!user?.role || !allowedRoles.includes(user.role)) {
    return FallbackComponent ? <FallbackComponent /> : <AccessDenied />
  }
  
  return <>{children}</>
}
