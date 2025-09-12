import React, { createContext, useContext, useEffect, useState } from 'react'
import { 
  hasPermission as checkPermission, 
  hasAnyPermission as checkAnyPermission, 
  hasAllPermissions as checkAllPermissions, 
  ROLES, 
  isValidRole 
} from '@/lib/permissions'

interface User {
  id: string
  email: string
  name: string
  role?: string // Keep role for display purposes but don't use for access control
  avatar?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
  isAuthenticated: boolean
  hasRole: (role: string) => boolean
  hasPermission: (permission: string) => boolean
  hasAnyRole: (roles: string[]) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing authentication on app load
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (storedToken && storedUser) {
      try {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      } catch (error) {
        // Invalid stored data, clear it
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    try {
      // For demo purposes, simulate login with demo credentials
      const demoUsers = {
        'admin@repairshop.com': { id: '1', name: 'Admin User', role: 'admin', avatar: '' },
        'john@repairshop.com': { id: '3', name: 'Tech John', role: 'technician', avatar: '' },
        'manager@repairshop.com': { id: '2', name: 'Manager User', role: 'manager', avatar: '' },
        'test@repairshop.com': { id: '9', name: 'Test User', role: 'admin', avatar: '' }
      }

      const demoPasswords = {
        'admin@repairshop.com': 'admin',
        'john@repairshop.com': 'admin',
        'manager@repairshop.com': 'admin',
        'test@repairshop.com': 'test123'
      }

      // Check demo credentials first
      if (demoUsers[email as keyof typeof demoUsers] && demoPasswords[email as keyof typeof demoPasswords] === password) {
        const user = demoUsers[email as keyof typeof demoUsers]
        
        // For demo mode, try to get a real token from the backend
        try {
          const response = await fetch('http://localhost:3000/api/users/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          })

          if (response.ok) {
            const data = await response.json()
            
            setToken(data.accessToken)
            setUser(data.user)
            localStorage.setItem('token', data.accessToken)
            localStorage.setItem('user', JSON.stringify(data.user))
            return
          }
        } catch (error) {
          console.log('Demo login failed, falling back to mock data')
        }
        
        // Fallback to demo token if backend is not available
        const token = `demo-token-${user.id}`
        
        setToken(token)
        setUser(user)
        localStorage.setItem('token', token)
        localStorage.setItem('user', JSON.stringify(user))
        return
      }

      // Try real API if demo credentials don't match
      const response = await fetch('http://localhost:3000/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Login failed'
        
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.message || errorMessage
        } catch {
          errorMessage = `Server error: ${response.status}`
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      setToken(data.accessToken)
      setUser(data.user)
      localStorage.setItem('token', data.accessToken)
      localStorage.setItem('user', JSON.stringify(data.user))
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Network error. Please check if the backend is running.')
    }
  }

  const logout = async () => {
    try {
      // Call logout endpoint to clear refresh token and set last_logout
      const response = await fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        console.warn('Logout API call failed')
      }
    } catch (error) {
      console.warn('Logout error:', error)
    } finally {
      // Clear any stored location/state
      localStorage.removeItem('redirectAfterLogin')
      sessionStorage.clear()
      
      // Always clear local state and storage
      setToken(null)
      setUser(null)
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }

  const isAuthenticated = !!user && !!token

  // Permission checking functions
  const hasRole = (role: string): boolean => {
    return user?.role === role
  }

  const hasPermission = (permission: string): boolean => {
    if (!user?.role || !isValidRole(user.role)) return false
    return checkPermission(user.role, permission)
  }

  const hasAnyRole = (roles: string[]): boolean => {
    return user?.role ? roles.includes(user.role) : false
  }

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user?.role || !isValidRole(user.role)) return false
    return checkAnyPermission(user.role, permissions)
  }

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!user?.role || !isValidRole(user.role)) return false
    return checkAllPermissions(user.role, permissions)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isLoading,
        isAuthenticated,
        hasRole,
        hasPermission,
        hasAnyRole,
        hasAnyPermission,
        hasAllPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
