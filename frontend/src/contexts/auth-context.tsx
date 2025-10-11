import React, { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { API_ROOT } from '../config/api'
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

interface UserPermission {
  permission_key: string
  granted: boolean
  expires_at?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  userPermissions: UserPermission[]
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
  refreshPermissions: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing authentication on app load
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token')
      const storedUser = localStorage.getItem('user')

      if (storedToken && storedUser) {
        try {
          // Found stored auth data, initializing...
          // First set the token and user in state
          setToken(storedToken)
          setUser(JSON.parse(storedUser))
          
          // Small delay to ensure state is set, then validate the token with backend
          await new Promise(resolve => setTimeout(resolve, 100))
          
          try {
            
            const response = await fetch(`${API_ROOT}/api/users/me`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${storedToken}`,
                'Content-Type': 'application/json',
              },
            })
            
            
            if (!response.ok) {
              
              localStorage.removeItem('token')
              localStorage.removeItem('user')
              setToken(null)
              setUser(null)
            } else {
              
              
              // Fetch user permissions after successful validation
              const parsedUser = JSON.parse(storedUser)
              try {
                
                const permResponse = await apiService.getUserPermissions(parsedUser.id)
                
                if (permResponse.data?.overrides) {
                  
                  setUserPermissions(permResponse.data.overrides)
                } else {
                  
                }
              } catch (error) {
                console.error('Error fetching user permissions on init:', error)
              }
            }
          } catch (validationError) {
            
            // Don't clear auth data on network errors during initialization
            // Let the periodic validation handle it later
          }
        } catch (error) {
          // Invalid stored data, clear it
          
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
          const response = await fetch(`${API_ROOT}/api/users/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          })

          if (response.ok) {
            const data = await response.json()
            
            // Save token to localStorage FIRST so getUserPermissions can use it
            setToken(data.accessToken)
            localStorage.setItem('token', data.accessToken)
            localStorage.setItem('user', JSON.stringify(data.user))
            
            // Now fetch user permissions (token is available in localStorage)
            try {
              const permResponse = await apiService.getUserPermissions(data.user.id)
              if (permResponse.data?.overrides) {
                setUserPermissions(permResponse.data.overrides)
              }
            } catch (error) {
              console.error('Error fetching user permissions:', error)
            }
            
            // Set user state LAST (after permissions are loaded)
            setUser(data.user)
            
            return
          }
        } catch (error) {
          
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
      const response = await fetch(`${API_ROOT}/api/users/login`, {
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
      
      // Save token to localStorage FIRST so getUserPermissions can use it
      setToken(data.accessToken)
      localStorage.setItem('token', data.accessToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      
      // Now fetch user permissions (token is available in localStorage)
      try {
        
        const permResponse = await apiService.getUserPermissions(data.user.id)
        
        if (permResponse.data?.overrides) {
          
          setUserPermissions(permResponse.data.overrides)
        }
      } catch (error) {
        console.error('Error fetching user permissions during login:', error)
      }
      
      // Set user state LAST (after permissions are loaded)
      setUser(data.user)
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
        const response = await fetch(`${API_ROOT}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
        
        if (!response.ok) {
          
        }
      }
    } catch (error) {
      
    } finally {
      // Clear any stored location/state
      localStorage.removeItem('redirectAfterLogin')
      sessionStorage.clear()
      
      // Always clear local state and storage
      setToken(null)
      setUser(null)
      setUserPermissions([])
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      
      // Show logout toast
      toast.info('Logged out', {
        description: 'You have been logged out successfully.'
      })
    }
  }

  const validateToken = async (): Promise<boolean> => {
    // Get token from localStorage if not in state yet
    const tokenToValidate = token || localStorage.getItem('token')
    if (!tokenToValidate) return false
    
    try {
      // Try to make a simple authenticated request to validate the token
      const response = await fetch(`${API_ROOT}/api/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenToValidate}`,
          'Content-Type': 'application/json',
        },
      })
      
      return response.ok
    } catch (error) {
      
      return false
    }
  }

  // Helper function to show session expired notification
  const showSessionExpiredNotification = () => {
    toast.error('Session Expired', {
      description: 'Your session has expired. Please log in again.',
      duration: 5000
    })
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
          
          showSessionExpiredNotification()
          await logout()
          window.location.href = '/login'
        }
      } catch (error) {
        
        // Don't logout on network errors, just log the error
      }
    }, 5 * 60 * 1000) // Check every 5 minutes

    return () => clearInterval(validateInterval)
  }, [isAuthenticated, validateToken, logout])

  // Permission checking functions
  const hasRole = (role: string): boolean => {
    return user?.role === role
  }

  const refreshPermissions = async () => {
    if (!user?.id) return
    
    try {
      const response = await apiService.getUserPermissions(user.id)
      if (response.data?.overrides) {
        setUserPermissions(response.data.overrides)
      }
    } catch (error) {
      console.error('Error fetching user permissions:', error)
    }
  }

  const hasPermission = (permission: string): boolean => {
    if (!user?.role || !isValidRole(user.role)) {
      return false
    }
    
    // First check if there's a user-specific override
    const override = userPermissions.find(p => p.permission_key === permission)
    if (override) {
      // Check if permission has expired
      if (override.expires_at) {
        const expiryDate = new Date(override.expires_at)
        if (expiryDate < new Date()) {
          // Permission has expired, fall back to role-based
          return checkPermission(user.role, permission)
        }
      }
      return override.granted
    }
    
    // Fall back to role-based permission
    const roleBasedResult = checkPermission(user.role, permission)
    return roleBasedResult
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
        userPermissions,
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
        refreshPermissions,
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
