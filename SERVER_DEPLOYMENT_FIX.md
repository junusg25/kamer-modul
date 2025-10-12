# Server Deployment Fix Guide

## Issues Found

### 1. 404 Error on `/api/repair-tickets/filter/years`
**Cause**: Server is running old backend code that doesn't have the new routes.

**Fix**: Pull latest code and restart backend.

### 2. 500 Error on PDF Generation
**Cause**: Puppeteer (Chrome) is missing system libraries on Ubuntu/Debian server.

**Error Message**:
```
error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file
```

**Fix**: Install required system dependencies for Puppeteer/Chrome.

---

## DEPLOYMENT STEPS

### Step 1: Pull Latest Code

```bash
cd /var/www/kamerba
git pull origin main
```

---

### Step 2: Install Puppeteer Dependencies (For PDF Generation)

Puppeteer needs Chrome browser libraries. Run this once on your server:

```bash
# Update package lists
sudo apt-get update

# Install Chrome dependencies
sudo apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils
```

**OR** use this shorter command (installs all dependencies):

```bash
sudo apt-get install -y chromium-browser
```

---

### Step 3: Restart Backend (FORCE RESTART)

**IMPORTANT**: Regular `pm2 restart` may not reload routes. Use this aggressive restart:

```bash
cd /var/www/kamerba

# Stop and DELETE all processes (clears PM2 cache)
pm2 stop all
pm2 delete all

# Clear PM2 cache and dumps
pm2 flush
pm2 cleardump

# Start fresh from ecosystem config
pm2 start deployment/ecosystem.config.js

# Save PM2 config
pm2 save

# Check status
pm2 status

# View logs
pm2 logs backend --lines 50
```

**OR** use the provided script:
```bash
cd /var/www/kamerba
chmod +x FORCE_BACKEND_RESTART.sh
./FORCE_BACKEND_RESTART.sh
```

---

### Step 4: Rebuild Frontend (Already Done)

If you already rebuilt frontend after pulling, you're good. If not:

```bash
cd /var/www/kamerba/frontend
npm run build
```

---

### Step 5: Test

1. **Test Year Filter**:
   - Go to Repair Tickets page
   - Open Filter dropdown
   - Should see Year filter (no 404 error)

2. **Test PDF Printing**:
   - Click Print on any ticket/order
   - Should generate and open PDF (no 500 error)

---

## Expected Results

### After Backend Restart:

**Year Filter API:**
```
GET http://100.114.201.33/api/repair-tickets/filter/years
Status: 200 OK ✅
Response: {"data":[2025]}
```

**PDF Generation:**
```
GET http://100.114.201.33/api/print/repair-ticket/1
Status: 200 OK ✅
Response: PDF file opens/downloads
```

---

## Troubleshooting

### If Year Filter Still 404:

```bash
# Check if route is loaded
pm2 logs backend | grep "filter/years"

# Verify backend code has the route
cat /var/www/kamerba/backend/routes/repairTickets.js | grep "filter/years"

# Force restart
pm2 delete backend
pm2 start deployment/ecosystem.config.js --only backend
```

### If PDF Generation Still Fails:

```bash
# Check PM2 logs for Puppeteer errors
pm2 logs backend --err --lines 100

# Test Puppeteer manually
cd /var/www/kamerba/backend
node -e "const puppeteer = require('puppeteer'); (async () => { const browser = await puppeteer.launch(); console.log('Success!'); await browser.close(); })()"
```

If still failing, run:
```bash
# Install Chrome manually
cd /var/www/kamerba/backend
npx puppeteer browsers install chrome
```

---

## Alternative: Simplified PDF Generation

If Puppeteer continues to cause issues, we can switch to a lighter PDF library (PDFKit) that doesn't require Chrome. Let me know if you want this alternative solution.

---

## Summary

**Quick Fix Commands:**
```bash
cd /var/www/kamerba
git pull origin main
sudo apt-get update
sudo apt-get install -y chromium-browser
pm2 restart all
pm2 logs --lines 50
```

This should fix both the 404 and 500 errors! ✅

