# 🚀 Production Deployment Guide - Kamer.ba Repair Shop Management System

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Server Setup](#server-setup)
- [Database Setup](#database-setup)
- [Application Deployment](#application-deployment)
- [PM2 Process Manager](#pm2-process-manager)
- [Nginx Configuration](#nginx-configuration)
- [SSL Setup](#ssl-setup)
- [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

### On Your Ubuntu Server (192.168.2.174):
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+ (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

---

## 🗄️ Database Setup

### 1. Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE repairshop;
CREATE USER repairshop_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE repairshop TO repairshop_user;
ALTER DATABASE repairshop OWNER TO repairshop_user;
\q
```

### 2. Run Database Schema

```bash
# Copy your schema.sql to server, then:
sudo -u postgres psql -d repairshop -f /path/to/schema.sql

# Or if you have migrations:
cd /var/www/kamerba/backend
node run-migration.js
```

---

## 📦 Application Deployment

### Method 1: Direct Git Clone (Recommended)

```bash
# Create application directory
sudo mkdir -p /var/www/kamerba
sudo chown -R $USER:$USER /var/www/kamerba

# Clone your repository
cd /var/www/kamerba
git clone https://github.com/junusg25/kamer-modul.git .

# Or if you're already in the directory
git init
git remote add origin https://github.com/junusg25/kamer-modul.git
git pull origin main
```

### Method 2: SCP/RSYNC Upload

**From your Windows machine:**

```powershell
# Using PowerShell (install rsync via WSL or Cygwin)
# Or use WinSCP GUI tool

# Example with scp (from WSL):
cd "C:\Users\Junus Giovani\Desktop\repairshop-app in dev v0.6.0"
rsync -avz --exclude 'node_modules' --exclude '.git' . username@192.168.2.174:/var/www/kamerba/
```

---

## ⚙️ Configuration

### 1. Backend Configuration

```bash
cd /var/www/kamerba/backend

# Create .env file
cat > .env << 'EOF'
# Database Configuration
DB_USER=repairshop_user
DB_PASSWORD=your_secure_password_here
DB_HOST=localhost
DB_PORT=5432
DB_NAME=repairshop

# JWT Configuration
JWT_SECRET=your_production_jwt_secret_key_minimum_32_characters
JWT_REFRESH_SECRET=your_production_refresh_secret_different_from_jwt

# Server Configuration
PORT=3000
NODE_ENV=production

# Optional: Redis (if using)
REDIS_HOST=localhost
REDIS_PORT=6379

# Frontend URLs (for CORS)
FRONTEND_URL=http://192.168.2.174
CUSTOMER_PORTAL_URL=http://192.168.2.174:5174
EOF

# Install dependencies
npm install --production

# Test the backend
NODE_ENV=production node index.js
# Press Ctrl+C after confirming it starts
```

### 2. Frontend Configuration

```bash
cd /var/www/kamerba/frontend

# Create .env.production file
cat > .env.production << 'EOF'
VITE_API_BASE_URL=http://192.168.2.174:3000/api
EOF

# Install dependencies and build
npm install
npm run build

# Build output will be in 'dist' folder
```

### 3. Customer Portal Configuration

```bash
cd /var/www/kamerba/customer-portal

# Create .env.production file
cat > .env.production << 'EOF'
VITE_API_BASE_URL=http://192.168.2.174:3000/api
EOF

# Install dependencies and build
npm install
npm run build

# Build output will be in 'dist' folder
```

---

## 🔄 PM2 Process Manager

### 1. Create PM2 Ecosystem File

```bash
cd /var/www/kamerba

# Create ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'kamerba-backend',
      script: './backend/index.js',
      cwd: '/var/www/kamerba/backend',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/www/kamerba/logs/backend-error.log',
      out_file: '/var/www/kamerba/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M'
    }
  ]
};
EOF

# Create logs directory
mkdir -p /var/www/kamerba/logs
```

### 2. Start Application with PM2

```bash
# Start the backend
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it outputs (it will give you a sudo command to run)

# Check status
pm2 status

# View logs
pm2 logs kamerba-backend

# Monitor
pm2 monit
```

### Useful PM2 Commands:
```bash
pm2 restart kamerba-backend    # Restart app
pm2 stop kamerba-backend       # Stop app
pm2 delete kamerba-backend     # Remove from PM2
pm2 reload kamerba-backend     # Zero-downtime reload
pm2 logs kamerba-backend       # View logs
pm2 flush                      # Clear logs
```

---

## 🌐 Nginx Configuration

### 1. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/kamerba
```

**Paste this configuration:**

```nginx
# Backend API
upstream backend {
    server localhost:3000;
    keepalive 64;
}

# Main Server Block
server {
    listen 80;
    server_name 192.168.2.174;

    # Frontend (Main Admin/Staff Portal)
    location / {
        root /var/www/kamerba/frontend/dist;
        try_files $uri $uri/ /index.html;
        
        # Caching for static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Customer Portal
    location /portal {
        alias /var/www/kamerba/customer-portal/dist;
        try_files $uri $uri/ /portal/index.html;
        
        # Caching for static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket for real-time features
    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # File upload size
    client_max_body_size 50M;

    # Logs
    access_log /var/log/nginx/kamerba-access.log;
    error_log /var/log/nginx/kamerba-error.log;
}
```

### 2. Enable Site and Restart Nginx

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/kamerba /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx on boot
sudo systemctl enable nginx
```

---

## 🔒 PostgreSQL Security

```bash
# Edit PostgreSQL config to allow local connections
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Add this line (if not exists):
# local   all             repairshop_user                                 md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## 🔥 Firewall Setup

```bash
# Allow HTTP, HTTPS, and SSH
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## 📊 Monitoring & Logs

### View Application Logs
```bash
# PM2 logs
pm2 logs kamerba-backend

# Nginx logs
sudo tail -f /var/log/nginx/kamerba-access.log
sudo tail -f /var/log/nginx/kamerba-error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### Monitor Resources
```bash
# PM2 monitoring
pm2 monit

# System resources
htop
```

---

## 🔄 Deployment Updates

### Script for Easy Updates

Create `/var/www/kamerba/deploy.sh`:

```bash
#!/bin/bash

echo "🚀 Starting deployment..."

# Navigate to app directory
cd /var/www/kamerba

# Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# Backend
echo "🔧 Updating backend..."
cd backend
npm install --production
pm2 restart kamerba-backend

# Frontend
echo "🎨 Building frontend..."
cd ../frontend
npm install
npm run build

# Customer Portal
echo "🌐 Building customer portal..."
cd ../customer-portal
npm install
npm run build

# Reload Nginx
echo "♻️ Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Deployment complete!"
pm2 status
```

Make it executable:
```bash
chmod +x /var/www/kamerba/deploy.sh
```

---

## 🐳 Docker Deployment (Alternative - Recommended)

If you prefer Docker, I can create a complete Docker setup. Let me know!

---

## 🧪 Testing Production

### 1. Test Backend API
```bash
curl http://192.168.2.174/api/health
```

### 2. Access Applications
- **Main Frontend**: http://192.168.2.174/
- **Customer Portal**: http://192.168.2.174/portal/
- **Backend API**: http://192.168.2.174/api/

### 3. Test Database Connection
```bash
cd /var/www/kamerba/backend
node -e "require('./db').query('SELECT NOW()', (err, res) => { console.log(err || res.rows); process.exit(); })"
```

---

## ⚠️ Important Security Notes

1. **Change default passwords** in .env file
2. **Generate strong JWT secrets** (use `openssl rand -base64 32`)
3. **Set up SSL certificates** for HTTPS (see SSL Setup below)
4. **Configure PostgreSQL** for secure connections
5. **Set up regular backups** for database

---

## 🔐 SSL Setup (HTTPS)

### Option 1: Self-Signed Certificate (for testing)

```bash
# Create self-signed certificate
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/kamerba.key \
  -out /etc/nginx/ssl/kamerba.crt

# Update Nginx config to use SSL (add server block for port 443)
```

### Option 2: Let's Encrypt (for production with domain)

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (requires domain name)
sudo certbot --nginx -d yourdomain.com
```

---

## 📋 Post-Deployment Checklist

- [ ] Database is running and accessible
- [ ] Backend API is running on PM2
- [ ] Frontend build is served by Nginx
- [ ] Customer Portal build is served by Nginx
- [ ] Environment variables are set correctly
- [ ] Logs are being written properly
- [ ] Can access application from browser
- [ ] WebSocket connections work
- [ ] File uploads work
- [ ] Database backups are configured

---

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check logs
pm2 logs kamerba-backend

# Check if port is in use
sudo netstat -tulpn | grep 3000

# Test manually
cd /var/www/kamerba/backend
NODE_ENV=production node index.js
```

### Frontend Not Loading
```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify build exists
ls -la /var/www/kamerba/frontend/dist
```

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -U repairshop_user -d repairshop -h localhost
```

### Permission Issues
```bash
# Fix ownership
sudo chown -R $USER:$USER /var/www/kamerba

# Fix permissions
sudo chmod -R 755 /var/www/kamerba
```

---

## 🔄 Automated Backups

### Database Backup Script

Create `/var/www/kamerba/backup-db.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/kamerba"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="repairshop"
DB_USER="repairshop_user"

mkdir -p $BACKUP_DIR

# Create backup
pg_dump -U $DB_USER -d $DB_NAME > $BACKUP_DIR/backup_$TIMESTAMP.sql

# Compress
gzip $BACKUP_DIR/backup_$TIMESTAMP.sql

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$TIMESTAMP.sql.gz"
```

Make executable and add to crontab:
```bash
chmod +x /var/www/kamerba/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /var/www/kamerba/backup-db.sh
```

---

## 📱 Quick Commands Reference

```bash
# Deploy/Update
cd /var/www/kamerba && ./deploy.sh

# Restart everything
pm2 restart all && sudo systemctl reload nginx

# View all logs
pm2 logs

# Monitor system
pm2 monit

# Database backup
./backup-db.sh

# Check status
pm2 status && sudo systemctl status nginx && sudo systemctl status postgresql
```

---

## 🌐 Access URLs

After deployment, your applications will be accessible at:

- **Main Dashboard**: `http://192.168.2.174/`
- **Customer Portal**: `http://192.168.2.174/portal/`
- **API Health**: `http://192.168.2.174/api/health`
- **API Documentation**: `http://192.168.2.174/api/`

---

## 📞 Support

For issues during deployment, check:
1. PM2 logs: `pm2 logs`
2. Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. PostgreSQL logs: `sudo tail -f /var/log/postgresql/postgresql-*-main.log`

---

## 🎉 Next Steps After Deployment

1. Test all features thoroughly
2. Set up monitoring (optional: install monitoring tools)
3. Configure automated backups
4. Set up SSL certificates for HTTPS
5. Configure email notifications (if using)
6. Set up log rotation
7. Document admin credentials securely

---

**Deployment Date**: $(date)
**Server IP**: 192.168.2.174
**Repository**: https://github.com/junusg25/kamer-modul

Good luck with your deployment! 🚀

