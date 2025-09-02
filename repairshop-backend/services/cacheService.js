const Redis = require('ioredis');
const NodeCache = require('node-cache');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.isRedisEnabled = false;
    this.redis = null;
    this.redisErrorLogged = false;
    
    // In-memory cache as fallback (TTL in seconds)
    this.memoryCache = new NodeCache({
      stdTTL: 300, // 5 minutes default
      checkperiod: 60, // Check for expired keys every 60 seconds
      useClones: false
    });

    this.initializeRedis();
  }

  async initializeRedis() {
    try {
      if (process.env.REDIS_URL || process.env.REDIS_HOST) {
        const redisConfig = process.env.REDIS_URL 
          ? { url: process.env.REDIS_URL }
          : {
              host: process.env.REDIS_HOST || 'localhost',
              port: process.env.REDIS_PORT || 6379,
              password: process.env.REDIS_PASSWORD,
              db: process.env.REDIS_DB || 0,
            };

        this.redis = new Redis({
          ...redisConfig,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          retryDelayOnClusterDown: 300,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 5000,
          commandTimeout: 3000,
        });

        // Handle Redis events before attempting connection
        this.redis.on('error', (err) => {
          // Only log Redis errors once to avoid spam
          if (!this.redisErrorLogged) {
            logger.warn('Redis connection failed, using memory cache fallback');
            this.redisErrorLogged = true;
          }
          this.isRedisEnabled = false;
        });

        this.redis.on('connect', () => {
          logger.info('Redis connected successfully');
          this.isRedisEnabled = true;
          this.redisErrorLogged = false;
        });

        this.redis.on('ready', () => {
          logger.info('Redis ready for commands');
          this.isRedisEnabled = true;
        });

        this.redis.on('disconnect', () => {
          logger.info('Redis disconnected, using memory cache');
          this.isRedisEnabled = false;
        });

        // Test connection with timeout
        const connectionPromise = this.redis.ping();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 3000)
        );

        try {
          await Promise.race([connectionPromise, timeoutPromise]);
          logger.info('Redis cache initialized successfully');
        } catch (error) {
          // Connection failed, fall back to memory cache
          logger.info('Redis not available, using memory cache only');
          this.isRedisEnabled = false;
          if (this.redis) {
            this.redis.disconnect();
            this.redis = null;
          }
        }

      } else {
        logger.info('Redis not configured, using memory cache only');
      }
    } catch (error) {
      logger.info('Redis initialization failed, using memory cache only');
      this.isRedisEnabled = false;
      if (this.redis) {
        this.redis.disconnect();
        this.redis = null;
      }
    }
  }

  async get(key) {
    try {
      if (this.isRedisEnabled && this.redis) {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
      }
      
      return this.memoryCache.get(key) || null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) {
    try {
      if (this.isRedisEnabled && this.redis) {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
        return true;
      }
      
      this.memoryCache.set(key, value, ttlSeconds);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  async del(key) {
    try {
      if (this.isRedisEnabled && this.redis) {
        await this.redis.del(key);
      }
      
      this.memoryCache.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  async clear(pattern) {
    try {
      if (this.isRedisEnabled && this.redis) {
        if (pattern) {
          const keys = await this.redis.keys(pattern);
          if (keys.length > 0) {
            await this.redis.del(...keys);
          }
        } else {
          await this.redis.flushdb();
        }
      }
      
      if (pattern) {
        const keys = this.memoryCache.keys();
        const matchingKeys = keys.filter(key => key.includes(pattern.replace('*', '')));
        this.memoryCache.del(matchingKeys);
      } else {
        this.memoryCache.flushAll();
      }
      
      return true;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }

  // Helper method to generate cache keys
  generateKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
  }

  // Cache wrapper for database queries
  async cacheQuery(key, queryFn, ttlSeconds = 300) {
    try {
      // Try to get from cache first
      const cached = await this.get(key);
      if (cached !== null) {
        logger.debug(`Cache hit for key: ${key}`);
        return cached;
      }

      // Execute query and cache result
      logger.debug(`Cache miss for key: ${key}`);
      const result = await queryFn();
      
      if (result !== null && result !== undefined) {
        await this.set(key, result, ttlSeconds);
      }
      
      return result;
    } catch (error) {
      logger.error('Cache query wrapper error:', error);
      // Return query result without caching on error
      return await queryFn();
    }
  }

  // Get cache statistics
  getStats() {
    const memoryStats = this.memoryCache.getStats();
    return {
      redis: {
        enabled: this.isRedisEnabled,
        connected: this.isRedisEnabled && this.redis && this.redis.status === 'ready'
      },
      memory: {
        keys: memoryStats.keys,
        hits: memoryStats.hits,
        misses: memoryStats.misses,
        hitRate: memoryStats.hits / (memoryStats.hits + memoryStats.misses) || 0
      }
    };
  }

  async disconnect() {
    try {
      if (this.redis) {
        await this.redis.disconnect();
      }
      this.memoryCache.close();
      logger.info('Cache service disconnected');
    } catch (error) {
      logger.error('Error disconnecting cache service:', error);
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
