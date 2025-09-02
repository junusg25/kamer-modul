import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { jwtDecode } from 'jwt-decode'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const decoded = jwtDecode(token)
        if (decoded?.exp * 1000 > Date.now()) {
          setUser({ 
            id: decoded.id, 
            email: decoded.email, 
            role: decoded.role, 
            name: decoded.name 
          })
          
          // If name is missing from token, try to fetch user data
          if (!decoded.name) {
            fetchUserData()
          }
        } else {
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
        }
      } catch (_) {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
      }
    }
    setLoading(false)
  }, [])

  const fetchUserData = async () => {
    try {
      const response = await authAPI.getCurrentUser()
      if (response.data) {
        setUser(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    }
  }

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password })
    localStorage.setItem('token', data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    setUser(data.user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    setUser(null)
  }

  const value = useMemo(() => ({ 
    user, 
    loading, 
    isAuthenticated: !!user, 
    login, 
    logout, 
    fetchUserData 
  }), [user, loading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}


