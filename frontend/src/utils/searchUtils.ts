/**
 * Search utilities for fuzzy search and accent-insensitive search
 */

export interface SearchField {
  field: string;
  label: string;
  fuzzy?: boolean;
  accentInsensitive?: boolean;
  exactMatch?: boolean;
}

export interface SearchConfig {
  fields: SearchField[];
  patterns: SearchPattern[];
  accentInsensitive: boolean;
  debounceMs?: number;
}

export type SearchPattern = 
  | 'partial' 
  | 'spaces' 
  | 'special_chars' 
  | 'accent_variations'
  | 'ticket_numbers'
  | 'machine_numbers';

/**
 * Generate fuzzy search patterns based on input and configuration
 */
export function generateSearchPatterns(
  searchTerm: string, 
  patterns: SearchPattern[] = ['partial', 'spaces', 'special_chars']
): string[] {
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
function generateAccentVariations(searchTerm: string): string[] {
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
function generateTicketNumberPatterns(searchTerm: string): string[] {
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
function generateMachineNumberPatterns(searchTerm: string): string[] {
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
 * Build SQL search conditions for multiple patterns
 */
export function buildSearchConditions(
  patterns: string[],
  fields: SearchField[],
  paramStartIndex: number = 1
): { condition: string; params: string[] } {
  const searchConditions = [];
  const params = [];
  
  patterns.forEach((pattern, index) => {
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
 * Client-side accent-insensitive search normalization
 * Converts accented characters to their base forms for searching
 */
export function normalizeAccents(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[čćđšž]/g, match => {
      const map: { [key: string]: string } = {
        'č': 'c', 'ć': 'c', 'đ': 'd', 'š': 's', 'ž': 'z'
      }
      return map[match] || match
    })
}

/**
 * Client-side accent-insensitive search function
 * Returns true if the search term matches the target text
 */
export function matchesAccentInsensitive(searchTerm: string, targetText: string): boolean {
  if (!searchTerm || !targetText) return false
  
  const normalizedSearch = normalizeAccents(searchTerm)
  const normalizedTarget = normalizeAccents(targetText)
  
  return normalizedTarget.includes(normalizedSearch)
}

/**
 * Debounce function for search input
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
