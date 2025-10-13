/**
 * Search configurations for different page types
 */

import { SearchConfig, SearchField, SearchPattern } from '../utils/searchUtils';

export const searchConfigs: Record<string, SearchConfig> = {
  // Customers page
  customers: {
    fields: [
      { field: 'name', label: 'Name', fuzzy: true, accentInsensitive: true },
      { field: 'company_name', label: 'Company', fuzzy: true, accentInsensitive: true },
      { field: 'contact_person', label: 'Contact Person', fuzzy: true, accentInsensitive: true },
      { field: 'email', label: 'Email', fuzzy: false },
      { field: 'phone', label: 'Phone', fuzzy: false },
      { field: 'vat_number', label: 'VAT Number', fuzzy: false }
    ],
    patterns: ['partial', 'spaces', 'special_chars', 'accent_variations'],
    accentInsensitive: true,
    debounceMs: 300
  },

  // Machines page
  machines: {
    fields: [
      { field: 'name', label: 'Machine Name', fuzzy: true, accentInsensitive: true },
      { field: 'serial_number', label: 'Serial Number', fuzzy: true },
      { field: 'catalogue_number', label: 'Catalogue Number', fuzzy: true },
      { field: 'manufacturer', label: 'Manufacturer', fuzzy: true, accentInsensitive: true }
    ],
    patterns: ['partial', 'spaces', 'special_chars', 'machine_numbers'],
    accentInsensitive: true,
    debounceMs: 300
  },

  // Inventory page
  inventory: {
    fields: [
      { field: 'name', label: 'Item Name', fuzzy: true, accentInsensitive: true },
      { field: 'description', label: 'Description', fuzzy: true, accentInsensitive: true },
      { field: 'sku', label: 'SKU', fuzzy: true },
      { field: 'supplier', label: 'Supplier', fuzzy: true, accentInsensitive: true }
    ],
    patterns: ['partial', 'spaces', 'special_chars', 'accent_variations'],
    accentInsensitive: true,
    debounceMs: 300
  },

  // Repair Tickets page
  repairTickets: {
    fields: [
      { field: 'formatted_number', label: 'Ticket Number', fuzzy: true },
      { field: 'ticket_number', label: 'Ticket ID', fuzzy: true },
      { field: 'problem_description', label: 'Problem', fuzzy: true, accentInsensitive: true },
      { field: 'customer_name', label: 'Customer', fuzzy: true, accentInsensitive: true },
      { field: 'model_name', label: 'Machine Model', fuzzy: true, accentInsensitive: true },
      { field: 'submitted_by_name', label: 'Submitted By', fuzzy: true, accentInsensitive: true },
      { field: 'converted_by_technician_name', label: 'Technician', fuzzy: true, accentInsensitive: true }
    ],
    patterns: ['partial', 'spaces', 'special_chars', 'ticket_numbers', 'accent_variations'],
    accentInsensitive: true,
    debounceMs: 300
  },

  // Work Orders page
  workOrders: {
    fields: [
      { field: 'formatted_number', label: 'Work Order Number', fuzzy: true },
      { field: 'ticket_number', label: 'Order ID', fuzzy: true },
      { field: 'description', label: 'Description', fuzzy: true, accentInsensitive: true },
      { field: 'customer_name', label: 'Customer', fuzzy: true, accentInsensitive: true },
      { field: 'model_name', label: 'Machine Model', fuzzy: true, accentInsensitive: true }
    ],
    patterns: ['partial', 'spaces', 'special_chars', 'ticket_numbers', 'accent_variations'],
    accentInsensitive: true,
    debounceMs: 300
  },

  // Warranty Repair Tickets page
  warrantyRepairTickets: {
    fields: [
      { field: 'formatted_number', label: 'Warranty Ticket Number', fuzzy: true },
      { field: 'ticket_number', label: 'Ticket ID', fuzzy: true },
      { field: 'problem_description', label: 'Problem', fuzzy: true, accentInsensitive: true },
      { field: 'customer_name', label: 'Customer', fuzzy: true, accentInsensitive: true },
      { field: 'model_name', label: 'Machine Model', fuzzy: true, accentInsensitive: true },
      { field: 'submitted_by_name', label: 'Submitted By', fuzzy: true, accentInsensitive: true },
      { field: 'converted_by_technician_name', label: 'Technician', fuzzy: true, accentInsensitive: true }
    ],
    patterns: ['partial', 'spaces', 'special_chars', 'ticket_numbers', 'accent_variations'],
    accentInsensitive: true,
    debounceMs: 300
  },

  // Warranty Work Orders page
  warrantyWorkOrders: {
    fields: [
      { field: 'formatted_number', label: 'Warranty Work Order Number', fuzzy: true },
      { field: 'ticket_number', label: 'Order ID', fuzzy: true },
      { field: 'description', label: 'Description', fuzzy: true, accentInsensitive: true },
      { field: 'customer_name', label: 'Customer', fuzzy: true, accentInsensitive: true },
      { field: 'model_name', label: 'Machine Model', fuzzy: true, accentInsensitive: true }
    ],
    patterns: ['partial', 'spaces', 'special_chars', 'ticket_numbers', 'accent_variations'],
    accentInsensitive: true,
    debounceMs: 300
  },

  // Pipeline & Leads page
  pipelineLeads: {
    fields: [
      { field: 'company_name', label: 'Company', fuzzy: true, accentInsensitive: true },
      { field: 'contact_person', label: 'Contact Person', fuzzy: true, accentInsensitive: true },
      { field: 'email', label: 'Email', fuzzy: false },
      { field: 'phone', label: 'Phone', fuzzy: false },
      { field: 'notes', label: 'Notes', fuzzy: true, accentInsensitive: true }
    ],
    patterns: ['partial', 'spaces', 'special_chars', 'accent_variations'],
    accentInsensitive: true,
    debounceMs: 300
  },

  // Quote Management page
  quoteManagement: {
    fields: [
      { field: 'quote_number', label: 'Quote Number', fuzzy: true },
      { field: 'customer_name', label: 'Customer', fuzzy: true, accentInsensitive: true },
      { field: 'description', label: 'Description', fuzzy: true, accentInsensitive: true },
      { field: 'status', label: 'Status', fuzzy: true }
    ],
    patterns: ['partial', 'spaces', 'special_chars', 'accent_variations'],
    accentInsensitive: true,
    debounceMs: 300
  },

  // Rental Fleet page
  rentalFleet: {
    fields: [
      { field: 'name', label: 'Machine Name', fuzzy: true, accentInsensitive: true },
      { field: 'model', label: 'Model', fuzzy: true, accentInsensitive: true },
      { field: 'serial_number', label: 'Serial Number', fuzzy: true },
      { field: 'status', label: 'Status', fuzzy: true }
    ],
    patterns: ['partial', 'spaces', 'special_chars', 'machine_numbers', 'accent_variations'],
    accentInsensitive: true,
    debounceMs: 300
  },

  // Active Rentals page
  activeRentals: {
    fields: [
      { field: 'customer_name', label: 'Customer', fuzzy: true, accentInsensitive: true },
      { field: 'machine_name', label: 'Machine', fuzzy: true, accentInsensitive: true },
      { field: 'rental_number', label: 'Rental Number', fuzzy: true },
      { field: 'status', label: 'Status', fuzzy: true }
    ],
    patterns: ['partial', 'spaces', 'special_chars', 'accent_variations'],
    accentInsensitive: true,
    debounceMs: 300
  }
};

/**
 * Get search configuration for a specific page
 */
export function getSearchConfig(pageType: string): SearchConfig {
  return searchConfigs[pageType] || searchConfigs.customers; // fallback to customers config
}
