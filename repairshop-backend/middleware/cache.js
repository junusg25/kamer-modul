const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

/**
 * Cache middleware for Express routes
 * @param {number} ttlSeconds - Time to live in seconds
 * @param {function} keyGenerator - Function to generate cache key from request
 * @param {function} condition - Function to determine if response should be cached
 */
const cacheMiddleware = (ttlSeconds = 300, keyGenerator, condition) => {
  return async (req, res, next) => {
    try {
      // Generate cache key
      const cacheKey = keyGenerator 
        ? keyGenerator(req) 
        : `route:${req.method}:${req.originalUrl}:${JSON.stringify(req.query)}`;

      // Try to get cached response
      const cachedResponse = await cacheService.get(cacheKey);
      
      if (cachedResponse) {
        logger.debug(`Cache hit for ${cacheKey}`);
        return res.json(cachedResponse);
      }

      // Store original res.json method
      const originalJson = res.json;
      
      // Override res.json to cache the response
      res.json = function(body) {
        // Check if response should be cached
        const shouldCache = condition ? condition(req, res, body) : res.statusCode === 200;
        
        if (shouldCache && body) {
          cacheService.set(cacheKey, body, ttlSeconds)
            .then(() => logger.debug(`Cached response for ${cacheKey}`))
            .catch(err => logger.error('Cache set error:', err));
        }
        
        // Call original res.json
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next(); // Continue without caching on error
    }
  };
};

/**
 * Cache invalidation middleware
 * @param {string|function} pattern - Pattern to clear or function to generate patterns
 */
const invalidateCache = (pattern) => {
  return async (req, res, next) => {
    try {
      const patterns = typeof pattern === 'function' 
        ? pattern(req) 
        : [pattern];

      // Store original res.json method
      const originalJson = res.json;
      
      // Override res.json to invalidate cache after successful response
      res.json = function(body) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Invalidate cache patterns asynchronously
          patterns.forEach(async (p) => {
            try {
              await cacheService.clear(p);
              logger.debug(`Invalidated cache pattern: ${p}`);
            } catch (err) {
              logger.error('Cache invalidation error:', err);
            }
          });
        }
        
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Cache invalidation middleware error:', error);
      next(); // Continue without invalidation on error
    }
  };
};

/**
 * Predefined cache configurations for common scenarios
 */
const cacheConfigs = {
  // Short cache for frequently changing data
  short: (keyGen, condition) => cacheMiddleware(60, keyGen, condition), // 1 minute
  
  // Medium cache for moderately changing data
  medium: (keyGen, condition) => cacheMiddleware(300, keyGen, condition), // 5 minutes
  
  // Long cache for rarely changing data
  long: (keyGen, condition) => cacheMiddleware(1800, keyGen, condition), // 30 minutes
  
  // Very long cache for static data
  static: (keyGen, condition) => cacheMiddleware(3600, keyGen, condition), // 1 hour
};

/**
 * Key generators for common patterns
 */
const keyGenerators = {
  // Standard REST endpoint key
  restEndpoint: (req) => `api:${req.method}:${req.route.path}:${JSON.stringify(req.params)}:${JSON.stringify(req.query)}`,
  
  // User-specific key
  userSpecific: (req) => `user:${req.user?.id}:${req.method}:${req.route.path}:${JSON.stringify(req.params)}`,
  
  // Search results key
  search: (req) => `search:${req.route.path}:${JSON.stringify(req.query)}`,
  
  // Dashboard data key
  dashboard: (req) => `dashboard:${req.user?.id}:${JSON.stringify(req.query)}`,
};

/**
 * Cache conditions for common scenarios
 */
const cacheConditions = {
  // Only cache successful responses
  success: (req, res, body) => res.statusCode === 200 && body && body.status === 'success',
  
  // Only cache non-empty results
  nonEmpty: (req, res, body) => res.statusCode === 200 && body && body.data && 
    (Array.isArray(body.data) ? body.data.length > 0 : true),
  
  // Cache everything except errors
  noErrors: (req, res, body) => res.statusCode < 400,
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  cacheConfigs,
  keyGenerators,
  cacheConditions,
  cacheService
};
