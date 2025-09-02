// Global cache invalidation utilities for React Query
// This file provides reusable patterns for invalidating and refetching cache data

/**
 * Invalidate and refetch all queries for a specific entity type
 * @param {Object} queryClient - React Query client instance
 * @param {string} entityType - The entity type (e.g., 'customers', 'machines', 'tickets')
 * @param {Object} options - Additional options
 * @param {boolean} options.forceRefetch - Whether to force immediate refetch
 * @param {Array} options.additionalKeys - Additional query keys to invalidate
 */
export const invalidateEntityQueries = async (queryClient, entityType, options = {}) => {
  const { forceRefetch = true, additionalKeys = [] } = options;
  
  console.log(`Invalidating queries for entity: ${entityType}`);
  
  // Invalidate the main entity queries
  await queryClient.invalidateQueries({ 
    predicate: (query) => query.queryKey[0] === entityType 
  });
  
  // Invalidate additional related queries
  for (const key of additionalKeys) {
    await queryClient.invalidateQueries({ 
      predicate: (query) => query.queryKey[0] === key 
    });
  }
  
  // Force refetch if requested
  if (forceRefetch) {
    await queryClient.refetchQueries({ 
      predicate: (query) => query.queryKey[0] === entityType 
    });
    
    for (const key of additionalKeys) {
      await queryClient.refetchQueries({ 
        predicate: (query) => query.queryKey[0] === key 
      });
    }
  }
};

/**
 * Invalidate and refetch customer-related queries
 * @param {Object} queryClient - React Query client instance
 * @param {Object} options - Additional options
 */
export const invalidateCustomerQueries = async (queryClient, options = {}) => {
  await invalidateEntityQueries(queryClient, 'customers', {
    ...options,
    additionalKeys: ['customer-machines', 'customer-details']
  });
};

/**
 * Invalidate and refetch machine-related queries
 * @param {Object} queryClient - React Query client instance
 * @param {Object} options - Additional options
 */
export const invalidateMachineQueries = async (queryClient, options = {}) => {
  await invalidateEntityQueries(queryClient, 'machine-models', {
    ...options,
    additionalKeys: ['machines', 'machine-categories', 'machine-details']
  });
};

/**
 * Invalidate and refetch ticket-related queries
 * @param {Object} queryClient - React Query client instance
 * @param {string} ticketType - Type of ticket ('warranty' or 'non-warranty')
 * @param {Object} options - Additional options
 */
export const invalidateTicketQueries = async (queryClient, ticketType, options = {}) => {
  const queryKey = ticketType === 'warranty' ? 'warranty-repair-tickets' : 'repair-tickets';
  
  await invalidateEntityQueries(queryClient, queryKey, {
    ...options,
    additionalKeys: ['ticket-details', 'work-orders']
  });
};

/**
 * Invalidate and refetch work order queries
 * @param {Object} queryClient - React Query client instance
 * @param {string} workOrderType - Type of work order ('warranty' or 'non-warranty')
 * @param {Object} options - Additional options
 */
export const invalidateWorkOrderQueries = async (queryClient, workOrderType, options = {}) => {
  const queryKey = workOrderType === 'warranty' ? 'warranty-work-orders' : 'work-orders';
  
  await invalidateEntityQueries(queryClient, queryKey, {
    ...options,
    additionalKeys: ['work-order-details']
  });
};

/**
 * Invalidate and refetch inventory queries
 * @param {Object} queryClient - React Query client instance
 * @param {Object} options - Additional options
 */
export const invalidateInventoryQueries = async (queryClient, options = {}) => {
  await invalidateEntityQueries(queryClient, 'inventory', {
    ...options,
    additionalKeys: ['inventory-details']
  });
};

/**
 * Invalidate and refetch user queries
 * @param {Object} queryClient - React Query client instance
 * @param {Object} options - Additional options
 */
export const invalidateUserQueries = async (queryClient, options = {}) => {
  await invalidateEntityQueries(queryClient, 'users', {
    ...options,
    additionalKeys: ['user-details', 'technicians']
  });
};

/**
 * Invalidate and refetch dashboard queries
 * @param {Object} queryClient - React Query client instance
 * @param {Object} options - Additional options
 */
export const invalidateDashboardQueries = async (queryClient, options = {}) => {
  await invalidateEntityQueries(queryClient, 'dashboard', {
    ...options,
    additionalKeys: ['dashboard-stats', 'recent-activity']
  });
};

/**
 * Invalidate and refetch notification queries
 * @param {Object} queryClient - React Query client instance
 * @param {Object} options - Additional options
 */
export const invalidateNotificationQueries = async (queryClient, options = {}) => {
  await invalidateEntityQueries(queryClient, 'notifications', {
    ...options,
    additionalKeys: ['unread-count']
  });
};

/**
 * Invalidate all queries (use sparingly)
 * @param {Object} queryClient - React Query client instance
 * @param {Object} options - Additional options
 */
export const invalidateAllQueries = async (queryClient, options = {}) => {
  console.log('Invalidating all queries');
  
  await queryClient.invalidateQueries();
  
  if (options.forceRefetch !== false) {
    await queryClient.refetchQueries();
  }
};

// Legacy function names for backward compatibility
/**
 * @deprecated Use invalidateWorkOrderQueries instead
 */
export const invalidateWorkOrdersCache = async (queryClient, options = {}) => {
  console.warn('invalidateWorkOrdersCache is deprecated. Use invalidateWorkOrderQueries instead.');
  return invalidateWorkOrderQueries(queryClient, 'non-warranty', options);
};

/**
 * @deprecated Use invalidateWorkOrderQueries instead
 */
export const invalidateWarrantyWorkOrdersCache = async (queryClient, options = {}) => {
  console.warn('invalidateWarrantyWorkOrdersCache is deprecated. Use invalidateWorkOrderQueries instead.');
  return invalidateWorkOrderQueries(queryClient, 'warranty', options);
};

/**
 * @deprecated Use invalidateTicketQueries instead
 */
export const invalidateRepairTicketsCache = async (queryClient, options = {}) => {
  console.warn('invalidateRepairTicketsCache is deprecated. Use invalidateTicketQueries instead.');
  return invalidateTicketQueries(queryClient, 'non-warranty', options);
};

/**
 * @deprecated Use invalidateTicketQueries instead
 */
export const invalidateWarrantyRepairTicketsCache = async (queryClient, options = {}) => {
  console.warn('invalidateWarrantyRepairTicketsCache is deprecated. Use invalidateTicketQueries instead.');
  return invalidateTicketQueries(queryClient, 'warranty', options);
};

/**
 * @deprecated Use invalidateDashboardQueries instead
 */
export const invalidateDashboardCache = async (queryClient, options = {}) => {
  console.warn('invalidateDashboardCache is deprecated. Use invalidateDashboardQueries instead.');
  return invalidateDashboardQueries(queryClient, options);
};

/**
 * Create a mutation with automatic cache invalidation
 * @param {Object} queryClient - React Query client instance
 * @param {Function} mutationFn - The mutation function
 * @param {Object} options - Mutation options
 * @param {Array} options.invalidateKeys - Query keys to invalidate on success
 * @param {Function} options.onSuccess - Additional onSuccess callback
 * @param {Function} options.onError - Additional onError callback
 */
export const createMutationWithCacheInvalidation = (queryClient, mutationFn, options = {}) => {
  const { invalidateKeys = [], onSuccess, onError, ...mutationOptions } = options;
  
  return {
    mutationFn,
    onSuccess: async (data, variables, context) => {
      // Invalidate specified query keys
      for (const key of invalidateKeys) {
        await queryClient.invalidateQueries({ 
          predicate: (query) => query.queryKey[0] === key 
        });
        await queryClient.refetchQueries({ 
          predicate: (query) => query.queryKey[0] === key 
        });
      }
      
      // Call additional onSuccess callback if provided
      if (onSuccess) {
        await onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      // Call additional onError callback if provided
      if (onError) {
        onError(error, variables, context);
      }
    },
    ...mutationOptions
  };
};
