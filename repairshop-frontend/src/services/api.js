import axios from 'axios'
import { createApiInterceptor } from '../utils/performance'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

// Add performance monitoring
createApiInterceptor(api)

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async (error) => {
    const original = error.config
    
    // Handle 429 (Too Many Requests) errors
    if (error.response?.status === 429) {
      console.warn('Rate limit exceeded. Please wait before making more requests.')
      // You could show a toast notification here
      return Promise.reject(error)
    }
    
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const { data } = await api.post('/users/refresh', { refreshToken })
          localStorage.setItem('token', data.accessToken)
          localStorage.setItem('refreshToken', data.refreshToken)
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return api(original)
        } catch (e) {
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          window.location.href = '/login'
        }
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (payload) => api.post('/users/login', payload),
  getCurrentUser: () => api.get('/users/me'),
}

export const dashboardAPI = {
  getTechnicianWorkload: () => api.get('/dashboard/technician-workload'),
}

export default api


