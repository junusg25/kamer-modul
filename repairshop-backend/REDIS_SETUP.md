# Redis Setup Guide

## Why Redis?
Redis provides distributed caching, better performance, and persistence compared to in-memory caching. It's especially useful in production environments with multiple server instances.

## Current Status
Your application is currently using **memory cache** as Redis is not available. This is perfectly fine for development and small deployments.

## Installing Redis

### Windows (WSL2 Recommended)
```bash
# Install WSL2 and Ubuntu
wsl --install -d Ubuntu

# In Ubuntu terminal
sudo apt update
sudo apt install redis-server

# Start Redis
sudo service redis-server start

# Test connection
redis-cli ping
# Should return: PONG
```

### Windows (Native - Not Recommended)
```bash
# Using Chocolatey
choco install redis-64

# Or download from: https://github.com/microsoftarchive/redis/releases
```

### macOS
```bash
# Using Homebrew
brew install redis

# Start Redis
brew services start redis

# Test connection
redis-cli ping
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test connection
redis-cli ping
```

## Configuration

### 1. Environment Variables
Add to your `.env` file:
```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
# OR individual settings:
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=your_password
# REDIS_DB=0
```

### 2. Test Connection
```bash
# Test Redis CLI
redis-cli ping

# Test from Node.js
node -e "
const Redis = require('ioredis');
const redis = new Redis();
redis.ping().then(() => {
  console.log('Redis connected!');
  redis.disconnect();
}).catch(err => {
  console.log('Redis connection failed:', err.message);
});
"
```

## Benefits of Redis

### Performance
- **Memory Cache**: ~100,000 ops/sec
- **Redis**: ~1,000,000+ ops/sec

### Features
- **Persistence**: Data survives server restarts
- **Distributed**: Share cache across multiple servers
- **Advanced Data Types**: Lists, sets, sorted sets
- **Pub/Sub**: Real-time messaging
- **Lua Scripting**: Complex operations

### Memory Usage
- **Memory Cache**: Limited to available RAM
- **Redis**: Configurable memory limits with eviction policies

## Monitoring

### Redis CLI
```bash
# Monitor all commands
redis-cli monitor

# Check memory usage
redis-cli info memory

# Check connected clients
redis-cli client list
```

### Application Endpoints
```bash
# Cache statistics
GET /api/cache/stats

# Health check with cache info
GET /health
```

## Troubleshooting

### Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution**: Redis server is not running
```bash
# Start Redis
sudo service redis-server start  # Ubuntu
brew services start redis        # macOS
```

### Authentication Failed
```
Error: NOAUTH Authentication required
```
**Solution**: Set password in Redis config
```bash
# Edit /etc/redis/redis.conf
requirepass your_password

# Restart Redis
sudo service redis-server restart
```

### Memory Issues
```
Error: OOM command not allowed when used memory > 'maxmemory'
```
**Solution**: Increase maxmemory in Redis config
```bash
# Edit /etc/redis/redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru

# Restart Redis
sudo service redis-server restart
```

## Production Considerations

### Security
```bash
# Bind to localhost only
bind 127.0.0.1

# Require authentication
requirepass strong_password

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
```

### Performance
```bash
# Enable persistence
save 900 1
save 300 10
save 60 10000

# Memory optimization
maxmemory-policy allkeys-lru
```

### Monitoring
```bash
# Enable slow log
slowlog-log-slower-than 10000
slowlog-max-len 128

# Enable latency monitoring
latency-monitor-threshold 100
```

## Fallback Behavior
Your application automatically falls back to memory cache if Redis is unavailable:
- ✅ **No errors** - graceful degradation
- ✅ **Full functionality** - all features work
- ✅ **Performance** - still fast with memory cache
- ✅ **Zero downtime** - seamless fallback

## Next Steps
1. **Development**: Memory cache is sufficient
2. **Testing**: Install Redis locally for testing
3. **Production**: Use managed Redis service (AWS ElastiCache, Azure Cache, etc.)
4. **Scaling**: Redis becomes essential with multiple server instances

## Support
- **Redis Documentation**: https://redis.io/documentation
- **ioredis**: https://github.com/luin/ioredis
- **Redis Commands**: https://redis.io/commands
