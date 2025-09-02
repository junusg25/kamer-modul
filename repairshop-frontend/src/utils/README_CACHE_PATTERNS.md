# Global Cache Invalidation Patterns

This document explains how to implement global auto-refresh patterns using React Query and the cache utilities.

## Overview

The `cacheUtils.js` file provides reusable patterns for invalidating and refetching cache data across the application. This ensures that when data is created, updated, or deleted, all related components automatically refresh to show the latest data.

## Available Utilities

### Entity-Specific Invalidation

```javascript
import { 
  invalidateCustomerQueries,
  invalidateMachineQueries,
  invalidateTicketQueries,
  invalidateWorkOrderQueries,
  invalidateInventoryQueries,
  invalidateUserQueries,
  invalidateDashboardQueries,
  invalidateNotificationQueries
} from '../utils/cacheUtils';

// Example: Invalidate customer queries
await invalidateCustomerQueries(queryClient);
```

### Generic Entity Invalidation

```javascript
import { invalidateEntityQueries } from '../utils/cacheUtils';

// Invalidate any entity type
await invalidateEntityQueries(queryClient, 'customers', {
  forceRefetch: true,
  additionalKeys: ['customer-machines', 'customer-details']
});
```

### Mutation with Automatic Cache Invalidation

```javascript
import { createMutationWithCacheInvalidation } from '../utils/cacheUtils';

const createCustomerMutation = useMutation(
  createMutationWithCacheInvalidation(
    queryClient,
    async (data) => {
      const response = await api.post('/customers', data);
      return response.data;
    },
    {
      invalidateKeys: ['customers', 'customer-machines'],
      onSuccess: (data) => {
        toast.success('Customer created successfully');
        navigate('/customers');
      },
      onError: (error) => {
        toast.error('Failed to create customer');
      }
    }
  )
);
```

## Implementation Examples

### 1. Create Customer (CreateCustomer.jsx)

```javascript
const createMutation = useMutation({
  mutationFn: async (data) => {
    const response = await api.post('/customers', data);
    return response.data;
  },
  onSuccess: async () => {
    // Invalidate and refetch customer queries
    await invalidateCustomerQueries(queryClient);
    toast.success(translate('notifications.customerCreated'));
    navigate('/customers');
  },
  onError: (error) => {
    toast.error(translate('errors.failedToCreateCustomer'));
  }
});
```

### 2. Create Ticket with New Customer (CreateTicket.jsx)

```javascript
const createMutation = useMutation({
  mutationFn: async (data) => {
    const endpoint = isWarranty ? '/warrantyRepairTickets' : '/repairTickets';
    const response = await api.post(endpoint, data);
    return response.data;
  },
  onSuccess: async () => {
    // Invalidate ticket queries
    await invalidateTicketQueries(queryClient, isWarranty ? 'warranty' : 'non-warranty');
    
    // If a new customer was created, also invalidate customer queries
    if (formData.customer_type === 'new') {
      await invalidateCustomerQueries(queryClient);
    }
    
    toast.success(translate('notifications.ticketCreatedSuccessfully'));
    navigate(isWarranty ? '/warranty' : '/non-warranty');
  },
  onError: (error) => {
    toast.error(translate('errors.failedToCreateTicket'));
  }
});
```

### 3. Update Machine Model (EditMachine.jsx)

```javascript
const updateMutation = useMutation({
  mutationFn: async (data) => {
    const response = await api.put(`/machines/models/${modelId}`, data);
    return response.data;
  },
  onSuccess: async () => {
    // Invalidate machine-related queries
    await invalidateMachineQueries(queryClient);
    toast.success(translate('notifications.machineModelUpdated'));
    navigate('/machines');
  },
  onError: (error) => {
    toast.error(translate('errors.failedToUpdateMachineModel'));
  }
});
```

### 4. Delete Work Order

```javascript
const deleteMutation = useMutation({
  mutationFn: async (workOrderId) => {
    const response = await api.delete(`/work-orders/${workOrderId}`);
    return response.data;
  },
  onSuccess: async () => {
    // Invalidate work order queries
    await invalidateWorkOrderQueries(queryClient, 'non-warranty');
    // Also invalidate dashboard since work orders affect stats
    await invalidateDashboardQueries(queryClient);
    toast.success(translate('notifications.workOrderDeleted'));
  },
  onError: (error) => {
    toast.error(translate('errors.failedToDeleteWorkOrder'));
  }
});
```

## Global Patterns

### Pattern 1: Entity Creation
- Invalidate the entity's main queries
- Invalidate related queries (e.g., dashboard stats)
- Show success message
- Navigate to list page

### Pattern 2: Entity Update
- Invalidate the entity's main queries
- Invalidate related queries
- Show success message
- Stay on current page or navigate back

### Pattern 3: Entity Deletion
- Invalidate the entity's main queries
- Invalidate related queries (e.g., dashboard stats)
- Show success message
- Navigate to list page

### Pattern 4: Complex Operations
- Invalidate all related entity queries
- Invalidate dashboard/analytics queries
- Show success message
- Navigate appropriately

## Best Practices

1. **Always use the utility functions** instead of manual `invalidateQueries` calls
2. **Invalidate related queries** when operations affect multiple entities
3. **Use `forceRefetch: true`** for immediate UI updates
4. **Add `additionalKeys`** for related queries that should be invalidated
5. **Handle errors gracefully** with appropriate error messages
6. **Use toast notifications** for user feedback
7. **Navigate appropriately** after successful operations

## Query Key Naming Convention

Use consistent query key naming:

- `customers` - Customer list queries
- `customer-details` - Individual customer details
- `customer-machines` - Customer's machines
- `machine-models` - Machine model list
- `machines` - Individual machine queries
- `work-orders` - Work order list
- `warranty-work-orders` - Warranty work order list
- `repair-tickets` - Repair ticket list
- `warranty-repair-tickets` - Warranty repair ticket list
- `inventory` - Inventory list
- `users` - User list
- `dashboard` - Dashboard data
- `notifications` - Notification data

## Testing

To test that cache invalidation is working:

1. Open browser developer tools
2. Go to Network tab
3. Perform an operation (create, update, delete)
4. Verify that related queries are refetched
5. Check that UI updates immediately without manual refresh

## Troubleshooting

If cache invalidation isn't working:

1. Check that query keys match between queries and invalidation calls
2. Verify that `queryClient` is properly passed to utility functions
3. Ensure that mutations are using `async/await` for invalidation
4. Check browser console for any errors
5. Verify that React Query is properly configured in the app
