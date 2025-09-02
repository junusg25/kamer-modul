import { useQuery } from '@tanstack/react-query';
import api, { dashboardAPI } from '../../../services/api';

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // 30 seconds
  });
}

export function useQuickStatsData() {
  return useQuery({
    queryKey: ['quickStats'],
    queryFn: () => api.get('/dashboard/quick-stats'),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 15 * 1000, // 15 seconds
  });
}

// Helper function to extract recent activity from dashboard data
export function useRecentActivity() {
  const { data: dashboardData } = useDashboardData();
  
  return {
    data: dashboardData?.data?.data?.recent_activity || [],
    isLoading: !dashboardData,
    error: null
  };
}

// Helper function to extract most used parts from dashboard data
export function useMostUsedParts() {
  return useQuery({
    queryKey: ['mostUsedParts'],
    queryFn: () => api.get('/analytics/most-used-parts?limit=5'),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Helper function to extract most repaired machines from dashboard data
export function useMostRepairedMachines() {
  return useQuery({
    queryKey: ['mostRepairedMachines'],
    queryFn: () => api.get('/analytics/top-repaired-machines?limit=5'),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Hook to fetch technician workload data
export function useTechnicianWorkload() {
  return useQuery({
    queryKey: ['technicianWorkload'],
    queryFn: () => dashboardAPI.getTechnicianWorkload(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // 30 seconds
  });
}
