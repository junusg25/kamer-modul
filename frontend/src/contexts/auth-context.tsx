import React, { createContext, useContext, useEffect, useState } from 'react'
import { 
  hasPermission as checkPermission, 
  hasAnyPermission as checkAnyPermission, 
  hasAllPermissions as checkAllPermissions, 
  ROLES, 
  isValidRole 
} from '@/lib/permissions'
import { apiService } from '@/services/api'

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
  validateToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing authentication on app load
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token')
      const storedUser = localStorage.getItem('user')

      if (storedToken && storedUser) {
        try {
          console.log('Found stored auth data, initializing...')
          // First set the token and user in state
          setToken(storedToken)
          setUser(JSON.parse(storedUser))
          
          // Small delay to ensure state is set, then validate the token with backend
          await new Promise(resolve => setTimeout(resolve, 100))
          
          try {
            console.log('Validating token with backend...')
            const response = await fetch('http://localhost:3000/api/users/me', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${storedToken}`,
                'Content-Type': 'application/json',
              },
            })
            
            console.log('Token validation response:', response.status, response.ok)
            if (!response.ok) {
              console.warn('Token validation failed during initialization, clearing auth data')
              localStorage.removeItem('token')
              localStorage.removeItem('user')
              setToken(null)
              setUser(null)
            } else {
              console.log('Token validation successful, user authenticated')
            }
          } catch (validationError) {
            console.warn('Token validation error during initialization:', validationError)
            // Don't clear auth data on network errors during initialization
            // Let the periodic validation handle it later
          }
        } catch (error) {
          // Invalid stored data, clear it
          console.warn('Invalid stored auth data, clearing')
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setToken(null)
          setUser(null)
        }
      }
      setIsLoading(false)
    }

    initializeAuth()
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
      if (token) {
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

  const validateToken = async (): Promise<boolean> => {
    // Get token from localStorage if not in state yet
    const tokenToValidate = token || localStorage.getItem('token')
    if (!tokenToValidate) return false
    
    try {
      // Try to make a simple authenticated request to validate the token
      const response = await fetch('http://localhost:3000/api/users/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenToValidate}`,
          'Content-Type': 'application/json',
        },
      })
      
      return response.ok
    } catch (error) {
      console.warn('Token validation error:', error)
      return false
    }
  }

  // Helper function to show session expired notification
  const showSessionExpiredNotification = () => {
    // Create a simple notification
    const notification = document.createElement('div')
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc2626;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      max-width: 300px;
    `
    notification.textContent = 'Your session has expired. Please log in again.'
    
    document.body.appendChild(notification)
    
    // Remove notification after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 5000)
  }

  const isAuthenticated = !!user && !!token

  // Set up the logout callback with API service
  useEffect(() => {
    apiService.setLogoutCallback(logout)
  }, [logout])

  // Periodic token validation for active sessions
  useEffect(() => {
    if (!isAuthenticated) return

    const validateInterval = setInterval(async () => {
      try {
        const isValid = await validateToken()
        if (!isValid) {
          console.warn('Token expired during session, logging out')
          showSessionExpiredNotification()
          await logout()
          window.location.href = '/login'
        }
      } catch (error) {
        console.warn('Token validation error during periodic check:', error)
        // Don't logout on network errors, just log the error
      }
    }, 5 * 60 * 1000) // Check every 5 minutes

    return () => clearInterval(validateInterval)
  }, [isAuthenticated, validateToken, logout])

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
        validateToken,
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
