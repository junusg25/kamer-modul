/**
 * Backend search utilities for fuzzy search and accent-insensitive search
 */

/**
 * Generate fuzzy search patterns based on input and configuration
 */
function generateSearchPatterns(searchTerm, patterns = ['partial', 'spaces', 'special_chars']) {
  const searchLower = searchTerm.toLowerCase().trim();
  const searchPatterns = [];
  
  // Original search pattern
  searchPatterns.push(`%${searchTerm}%`);
  
  patterns.forEach(pattern => {
    switch (pattern) {
      case 'partial':
        searchPatterns.push(`%${searchLower}%`);
        break;
        
      case 'spaces':
        searchPatterns.push(`%${searchLower.replace(/\s+/g, '%')}%`);
        break;
        
      case 'special_chars':
        searchPatterns.push(`%${searchLower.replace(/[^a-z0-9]/g, '')}%`);
        break;
        
      case 'accent_variations':
        const accentInsensitivePatterns = generateAccentVariations(searchLower);
        searchPatterns.push(...accentInsensitivePatterns);
        break;
        
      case 'ticket_numbers':
        const ticketPatterns = generateTicketNumberPatterns(searchLower);
        searchPatterns.push(...ticketPatterns);
        break;
        
      case 'machine_numbers':
        const machinePatterns = generateMachineNumberPatterns(searchLower);
        searchPatterns.push(...machinePatterns);
        break;
    }
  });
  
  // Remove duplicates
  return [...new Set(searchPatterns)];
}

/**
 * Generate accent-insensitive variations (četka = cekta)
 */
function generateAccentVariations(searchTerm) {
  const patterns = [];
  
  // Convert accented to non-accented
  const normalized = searchTerm
    .replace(/č/g, 'c')
    .replace(/ć/g, 'c')
    .replace(/š/g, 's')
    .replace(/ž/g, 'z')
    .replace(/đ/g, 'd')
    .replace(/Č/g, 'C')
    .replace(/Ć/g, 'C')
    .replace(/Š/g, 'S')
    .replace(/Ž/g, 'Z')
    .replace(/Đ/g, 'D');
    
  if (normalized !== searchTerm) {
    patterns.push(`%${normalized}%`);
  }
  
  // Convert non-accented to accented (reverse mapping)
  const accented = searchTerm
    .replace(/c/g, 'č')
    .replace(/c/g, 'ć')
    .replace(/s/g, 'š')
    .replace(/z/g, 'ž')
    .replace(/d/g, 'đ');
    
  if (accented !== searchTerm) {
    patterns.push(`%${accented}%`);
  }
  
  // Handle individual words
  const words = searchTerm.split(/\s+/).filter(w => w.length > 1);
  words.forEach(word => {
    const normalizedWord = word
      .replace(/č/g, 'c')
      .replace(/ć/g, 'c')
      .replace(/š/g, 's')
      .replace(/ž/g, 'z')
      .replace(/đ/g, 'd');
      
    if (normalizedWord !== word) {
      patterns.push(`%${normalizedWord}%`);
    }
  });
  
  return patterns;
}

/**
 * Generate ticket number patterns (tk01, 01/25, etc.)
 */
function generateTicketNumberPatterns(searchTerm) {
  const patterns = [];
  
  // Check if it matches ticket number patterns
  if (searchTerm.match(/^(tk|wo|wt|ww|ticket|work|order|warranty)?\s*(\d+)\s*(\/\d+)?\s*$/i)) {
    const numberMatch = searchTerm.match(/(\d+)/);
    if (numberMatch) {
      const number = numberMatch[1];
      const paddedNumber = number.padStart(2, '0');
      
      // Pattern 1: Exact formatted number (TK-01/25)
      patterns.push(`%TK-${paddedNumber}/25%`);
      patterns.push(`%WO-${paddedNumber}/25%`);
      patterns.push(`%WT-${paddedNumber}/25%`);
      patterns.push(`%WW-${paddedNumber}/25%`);
      
      // Pattern 2: Without prefix (01/25)
      patterns.push(`%${paddedNumber}/25%`);
      
      // Pattern 3: Just the number (01, 1)
      patterns.push(`%${paddedNumber}%`);
      patterns.push(`%${number}%`);
      
      // Pattern 4: With prefix variations (TK01, TK-01)
      patterns.push(`%TK${paddedNumber}%`);
      patterns.push(`%TK-${paddedNumber}%`);
      patterns.push(`%WO${paddedNumber}%`);
      patterns.push(`%WO-${paddedNumber}%`);
      patterns.push(`%WT${paddedNumber}%`);
      patterns.push(`%WT-${paddedNumber}%`);
      patterns.push(`%WW${paddedNumber}%`);
      patterns.push(`%WW-${paddedNumber}%`);
    }
  }
  
  return patterns;
}

/**
 * Generate machine number patterns (HD 5/15, HDS 8/18, etc.)
 */
function generateMachineNumberPatterns(searchTerm) {
  const patterns = [];
  
  // If it's just letters/spaces, add variations
  if (searchTerm.match(/^[a-z\s]+$/)) {
    const words = searchTerm.split(/\s+/).filter(w => w.length > 1);
    words.forEach(word => {
      patterns.push(`%${word}%`);
    });
  }
  
  return patterns;
}

/**
 * Build search conditions for a given search term and field configuration
 */
function buildSearchConditions(searchTerm, fields, patterns, paramStartIndex = 1) {
  if (!searchTerm) {
    return { condition: '', params: [] };
  }
  
  const searchPatterns = generateSearchPatterns(searchTerm, patterns);
  const searchConditions = [];
  const params = [];
  
  searchPatterns.forEach((pattern, index) => {
    const fieldConditions = fields.map(field => {
      let fieldCondition = '';
      
      if (field.accentInsensitive) {
        fieldCondition = `unaccent(${field.field}) ILIKE unaccent($${paramStartIndex + index})`;
      } else {
        fieldCondition = `${field.field} ILIKE $${paramStartIndex + index}`;
      }
      
      return fieldCondition;
    });
    
    searchConditions.push(`(${fieldConditions.join(' OR ')})`);
    params.push(pattern);
  });
  
  return {
    condition: searchConditions.join(' OR '),
    params
  };
}

/**
 * Search field configurations for different page types
 */
const searchFieldConfigs = {
  customers: [
    { field: 'c.name', accentInsensitive: true },
    { field: 'c.company_name', accentInsensitive: true },
    { field: 'c.contact_person', accentInsensitive: true },
    { field: 'c.email', accentInsensitive: false },
    { field: 'c.phone', accentInsensitive: false },
    { field: 'c.vat_number', accentInsensitive: false }
  ],
  
  machines: [
    { field: 'mm.name', accentInsensitive: true },
    { field: 'mm.catalogue_number', accentInsensitive: false },
    { field: 'mm.manufacturer', accentInsensitive: true }
  ],
  
  inventory: [
    { field: 'name', accentInsensitive: true },
    { field: 'description', accentInsensitive: true },
    { field: 'sku', accentInsensitive: false },
    { field: 'supplier', accentInsensitive: true }
  ],
  
  repairTickets: [
    { field: 'rt.formatted_number', accentInsensitive: false },
    { field: 'rt.ticket_number::text', accentInsensitive: false },
    { field: 'rt.problem_description', accentInsensitive: true },
    { field: 'rt.customer_name', accentInsensitive: true },
    { field: 'rt.model_name', accentInsensitive: true },
    { field: 'rt.submitted_by_name', accentInsensitive: true },
    { field: 'rt.converted_by_technician_name', accentInsensitive: true }
  ],
  
  workOrders: [
    { field: 'wo.formatted_number', accentInsensitive: false },
    { field: 'wo.ticket_number::text', accentInsensitive: false },
    { field: 'wo.description', accentInsensitive: true },
    { field: 'c.name', accentInsensitive: true },
    { field: 'mm.name', accentInsensitive: true }
  ],
  
  warrantyRepairTickets: [
    { field: 'wrt.formatted_number', accentInsensitive: false },
    { field: 'wrt.ticket_number::text', accentInsensitive: false },
    { field: 'wrt.problem_description', accentInsensitive: true },
    { field: 'wrt.customer_name', accentInsensitive: true },
    { field: 'wrt.model_name', accentInsensitive: true },
    { field: 'wrt.submitted_by_name', accentInsensitive: true },
    { field: 'wrt.converted_by_technician_name', accentInsensitive: true }
  ],
  
  warrantyWorkOrders: [
    { field: 'wwo.formatted_number', accentInsensitive: false },
    { field: 'wwo.ticket_number::text', accentInsensitive: false },
    { field: 'wwo.description', accentInsensitive: true },
    { field: 'c.name', accentInsensitive: true },
    { field: 'mm.name', accentInsensitive: true }
  ]
};

/**
 * Get search configuration for a specific page type
 */
function getSearchConfig(pageType) {
  const configs = {
    customers: { patterns: ['partial', 'spaces', 'special_chars', 'accent_variations'] },
    machines: { patterns: ['partial', 'spaces', 'special_chars', 'machine_numbers'] },
    inventory: { patterns: ['partial', 'spaces', 'special_chars', 'accent_variations'] },
    repairTickets: { patterns: ['partial', 'spaces', 'special_chars', 'ticket_numbers', 'accent_variations'] },
    workOrders: { patterns: ['partial', 'spaces', 'special_chars', 'ticket_numbers', 'accent_variations'] },
    warrantyRepairTickets: { patterns: ['partial', 'spaces', 'special_chars', 'ticket_numbers', 'accent_variations'] },
    warrantyWorkOrders: { patterns: ['partial', 'spaces', 'special_chars', 'ticket_numbers', 'accent_variations'] }
  };
  
  return {
    fields: searchFieldConfigs[pageType] || searchFieldConfigs.customers,
    patterns: configs[pageType]?.patterns || configs.customers.patterns
  };
}

/**
 * Main function to build search conditions for any page type
 */
function buildSmartSearchConditions(searchTerm, pageType, paramStartIndex = 1) {
  if (!searchTerm) {
    return { condition: '', params: [] };
  }
  
  const config = getSearchConfig(pageType);
  return buildSearchConditions(searchTerm, config.fields, config.patterns, paramStartIndex);
}

module.exports = {
  generateSearchPatterns,
  generateAccentVariations,
  generateTicketNumberPatterns,
  generateMachineNumberPatterns,
  buildSearchConditions,
  buildSmartSearchConditions,
  getSearchConfig
};
