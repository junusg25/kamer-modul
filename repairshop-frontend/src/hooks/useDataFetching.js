import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

export const useDataFetching = ({
  queryKey,
  queryFn,
  enabled = true,
  refetchInterval = false,
  staleTime = 5 * 60 * 1000, // 5 minutes
  gcTime = 10 * 60 * 1000, // 10 minutes
  retry = 2,
  retryDelay = 1000,
  onSuccess,
  onError,
  select,
  placeholderData
}) => {
  const { user } = useAuth()

  return useQuery({
    queryKey,
    queryFn,
    enabled: enabled && !!user,
    refetchInterval,
    staleTime,
    gcTime,
    retry,
    retryDelay,
    onSuccess,
    onError,
    select,
    placeholderData,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true
  })
}

// Specific hooks for common data types
export const useWorkOrders = (filters = {}) => {
  return useDataFetching({
    queryKey: ['workOrders', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      // Add limit=1000 to get all work orders
      params.append('limit', '1000')
      const response = await api.get(`/workOrders?${params}`)
      return response.data
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for work orders
    refetchInterval: 30000 // 30 seconds
  })
}

export const useCustomers = () => {
  return useDataFetching({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await api.get('/customers?limit=1000')
      return response.data
    },
    staleTime: 10 * 60 * 1000 // 10 minutes for customers
  })
}

export const useMachines = () => {
  return useDataFetching({
    queryKey: ['machines'],
    queryFn: async () => {
      const response = await api.get('/machines?all=true')
      return response.data
    },
    staleTime: 10 * 60 * 1000 // 10 minutes for machines
  })
}

export const useTechnicians = () => {
  return useDataFetching({
    queryKey: ['technicians'],
    queryFn: async () => {
      const response = await api.get('/users/technicians')
      return response.data.data || []
    },
    staleTime: 15 * 60 * 1000 // 15 minutes for technicians
  })
}

export const useInventory = () => {
  return useDataFetching({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await api.get('/inventory')
      return response.data.data || []
    },
    staleTime: 5 * 60 * 1000 // 5 minutes for inventory
  })
}

export const useDashboardData = (dateRange = 'month') => {
  return useDataFetching({
    queryKey: ['dashboard', dateRange],
    queryFn: async () => {
      const response = await api.get(`/dashboard?range=${dateRange}`)
      return response.data.data || {}
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for dashboard
    refetchInterval: 60000 // 1 minute
  })
}

export const useAnalytics = (type, filters = {}) => {
  return useDataFetching({
    queryKey: ['analytics', type, filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      const response = await api.get(`/analytics/${type}?${params}`)
      return response.data.data || {}
    },
    staleTime: 5 * 60 * 1000 // 5 minutes for analytics
  })
}
