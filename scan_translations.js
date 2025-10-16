const fs = require('fs');
const path = require('path');

// Define directories to scan
const scanDirs = [
  'frontend/src/pages',
  'frontend/src/components',
  'frontend/src/hooks',
  'frontend/src/contexts'
];

// Patterns to find hardcoded strings
const stringPatterns = [
  /['"`]([A-Z][^'"`]*?)['"`]/g, // Capitalized strings in quotes
  /placeholder=['"`]([^'"`]*?)['"`]/g, // Placeholder attributes
  /title=['"`]([^'"`]*?)['"`]/g, // Title attributes
  /aria-label=['"`]([^'"`]*?)['"`]/g, // Aria-label attributes
  />{([^}]*?)}</g, // JSX content between tags
];

// Strings to ignore (common React/JS patterns)
const ignorePatterns = [
  /^[a-z][a-z0-9]*$/i, // camelCase variables
  /^[A-Z][a-z0-9]*$/i, // PascalCase components
  /^[a-z]+$/i, // Single lowercase words
  /^\d+$/, // Numbers
  /^[{}[\]]$/, // Brackets
  /^[()]$/, // Parentheses
  /^[.,;:!?]$/, // Punctuation
  /^[+\-*/=<>!&|]$/, // Operators
  /^css|className|style|id|key$/i, // React props
  /^use[A-Z]/, // React hooks
  /^on[A-Z]/, // Event handlers
  /^data-/, // Data attributes
  /^aria-/, // Aria attributes
  /^https?:\/\//, // URLs
  /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i, // Emails
  /^\$[a-zA-Z_][a-zA-Z0-9_]*$/, // Variables with $
  /^[A-Z_][A-Z0-9_]*$/, // Constants
  /^[a-z]+-[a-z]+$/i, // Kebab-case
];

// Translation keys found
const translationKeys = new Map();
const keyCount = {};

function shouldIgnore(str) {
  if (str.length < 2) return true;
  if (str.length > 100) return true;
  
  return ignorePatterns.some(pattern => pattern.test(str));
}

function generateKey(str, filePath) {
  // Clean the string
  const cleaned = str.trim();
  
  // Determine namespace based on file path
  let namespace = 'common';
  if (filePath.includes('/pages/')) {
    const pageName = path.basename(filePath, '.tsx');
    namespace = `pages.${pageName}`;
  } else if (filePath.includes('/components/')) {
    const componentName = path.basename(filePath, '.tsx');
    namespace = `components.${componentName}`;
  } else if (filePath.includes('/hooks/')) {
    const hookName = path.basename(filePath, '.ts');
    namespace = `hooks.${hookName}`;
  } else if (filePath.includes('/contexts/')) {
    const contextName = path.basename(filePath, '.tsx');
    namespace = `contexts.${contextName}`;
  }
  
  // Generate a key based on the string content
  let key = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  
  // Ensure uniqueness
  const fullKey = `${namespace}.${key}`;
  if (keyCount[fullKey]) {
    keyCount[fullKey]++;
    key = `${key}_${keyCount[fullKey]}`;
  } else {
    keyCount[fullKey] = 1;
  }
  
  return `${namespace}.${key}`;
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const strings = new Set();
    
    // Extract strings using patterns
    stringPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const str = match[1] || match[0];
        if (str && !shouldIgnore(str) && str.length > 1) {
          strings.add(str);
        }
      }
    });
    
    // Process found strings
    strings.forEach(str => {
      const key = generateKey(str, filePath);
      if (!translationKeys.has(key)) {
        translationKeys.set(key, {
          english: str,
          bosnian: '',
          file: filePath,
          usage: []
        });
      }
      translationKeys.get(key).usage.push(filePath);
    });
    
  } catch (error) {
    console.error(`Error scanning ${filePath}:`, error.message);
  }
}

function scanDirectory(dir) {
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    files.forEach(file => {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        scanDirectory(fullPath);
      } else if (file.isFile() && (file.name.endsWith('.tsx') || file.name.endsWith('.ts'))) {
        scanFile(fullPath);
      }
    });
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error.message);
  }
}

// Start scanning
console.log('🔍 Scanning frontend files for translation keys...\n');

scanDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`📁 Scanning ${dir}...`);
    scanDirectory(dir);
  } else {
    console.log(`⚠️  Directory not found: ${dir}`);
  }
});

// Generate results
const results = {
  total: translationKeys.size,
  byNamespace: {},
  keys: []
};

translationKeys.forEach((value, key) => {
  const [namespace] = key.split('.');
  if (!results.byNamespace[namespace]) {
    results.byNamespace[namespace] = 0;
  }
  results.byNamespace[namespace]++;
  
  results.keys.push({
    key,
    english: value.english,
    bosnian: value.bosnian,
    files: [...new Set(value.usage)]
  });
});

// Sort keys alphabetically
results.keys.sort((a, b) => a.key.localeCompare(b.key));

// Write results to file
fs.writeFileSync('translation_keys_scan.json', JSON.stringify(results, null, 2));

console.log('\n✅ Scan complete!');
console.log(`📊 Found ${results.total} translation keys`);
console.log('\n📈 By namespace:');
Object.entries(results.byNamespace)
  .sort(([,a], [,b]) => b - a)
  .forEach(([namespace, count]) => {
    console.log(`  ${namespace}: ${count} keys`);
  });

console.log('\n📄 Results saved to: translation_keys_scan.json');
console.log('\n🔧 Next steps:');
console.log('1. Review the generated keys');
console.log('2. Add keys to translation files');
console.log('3. Update Translation Management');
console.log('4. Implement translations in code');
