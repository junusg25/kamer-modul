/**
 * Status formatting utilities for the RepairShop application
 * Converts database status values to user-friendly display text
 */

/**
 * Formats a status string to user-friendly display text
 * Removes underscores and capitalizes words
 * @param status - The status string to format
 * @returns Formatted status string (e.g., "in_progress" -> "In Progress")
 */
export function formatStatus(status: string): string {
  if (!status) return 'Unknown'
  
  // Handle special cases first
  const specialCases: Record<string, string> = {
    'in_progress': 'In Progress',
    'converted - warranty': 'Converted - Warranty',
    'warranty_declined': 'Warranty Declined',
    'low_stock': 'Low Stock',
    'out_of_stock': 'Out of Stock',
    'warranty_expiring': 'Warranty Expiring',
    'needs_improvement': 'Needs Improvement'
  }
  
  // Check for special cases
  if (specialCases[status]) {
    return specialCases[status]
  }
  
  // Default formatting: replace underscores with spaces and capitalize words
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Gets the appropriate badge variant for a status
 * @param status - The status string
 * @returns Badge variant string
 */
export function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    // Work order statuses
    'pending': 'outline',
    'in_progress': 'secondary',
    'completed': 'default',
    'cancelled': 'destructive',
    'intake': 'outline',
    'testing': 'outline',
    'parts_ordered': 'outline',
    'waiting_approval': 'outline',
    'waiting_supplier': 'outline',
    'service_cancelled': 'destructive',
    'quoted': 'outline',
    'awaiting_approval': 'outline',
    'declined': 'destructive',
    'ready_for_pickup': 'default',
    'warranty_declined': 'destructive',
    
    // Repair ticket statuses
    'open': 'outline',
    'converted': 'default',
    'converted - warranty': 'default',
    
    // Quote statuses
    'draft': 'outline',
    'sent': 'secondary',
    'viewed': 'secondary',
    'accepted': 'default',
    'expired': 'destructive',
    
    // Customer statuses
    'active': 'default',
    'inactive': 'outline',
    
    // Inventory statuses
    'low_stock': 'destructive',
    'out_of_stock': 'destructive',
    'in_stock': 'default',
    
    // Lead statuses
    'new': 'outline',
    'contacted': 'secondary',
    'qualified': 'secondary',
    'proposal': 'secondary',
    'negotiation': 'secondary',
    'closed_won': 'default',
    'closed_lost': 'destructive',
    
    // Performance statuses
    'excellent': 'default',
    'good': 'default',
    'average': 'secondary',
    'needs_improvement': 'destructive'
  }
  
  return statusVariants[status] || 'outline'
}

/**
 * Gets the appropriate badge color class for a status
 * @param status - The status string
 * @returns CSS class string for badge styling
 */
export function getStatusBadgeColor(status: string): string {
  const statusColors: Record<string, string> = {
    // Work order statuses
    'pending': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'in_progress': 'bg-blue-50 text-blue-700 border-blue-200',
    'completed': 'bg-green-50 text-green-700 border-green-200',
    'cancelled': 'bg-red-50 text-red-700 border-red-200',
    'intake': 'bg-orange-50 text-orange-700 border-orange-200',
    'testing': 'bg-purple-50 text-purple-700 border-purple-200',
    'parts_ordered': 'bg-orange-50 text-orange-700 border-orange-200',
    'waiting_approval': 'bg-amber-50 text-amber-700 border-amber-200',
    'waiting_supplier': 'bg-red-50 text-red-700 border-red-200',
    'service_cancelled': 'bg-red-50 text-red-700 border-red-200',
    'quoted': 'bg-blue-50 text-blue-700 border-blue-200',
    'awaiting_approval': 'bg-amber-50 text-amber-700 border-amber-200',
    'declined': 'bg-red-50 text-red-700 border-red-200',
    'ready_for_pickup': 'bg-green-50 text-green-700 border-green-200',
    'warranty_declined': 'bg-red-50 text-red-700 border-red-200',
    
    // Repair ticket statuses
    'open': 'bg-orange-50 text-orange-700 border-orange-200',
    'converted': 'bg-green-50 text-green-700 border-green-200',
    'converted - warranty': 'bg-green-50 text-green-700 border-green-200',
    
    // Quote statuses
    'draft': 'bg-gray-50 text-gray-700 border-gray-200',
    'sent': 'bg-blue-50 text-blue-700 border-blue-200',
    'viewed': 'bg-purple-50 text-purple-700 border-purple-200',
    'accepted': 'bg-green-50 text-green-700 border-green-200',
    'expired': 'bg-red-50 text-red-700 border-red-200',
    
    // Customer statuses
    'active': 'bg-green-50 text-green-700 border-green-200',
    'inactive': 'bg-gray-50 text-gray-700 border-gray-200',
    
    // Inventory statuses
    'low_stock': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'out_of_stock': 'bg-red-50 text-red-700 border-red-200',
    'in_stock': 'bg-green-50 text-green-700 border-green-200',
    
    // Lead statuses
    'new': 'bg-blue-50 text-blue-700 border-blue-200',
    'contacted': 'bg-purple-50 text-purple-700 border-purple-200',
    'qualified': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'proposal': 'bg-pink-50 text-pink-700 border-pink-200',
    'negotiation': 'bg-orange-50 text-orange-700 border-orange-200',
    'closed_won': 'bg-green-50 text-green-700 border-green-200',
    'closed_lost': 'bg-red-50 text-red-700 border-red-200',
    
    // Performance statuses
    'excellent': 'bg-green-50 text-green-700 border-green-200',
    'good': 'bg-blue-50 text-blue-700 border-blue-200',
    'average': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'needs_improvement': 'bg-red-50 text-red-700 border-red-200'
  }
  
  return statusColors[status] || 'bg-gray-50 text-gray-700 border-gray-200'
}
