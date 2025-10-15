// index.js
const express = require('express');
require('dotenv').config();
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const cacheService = require('./services/cacheService');
const websocketService = require('./services/websocketService');
const schedulerService = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for secure cookies in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security middlewares
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// Configure CORS properly
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3001', // Frontend dev server (old)
      'http://localhost:5173', // Vite dev server (new)
      'http://localhost:5174', // Customer Portal
      'http://localhost:5137', // React Admin demo
      'http://localhost:3000', // Backend API server
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173', // Vite dev server
      'http://127.0.0.1:5174', // Customer Portal
      'http://127.0.0.1:5137', // React Admin demo
      'http://127.0.0.1:3000',
    ];
    
    // Add production origins from environment variables
    if (process.env.FRONTEND_URL) {
      // Support comma-separated list of URLs
      const frontendUrls = process.env.FRONTEND_URL.split(',').map(url => url.trim());
      allowedOrigins.push(...frontendUrls);
    }
    
    if (process.env.CUSTOMER_PORTAL_URL) {
      const portalUrls = process.env.CUSTOMER_PORTAL_URL.split(',').map(url => url.trim());
      allowedOrigins.push(...portalUrls);
    }
    
    if (process.env.NODE_ENV === 'production') {
      // Add your production domain here
      allowedOrigins.push('https://yourproductiondomain.com');
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Auth-Token'
  ],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));

// Rate limiting: 500 requests per 15 minutes per IP (higher limit for tests)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Middleware
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/machines', require('./routes/machines'));
app.use('/api/machine-models', require('./routes/machineModels'));
app.use('/api/machine-serials', require('./routes/machineSerials'));
app.use('/api/sold-machines', require('./routes/soldMachines'));
app.use('/api/rental-machines', require('./routes/rentalMachines'));
app.use('/api/machine-rentals', require('./routes/machineRentals'));
app.use('/api/rental-analytics', require('./routes/rentalAnalytics'));
app.use('/api/dynamic-pricing', require('./routes/dynamicPricing'));
app.use('/api/scheduler', require('./routes/scheduler'));
app.use('/api/workOrders', require('./routes/workOrders'));

// Customer Portal Routes
app.use('/api/customer-portal/auth', require('./routes/customerPortalAuth'));
app.use('/api/customer-portal', require('./routes/customerPortalTracking'));
app.use('/api/warrantyWorkOrders', require('./routes/warrantyWorkOrders'));
app.use('/api/repairTickets', require('./routes/repairTickets'));
app.use('/api/warrantyRepairTickets', require('./routes/warrantyRepairTickets'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/workOrderInventory', require('./routes/workOrderInventory'));
app.use('/api/workOrderNotes', require('./routes/workOrderNotes'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/export', require('./routes/export'));
app.use('/api/print', require('./routes/print'));
app.use('/api/attachments', require('./routes/attachments'));
app.use('/api/time-tracking', require('./routes/timeTracking'));
app.use('/api/work-order-templates', require('./routes/workOrderTemplates'));
app.use('/api/customer-communications', require('./routes/customerCommunications'));
app.use('/api/customer-preferences', require('./routes/customerPreferences'));
app.use('/api/customer-portal', require('./routes/customerPortal'));
app.use('/api/advanced-inventory', require('./routes/advancedInventory'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/machine-categories', require('./routes/machineCategories'));
app.use('/api/inventory-categories', require('./routes/inventoryCategories'));
app.use('/api/websocket', require('./routes/websocket'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/manager-dashboard', require('./routes/managerDashboard'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/table-preferences', require('./routes/tablePreferences'));
app.use('/api/action-logs', require('./routes/actionLogs'));
app.use('/api/system-settings', require('./routes/systemSettings'));
app.use('/history/customers', require('./routes/history/customerHistory'));
app.use('/history/machines', require('./routes/history/machineHistory'));
app.use('/history/users', require('./routes/history/userHistory'));

// Home route
app.get('/', (req, res) => {
  res.send('Repair Shop API is running');
});

// Health check routes (both /health and /api/health for compatibility)
app.get('/health', (req, res) => {
  const cacheStats = cacheService.getStats();
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    cache: cacheStats
  });
});

// Also available at /api/health for frontend consistency
app.get('/api/health', (req, res) => {
  const cacheStats = cacheService.getStats();
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    cache: cacheStats
  });
});

// Cache statistics endpoint
app.get('/api/cache/stats', (req, res) => {
  const stats = cacheService.getStats();
  res.json({
    status: 'success',
    data: stats
  });
});

// Error Handling Middleware (MUST be after all routes)
app.use(require('./middleware/errorHandler'));

// 404 Handler (for undefined routes)
app.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server`
  });
});

// Start server
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    logger.info(`Server started on port ${PORT}`);
    
    // Initialize WebSocket service (singleton)
    const wsInstance = websocketService.getInstance();
    wsInstance.initialize(server);
    
    // Start rental status scheduler
    schedulerService.start();
    
    // Log cache status after server starts
    setTimeout(() => {
      const cacheStats = cacheService.getStats();
      if (cacheStats.redis.enabled && cacheStats.redis.connected) {
        logger.info('Redis cache is active and connected');
      } else {
        logger.info('Using memory cache (Redis not available)');
      }
    }, 1000);
  });
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  // Stop scheduler
  schedulerService.stop();
  
  // Close cache connections
  await cacheService.disconnect();
  
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export the app for testing
module.exports = app;