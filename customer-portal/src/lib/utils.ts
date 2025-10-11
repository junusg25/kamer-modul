import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    // Format as dd.mm.yyyy
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
  } catch {
    return 'Invalid date';
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    // Format as dd.mm.yyyy HH:mm
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return 'Invalid date';
  }
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'N/A';
  
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'BAM',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace('BAM', 'KM');
}

export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    // Repair Tickets & Work Orders
    'intake': 'bg-yellow-100 text-yellow-800',
    'pending': 'bg-amber-100 text-amber-800',
    'in_progress': 'bg-blue-100 text-blue-800',
    'on_hold': 'bg-orange-100 text-orange-800',
    'completed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-gray-100 text-gray-800',
    'converted': 'bg-purple-100 text-purple-800',
    
    // Quotes
    'draft': 'bg-gray-100 text-gray-800',
    'sent': 'bg-blue-100 text-blue-800',
    'viewed': 'bg-indigo-100 text-indigo-800',
    'accepted': 'bg-green-100 text-green-800',
    'declined': 'bg-red-100 text-red-800',
    'expired': 'bg-orange-100 text-orange-800',
  };

  return statusColors[status.toLowerCase()] || 'bg-gray-100 text-gray-800';
}

export function getStatusLabel(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getPriorityColor(priority: string): string {
  const priorityColors: Record<string, string> = {
    'low': 'bg-green-100 text-green-800',
    'medium': 'bg-yellow-100 text-yellow-800',
    'high': 'bg-orange-100 text-orange-800',
    'urgent': 'bg-red-100 text-red-800',
  };

  return priorityColors[priority.toLowerCase()] || 'bg-gray-100 text-gray-800';
}

export function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'repair_ticket': 'Repair Ticket',
    'warranty_ticket': 'Warranty Ticket',
    'work_order': 'Work Order',
    'warranty_work_order': 'Warranty Work Order',
    'quote': 'Quote',
  };

  return labels[type] || type;
}

export function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    'repair_ticket': '🎫',
    'warranty_ticket': '🛡️',
    'work_order': '🔧',
    'warranty_work_order': '⚙️',
    'quote': '📄',
  };

  return icons[type] || '📋';
}

