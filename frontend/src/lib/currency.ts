/**
 * Currency formatting utilities for the RepairShop application
 * Uses KM (BAM) currency format with value on the left and "KM" on the right
 */

/**
 * Formats a number as currency with KM suffix
 * @param amount - The amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string (e.g., "1,480.50 KM")
 */
export function formatCurrency(amount: number | string, decimals: number = 2): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return '0.00 KM';
  }

  // Format the number with proper thousands separators and decimal places
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numAmount);

  return `${formattedNumber} KM`;
}

/**
 * Formats a number as currency without decimal places (for whole numbers)
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "1,480 KM")
 */
export function formatCurrencyWhole(amount: number | string): string {
  return formatCurrency(amount, 0);
}

/**
 * Formats a number as currency with 1 decimal place
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "1,480.5 KM")
 */
export function formatCurrencyOneDecimal(amount: number | string): string {
  return formatCurrency(amount, 1);
}

/**
 * Formats a number as currency for chart tooltips and compact displays
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "1,480.50 KM")
 */
export function formatCurrencyCompact(amount: number | string): string {
  return formatCurrency(amount, 2);
}
