// PM2 Ecosystem Configuration for Kamer.ba
// Documentation: https://pm2.keymetrics.io/docs/usage/application-declaration/

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'kamerba-backend',
      script: './backend/index.js',
      cwd: path.resolve(__dirname, '..'),  // Project root (parent of deployment folder)
      
      // Clustering
      instances: 2,  // Use 'max' for all CPU cores
      exec_mode: 'cluster',
      
      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // Logging
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto-restart behavior
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Memory management
      max_memory_restart: '500M',
      
      // Watch & Reload (disable in production for stability)
      watch: false,
      
      // Advanced features
      listen_timeout: 3000,
      kill_timeout: 5000,
      
      // Source maps for better error tracking
      source_map_support: true,
      
      // Graceful shutdown
      wait_ready: false,
      
      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      
      // Cron restart (optional - restart daily at 3 AM)
      // cron_restart: '0 3 * * *',
      
      // Post-deployment script
      // post_update: ['npm install --production'],
    }
  ],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'your_username',
      host: '192.168.2.174',
      ref: 'origin/main',
      repo: 'https://github.com/junusg25/kamer-modul.git',
      path: '/var/www/kamerba',
      'post-deploy': 'cd backend && npm install --production && cd ../frontend && npm install && npm run build && cd ../customer-portal && npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};

