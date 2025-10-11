const fs = require('fs');
const path = require('path');

// Recursively find all .ts and .tsx files
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and build directories
      if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== 'build') {
        findFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Remove console.log, console.debug, console.info, console.warn
// Keep console.error for critical errors
function removeConsoleLogs(content) {
  // Match console.log, console.debug, console.info, console.warn statements
  // This regex handles:
  // - Single line: console.log('message')
  // - Multi-line: console.log('message', \n  variable)
  // - With semicolons or without
  
  let modified = content;
  
  // Remove console.log/debug/info/warn with their complete statements
  const patterns = [
    /console\.(log|debug|info|warn)\([^)]*\);?\n?/g,
    /console\.(log|debug|info|warn)\([^)]*\)[^;\n]*;?\n?/g,
  ];
  
  patterns.forEach(pattern => {
    modified = modified.replace(pattern, '');
  });
  
  // Handle multi-line console statements
  // Match console.log( ... ) across multiple lines
  modified = modified.replace(/console\.(log|debug|info|warn)\([^)]*?(?:\([^)]*\)[^)]*?)*\);?\n?/gs, '');
  
  return modified;
}

// Process all files
const srcDir = path.join(__dirname, 'src');
const files = findFiles(srcDir);

let totalRemoved = 0;
let filesModified = 0;

files.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const modified = removeConsoleLogs(content);
    
    if (content !== modified) {
      fs.writeFileSync(file, modified, 'utf8');
      const removed = (content.match(/console\.(log|debug|info|warn)/g) || []).length;
      totalRemoved += removed;
      filesModified++;
      console.log(`✓ ${path.relative(srcDir, file)}: Removed ${removed} console statements`);
    }
  } catch (error) {
    console.error(`✗ Error processing ${file}:`, error.message);
  }
});

console.log(`\n✅ Done! Modified ${filesModified} files, removed ${totalRemoved} console statements.`);
console.log(`⚠️  console.error statements were preserved for debugging.`);

