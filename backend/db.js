// db.js
const { Pool } = require('pg');
const logger = require('./utils/logger');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD), // Ensure password is string
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Database query monitoring wrapper
const originalQuery = pool.query.bind(pool);
pool.query = async function(text, params) {
  const start = Date.now();
  
  try {
    const result = await originalQuery(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (> 1000ms)
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        query: text,
        params: params,
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }
    
    // Log all queries in development
    if (process.env.NODE_ENV === 'development') {
      logger.info('Database query', {
        query: text.replace(/\s+/g, ' ').trim(),
        params: params,
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Database query error', {
      query: text,
      params: params,
      duration: `${duration}ms`,
      error: error.message
    });
    throw error;
  }
};

// Pool event listeners for monitoring
pool.on('connect', (client) => {
  logger.info('New database client connected');
});

pool.on('error', (err, client) => {
  logger.error('Database pool error', { error: err.message });
});

pool.on('remove', (client) => {
  logger.info('Database client removed from pool');
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down database pool...');
  pool.end(() => {
    logger.info('Database pool has ended');
    process.exit(0);
  });
});

module.exports = pool;