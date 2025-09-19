const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runMigration() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.error('Usage: node run-migration.js <migration-file>');
    process.exit(1);
  }
  
  const migrationPath = path.join(__dirname, 'db', 'migrations', migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }
  
  try {
    console.log(`Running migration: ${migrationFile}`);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Handle PostgreSQL functions with dollar-quoted strings
    const statements = [];
    let currentStatement = '';
    let inDollarQuote = false;
    let dollarTag = '';
    
    const lines = migrationSQL.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('--') || trimmedLine === '') {
        continue;
      }
      
      // Check for dollar-quoted strings
      if (trimmedLine.includes('$$')) {
        if (!inDollarQuote) {
          // Starting dollar quote
          const parts = trimmedLine.split('$$');
          dollarTag = parts[0].includes('$') ? parts[0].substring(parts[0].lastIndexOf('$')) : '$$';
          inDollarQuote = true;
          currentStatement += line + '\n';
        } else {
          // Ending dollar quote
          inDollarQuote = false;
          currentStatement += line + '\n';
          if (currentStatement.trim()) {
            statements.push(currentStatement.trim());
            currentStatement = '';
          }
        }
      } else if (inDollarQuote) {
        // Inside dollar quote, just add the line
        currentStatement += line + '\n';
      } else if (trimmedLine.endsWith(';')) {
        // Regular statement ending with semicolon
        currentStatement += line;
        if (currentStatement.trim()) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
      } else {
        // Regular line, add to current statement
        currentStatement += line + '\n';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing statement...');
        await db.query(statement);
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();
