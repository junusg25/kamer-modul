// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
export const API_ROOT = API_BASE_URL.replace('/api', '') // Remove /api suffix for WebSocket and print endpoints

