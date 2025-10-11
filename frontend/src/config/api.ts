// API Configuration - Dynamic based on current host
const getApiUrl = () => {
  // In browser, use the current hostname
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol
    const hostname = window.location.hostname
    return `${protocol}//${hostname}/api`
  }
  // Fallback for build time
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
}

export const API_BASE_URL = getApiUrl()
export const API_ROOT = API_BASE_URL.replace('/api', '') // Remove /api suffix for WebSocket and print endpoints

