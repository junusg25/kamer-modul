import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

export const useOptimisticMutation = ({
  mutationFn,
  queryKey,
  onSuccess,
  onError,
  optimisticUpdate,
  successMessage,
  errorMessage,
  invalidateQueries = []
}) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey })

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(queryKey)

      // Optimistically update to the new value
      if (optimisticUpdate) {
        queryClient.setQueryData(queryKey, optimisticUpdate(variables, previousData))
      }

      // Return a context object with the snapshotted value
      return { previousData }
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData)
      }
      
      toast.error(errorMessage || err.response?.data?.message || 'Operation failed')
      onError?.(err, variables, context)
    },
    onSuccess: (data, variables, context) => {
      // Invalidate and refetch
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey })
      })
      
      // Also invalidate the main query key
      queryClient.invalidateQueries({ queryKey })
      
      if (successMessage) {
        toast.success(successMessage)
      }
      
      onSuccess?.(data, variables, context)
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey })
    }
  })
}

// Specific hooks for common operations
export const useOptimisticDelete = (queryKey, successMessage = 'Item deleted successfully') => {
  return useOptimisticMutation({
    queryKey,
    successMessage,
    errorMessage: 'Failed to delete item',
    invalidateQueries: [queryKey]
  })
}

export const useOptimisticCreate = (queryKey, successMessage = 'Item created successfully') => {
  return useOptimisticMutation({
    queryKey,
    successMessage,
    errorMessage: 'Failed to create item',
    invalidateQueries: [queryKey]
  })
}

export const useOptimisticUpdate = (queryKey, successMessage = 'Item updated successfully') => {
  return useOptimisticMutation({
    queryKey,
    successMessage,
    errorMessage: 'Failed to update item',
    invalidateQueries: [queryKey]
  })
}
