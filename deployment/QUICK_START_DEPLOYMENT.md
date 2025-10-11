# ⚡ Quick Start Deployment Guide

This is a simplified guide to get your app running on your Ubuntu server (192.168.2.174) as quickly as possible.

---

## 🎯 Step-by-Step Instructions

### **Step 1: Connect to Your Server**

From your Windows machine using PowerShell or Windows Terminal:

**Via Local Network:**
```powershell
ssh username@192.168.2.174
```

**Via Tailscale (Remote Access):**
```powershell
ssh username@100.114.201.33
```

Or use PuTTY with either IP address.

> 💡 **Tip**: Both IPs connect to the same server! Use local IP when at home/office, use Tailscale IP when remote.

---

### **Step 2: Run Initial Server Setup**

```bash
# Create directory
sudo mkdir -p /var/www/kamerba
sudo chown -R $USER:$USER /var/www/kamerba
cd /var/www/kamerba

# Clone repository
git clone https://github.com/junusg25/kamer-modul.git .

# Make setup script executable and run it
chmod +x server-setup.sh
./server-setup.sh
```

This will install:
- ✅ Node.js
- ✅ PostgreSQL
- ✅ Nginx
- ✅ PM2
- ✅ Other dependencies

---

### **Step 3: Setup Database**

```bash
# Access PostgreSQL
sudo -u postgres psql

# In PostgreSQL shell, run these commands:
CREATE DATABASE repairshop;
CREATE USER repairshop_user WITH PASSWORD 'Change_This_Password_123!';
GRANT ALL PRIVILEGES ON DATABASE repairshop TO repairshop_user;
ALTER DATABASE repairshop OWNER TO repairshop_user;
\q

# Load database schema
sudo -u postgres psql -d repairshop -f /var/www/kamerba/backend/schema.sql
```

---

### **Step 4: Configure Backend**

```bash
cd /var/www/kamerba/backend

# Create .env file
cat > .env << 'EOF'
# Database Configuration
DB_USER=repairshop_user
DB_PASSWORD=Change_This_Password_123!
DB_HOST=localhost
DB_PORT=5432
DB_NAME=repairshop

# JWT Configuration (CHANGE THESE!)
JWT_SECRET=please_generate_a_secure_random_secret_minimum_32_characters_long
JWT_REFRESH_SECRET=please_generate_another_different_secure_secret_key_here

# Server Configuration
PORT=3000
NODE_ENV=production
EOF

# Generate secure JWT secrets (recommended)
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)" >> .env

# Install dependencies
npm install --production
```

---

### **Step 5: Build Frontend Applications**

```bash
# Build main frontend
cd /var/www/kamerba/frontend
cat > .env.production << 'EOF'
VITE_API_BASE_URL=http://192.168.2.174:3000/api
EOF
npm install
npm run build

# Build customer portal
cd /var/www/kamerba/customer-portal
cat > .env.production << 'EOF'
VITE_API_BASE_URL=http://192.168.2.174:3000/api
EOF
npm install
npm run build
```

---

### **Step 6: Configure Nginx**

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/kamerba
```

**Paste this configuration:**

```nginx
upstream backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name 192.168.2.174;

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
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    client_max_body_size 50M;
}
```

**Enable the site:**

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/kamerba /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

### **Step 7: Start Backend with PM2**

```bash
cd /var/www/kamerba

# Start backend
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command it outputs (copy and paste the sudo command)

# Check status
pm2 status
pm2 logs kamerba-backend
```

---

### **Step 8: Test Your Deployment**

Open your browser and go to:

1. **Main Dashboard**: http://192.168.2.174/
2. **Customer Portal**: http://192.168.2.174/portal/
3. **API Health Check**: http://192.168.2.174/api/health

Default login credentials (if using seed data):
- **Email**: admin@example.com
- **Password**: password123

⚠️ **IMPORTANT**: Change default credentials immediately!

---

## 🔄 Future Updates

When you make changes, just run:

```bash
cd /var/www/kamerba
./deploy.sh
```

---

## 📊 Monitoring & Management

```bash
# View backend logs
pm2 logs kamerba-backend

# Restart backend
pm2 restart kamerba-backend

# Check status
pm2 status

# Monitor resources
pm2 monit

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🆘 Common Issues

### Backend won't start
```bash
# Check logs
pm2 logs kamerba-backend

# Test manually
cd /var/www/kamerba/backend
NODE_ENV=production node index.js
```

### Can't access from browser
```bash
# Check if Nginx is running
sudo systemctl status nginx

# Check if backend is running
pm2 status

# Check firewall
sudo ufw status
```

### Database connection error
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U repairshop_user -d repairshop -h localhost
```

---

## 🔐 Security Checklist

- [ ] Change database password from default
- [ ] Generate new JWT secrets (don't use defaults)
- [ ] Change default admin credentials
- [ ] Enable firewall (ufw)
- [ ] Set up automated backups
- [ ] Configure SSL (HTTPS) if using domain name
- [ ] Review Nginx security headers
- [ ] Set up log rotation

---

## 📞 Need Help?

Check the full deployment guide: `DEPLOYMENT_GUIDE.md`

---

## 🌐 Access Your Application

After deployment completes, access your app via:

### **Local Network** (when at home/office):
- Main Dashboard: `http://192.168.2.174/`
- Customer Portal: `http://192.168.2.174/portal/`
- API Health: `http://192.168.2.174/api/health`

### **Tailscale** (remote access from anywhere):
- Main Dashboard: `http://100.114.201.33/`
- Customer Portal: `http://100.114.201.33/portal/`
- API Health: `http://100.114.201.33/api/health`

> 🎉 **Both IPs work automatically!** No need to configure anything special for Tailscale - it just works!

---

**Quick Commands:**

```bash
# Deploy updates
cd /var/www/kamerba/deployment
./deploy.sh

# Backup database
./backup-db.sh

# Restart everything
pm2 restart all && sudo systemctl reload nginx

# View logs
pm2 logs kamerba-backend

# View status
pm2 status && sudo systemctl status nginx
```

Good luck! 🚀

