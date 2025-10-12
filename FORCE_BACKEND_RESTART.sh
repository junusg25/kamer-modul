#!/bin/bash

# Force Backend Restart Script
# Use this when PM2 restart doesn't pick up new routes

echo "🔄 Forcing backend restart..."

cd /var/www/kamerba

# 1. Stop and delete all PM2 processes
echo "Stopping PM2 processes..."
pm2 stop all
pm2 delete all

# 2. Clear PM2 cache
echo "Clearing PM2 cache..."
pm2 flush
pm2 cleardump

# 3. Verify latest code
echo "Current git commit:"
git log --oneline -1

# 4. Start backend fresh
echo "Starting backend..."
cd /var/www/kamerba
pm2 start deployment/ecosystem.config.js

# 5. Save PM2 configuration
pm2 save

# 6. Show status
echo "✅ PM2 Status:"
pm2 status

echo ""
echo "📋 Backend logs (last 30 lines):"
pm2 logs backend --lines 30 --nostream

echo ""
echo "✅ Done! Backend restarted with latest code."
echo ""
echo "🧪 Test the year filter route manually:"
echo "curl -H 'Authorization: Bearer YOUR_TOKEN' http://100.114.201.33/api/repair-tickets/filter/years"

