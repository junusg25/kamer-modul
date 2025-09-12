/**
 * Date and time formatting utilities for the RepairShop application
 * Uses European format: dd.mm.yyyy for dates and 24-hour format for times
 */

/**
 * Formats a date string to European format (dd.mm.yyyy)
 * @param dateString - The date string to format
 * @returns Formatted date string (e.g., "15.03.2024")
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) {
    return 'N/A';
  }
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
}

/**
 * Formats a date string to European format with time (dd.mm.yyyy HH:mm)
 * @param dateString - The date string to format
 * @returns Formatted date and time string (e.g., "15.03.2024 14:30")
 */
export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) {
    return 'N/A';
  }
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Formats a date string to time only in 24-hour format (HH:mm)
 * @param dateString - The date string to format
 * @returns Formatted time string (e.g., "14:30")
 */
export function formatTime(dateString: string | Date | null | undefined): string {
  if (!dateString) {
    return 'N/A';
  }
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return 'Invalid Time';
  }

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${hours}:${minutes}`;
}

/**
 * Formats a date string to short European format (dd.mm.yyyy) for chart tooltips
 * @param dateString - The date string to format
 * @returns Formatted date string (e.g., "15.03.2024")
 */
export function formatDateShort(dateString: string | Date | null | undefined): string {
  return formatDate(dateString);
}

/**
 * Formats a date string to medium European format (dd MMM yyyy) for display
 * @param dateString - The date string to format
 * @returns Formatted date string (e.g., "15 Mar 2024")
 */
export function formatDateMedium(dateString: string | Date | null | undefined): string {
  if (!dateString) {
    return 'N/A';
  }
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Formats a date string to long European format (dd MMMM yyyy) for display
 * @param dateString - The date string to format
 * @returns Formatted date string (e.g., "15 March 2024")
 */
export function formatDateLong(dateString: string | Date | null | undefined): string {
  if (!dateString) {
    return 'N/A';
  }
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Checks if a date is overdue (in the past)
 * @param dateString - The date string to check
 * @returns True if the date is in the past
 */
export function isOverdue(dateString: string | Date | null | undefined): boolean {
  if (!dateString) {
    return false;
  }
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date < new Date();
}

/**
 * Formats a date for input fields (yyyy-mm-dd format)
 * @param dateString - The date string to format
 * @returns Formatted date string for input fields (e.g., "2024-03-15")
 */
export function formatDateForInput(dateString: string | Date | null | undefined): string {
  if (!dateString) {
    return '';
  }
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().split('T')[0];
}

/**
 * Parses a European date string (dd.mm.yyyy) to a Date object
 * @param dateString - The European date string to parse
 * @returns Date object or null if invalid
 */
export function parseEuropeanDate(dateString: string): Date | null {
  const parts = dateString.split('.');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const year = parseInt(parts[2], 10);
  
  const date = new Date(year, month, day);
  
  // Check if the date is valid
  if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
    return null;
  }
  
  return date;
}
