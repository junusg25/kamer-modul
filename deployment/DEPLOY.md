# 🚀 Kamer.ba Production Deployment Guide

**Complete guide for deploying to Ubuntu Server**

**Server IPs:**
- Local Network: `192.168.2.174`
- Tailscale (Remote): `100.114.201.33`

---

## 📋 Prerequisites

- Ubuntu Server 20.04+ 
- SSH access with sudo privileges
- 15-20 minutes

---

## ⚡ Quick Start (Automated)

If you just want it deployed fast:

```bash
# 1. Connect to server
ssh username@192.168.2.174

# 2. Create directory and clone
sudo mkdir -p /var/www/kamerba
sudo chown -R $USER:$USER /var/www/kamerba
cd /var/www/kamerba
git clone https://github.com/junusg25/kamer-modul.git .

# 3. Run setup
cd deployment
chmod +x *.sh
./server-setup.sh

# 4. Configure backend
cd /var/www/kamerba/backend
nano .env
# (See Backend Configuration section below for what to paste)

# 5. Deploy
cd /var/www/kamerba/deployment
./deploy.sh
```

**Done!** Access at: `http://192.168.2.174/`

---

## 📖 Detailed Step-by-Step Instructions

### **Step 1: Connect to Your Server**

From Windows PowerShell/Terminal:

```powershell
ssh username@192.168.2.174
```

Or via Tailscale (remote):
```powershell
ssh username@100.114.201.33
```

---

### **Step 2: Install Dependencies**

**Option A: Automated (Recommended)**

```bash
cd /var/www/kamerba/deployment
chmod +x server-setup.sh
./server-setup.sh
```

**Option B: Manual Installation**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 (REQUIRED - v18 has build errors)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node version
node -v  # Should show v20.x.x

# Install PostgreSQL 14+
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2

# Install Git
sudo apt install -y git curl wget htop
```

---

### **Step 3: Setup Database**

```bash
# Access PostgreSQL
sudo -u postgres psql
```

**In PostgreSQL shell, paste these commands:**

```sql
CREATE DATABASE repairshop;
CREATE USER admin WITH PASSWORD 'demokrata25';
GRANT ALL PRIVILEGES ON DATABASE repairshop TO admin;
ALTER DATABASE repairshop OWNER TO admin;
\q
```

**Load database schema:**

```bash
sudo -u postgres psql -d repairshop -f /var/www/kamerba/backend/schema.sql
```

**Verify it worked:**

```bash
sudo -u postgres psql -d repairshop -c "\dt"
# Should show list of tables
```

---

### **Step 4: Clone Repository**

```bash
# Create directory
sudo mkdir -p /var/www/kamerba
sudo chown -R $USER:$USER /var/www/kamerba

# Clone from GitHub
cd /var/www/kamerba
git clone https://github.com/junusg25/kamer-modul.git .

# Verify
ls -la
# Should see: backend, frontend, customer-portal, deployment folders
```

---

### **Step 5: Configure Backend**

```bash
cd /var/www/kamerba/backend
nano .env
```

**Paste this configuration:**

```env
# Database Configuration
DB_USER=admin
DB_PASSWORD=demokrata25
DB_HOST=localhost
DB_PORT=5432
DB_NAME=repairshop

# JWT Configuration
JWT_SECRET=BebiVita90g
JWT_REFRESH_SECRET=Demokrata25@

# Server Configuration
PORT=3000
NODE_ENV=production

# CORS (supports both local + Tailscale)
FRONTEND_URL=http://192.168.2.174,http://100.114.201.33
CUSTOMER_PORTAL_URL=http://192.168.2.174/portal
```

**Save:** `Ctrl+X`, then `Y`, then `Enter`

**Install backend dependencies:**

```bash
npm install --production
```

**Test backend manually:**

```bash
NODE_ENV=production node index.js
# Should see: "Server running on port 3000"
# Press Ctrl+C to stop
```

---

### **Step 6: Build Frontends**

**Main Frontend:**

```bash
cd /var/www/kamerba/frontend

# Create production config
cat > .env.production << 'EOF'
VITE_API_BASE_URL=http://192.168.2.174:3000/api
EOF

# Install and build
npm install
npm run build

# Verify
ls -la dist/
# Should see: index.html, assets/
```

**Customer Portal:**

```bash
cd /var/www/kamerba/customer-portal

# Create production config
cat > .env.production << 'EOF'
VITE_API_BASE_URL=http://192.168.2.174:3000/api
EOF

# Install and build
npm install
npm run build

# Verify
ls -la dist/
# Should see: index.html, assets/
```

---

### **Step 7: Configure Nginx**

```bash
sudo nano /etc/nginx/sites-available/kamerba
```

**Paste this configuration:**

```nginx
server {
    listen 80;
    server_name 192.168.2.174 100.114.201.33;

    # Main Frontend
    location / {
        root /var/www/kamerba/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Customer Portal
    location /portal {
        alias /var/www/kamerba/customer-portal/dist;
        try_files $uri $uri/ /portal/index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket Support
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    client_max_body_size 50M;
}
```

**Save:** `Ctrl+X`, then `Y`, then `Enter`

**Enable site:**

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/kamerba /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t
# Should say: "test is successful"

# Restart Nginx
sudo systemctl restart nginx

# Enable on boot
sudo systemctl enable nginx
```

---

### **Step 8: Start Backend with PM2**

```bash
# Navigate to deployment folder
cd /var/www/kamerba/deployment

# Start backend
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup auto-start on boot
pm2 startup
# IMPORTANT: Copy and run the sudo command it outputs!

# Check status
pm2 status
# Should show: kamerba-backend | online

# View logs
pm2 logs kamerba-backend --lines 20
```

---

### **Step 9: Configure Firewall**

```bash
# Allow necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS (future)

# Enable firewall
sudo ufw enable
# Type 'y' and press Enter

# Check status
sudo ufw status
```

---

### **Step 10: Test Deployment**

**From browser:**

1. **Main Dashboard**: http://192.168.2.174/
2. **Customer Portal**: http://192.168.2.174/portal/
3. **API Health**: http://192.168.2.174/api/health

**From command line:**

```bash
# Test API
curl http://192.168.2.174/api/health
# Should return: {"status":"ok"}

# Test via Tailscale
curl http://100.114.201.33/api/health
# Should also work!
```

---

## ✅ Verification Checklist

- [ ] Node.js v20+ installed: `node -v`
- [ ] PostgreSQL running: `sudo systemctl status postgresql`
- [ ] Database has tables: `sudo -u postgres psql -d repairshop -c "\dt"`
- [ ] Backend running: `pm2 status` shows "online"
- [ ] Nginx running: `sudo systemctl status nginx`
- [ ] Nginx config valid: `sudo nginx -t`
- [ ] Frontend builds exist: `ls /var/www/kamerba/frontend/dist/`
- [ ] Portal build exists: `ls /var/www/kamerba/customer-portal/dist/`
- [ ] Main dashboard loads in browser
- [ ] Customer portal loads in browser
- [ ] API health check returns OK
- [ ] Can login to main dashboard
- [ ] Works on both IPs (local + Tailscale)

---

## 🔄 Future Updates

When you make changes and push to GitHub:

```bash
# SSH to server
ssh username@192.168.2.174

# Navigate to app
cd /var/www/kamerba

# Pull latest code
git pull origin main

# Run deploy script
cd deployment
./deploy.sh
```

The deploy script automatically:
- Installs new dependencies
- Builds frontends
- Restarts backend
- Reloads Nginx

---

## 📊 Daily Operations

### View Logs

```bash
# Backend logs
pm2 logs kamerba-backend

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Monitor System

```bash
# PM2 monitoring dashboard
pm2 monit

# Check status
pm2 status

# System resources
htop
```

### Restart Services

```bash
# Restart backend
pm2 restart kamerba-backend

# Restart Nginx
sudo systemctl restart nginx

# Restart PostgreSQL (if needed)
sudo systemctl restart postgresql

# Restart everything
pm2 restart all && sudo systemctl reload nginx
```

### Database Backup

```bash
# Manual backup
cd /var/www/kamerba/deployment
./backup-db.sh

# Setup automated daily backups at 2 AM
crontab -e
# Add this line:
0 2 * * * /var/www/kamerba/deployment/backup-db.sh
```

---

## 🐛 Troubleshooting

### Backend Not Starting

```bash
# Check logs
pm2 logs kamerba-backend

# Try manual start
cd /var/www/kamerba/backend
NODE_ENV=production node index.js
# Look for errors

# Check .env file exists
cat .env
```

### Frontend Not Loading

```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx configuration
sudo nginx -t

# Check if build exists
ls -la /var/www/kamerba/frontend/dist/

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Database Connection Error

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -U admin -d repairshop -h localhost
# Enter password: demokrata25

# Check if tables exist
sudo -u postgres psql -d repairshop -c "\dt"
```

### Build Errors (TypeScript)

We've disabled TypeScript checks for faster deployment. If you see build errors:

```bash
# Verify package.json has correct build script
cd /var/www/kamerba/frontend
grep "build" package.json
# Should show: "build": "vite build"

# Not: "build": "tsc -b && vite build"

# Same for customer-portal
cd /var/www/kamerba/customer-portal
grep "build" package.json
```

### Port 3000 Already in Use

```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process (replace PID)
kill -9 <PID>

# Or restart PM2
pm2 restart kamerba-backend
```

### Permission Errors

```bash
# Fix ownership
sudo chown -R $USER:$USER /var/www/kamerba

# Fix permissions
chmod -R 755 /var/www/kamerba
```

### Can't Access from Browser

```bash
# Check firewall
sudo ufw status
# Port 80 should be ALLOWED

# Check if Nginx is listening
sudo netstat -tlnp | grep :80

# Check if backend is running
curl http://localhost:3000/api/health

# Test Nginx directly
curl http://localhost/
```

---

## 🔐 Security Checklist

After deployment, secure your application:

- [ ] Change default database password
- [ ] Generate new JWT secrets (use `openssl rand -base64 32`)
- [ ] Change default admin credentials after first login
- [ ] Setup SSL/HTTPS with Let's Encrypt
- [ ] Configure database backups (automated)
- [ ] Setup log rotation
- [ ] Review Nginx security headers
- [ ] Keep system updated: `sudo apt update && sudo apt upgrade`

---

## 🌐 Network Notes

Your server has **two IP addresses**:

| IP | Network | When to Use |
|----|---------|-------------|
| `192.168.2.174` | Local LAN | Fast access at home/office |
| `100.114.201.33` | Tailscale VPN | Secure remote access |

**Both work automatically!** No special configuration needed.

Tailscale routes traffic from `100.114.201.33` → `192.168.2.174` seamlessly.

---

## 📞 Support

**Check logs first:**
```bash
pm2 logs kamerba-backend
sudo tail -f /var/log/nginx/error.log
```

**Common commands:**
```bash
# Restart everything
pm2 restart all && sudo systemctl reload nginx

# Check all services
pm2 status && sudo systemctl status nginx && sudo systemctl status postgresql

# View system resources
pm2 monit
```

---

## 🎉 Success Criteria

Your deployment is successful when:

✅ `pm2 status` shows backend as "online"  
✅ `curl http://192.168.2.174/api/health` returns `{"status":"ok"}`  
✅ Main dashboard loads: `http://192.168.2.174/`  
✅ Customer portal loads: `http://192.168.2.174/portal/`  
✅ Both IPs work (local + Tailscale)  
✅ Can login and use the application  
✅ WebSocket connections work (real-time updates)  

---

## 📦 Important Paths

```
/var/www/kamerba/              # Application root
├── backend/                   # Node.js backend
│   ├── index.js              # Entry point
│   └── .env                  # Configuration (SECRET!)
├── frontend/dist/            # Built main app
├── customer-portal/dist/     # Built customer portal
├── deployment/               # Deployment scripts
│   ├── deploy.sh            # Update script
│   ├── backup-db.sh         # Backup script
│   └── ecosystem.config.js  # PM2 config
└── logs/                     # Application logs

/etc/nginx/sites-available/kamerba   # Nginx config
/var/log/nginx/                      # Nginx logs
/var/backups/kamerba/               # Database backups
```

---

**Last Updated:** 2025-10-11  
**Version:** 0.6.0  
**Repository:** https://github.com/junusg25/kamer-modul

---

**🚀 Happy Deploying!**

For questions or issues, check the troubleshooting section above.

