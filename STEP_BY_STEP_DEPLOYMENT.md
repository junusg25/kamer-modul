# 📖 Step-by-Step Deployment Instructions

## 🎯 Deploying to Ubuntu Server (192.168.2.174)

Follow these exact steps to deploy your application to production.

---

## ✅ Pre-Deployment Checklist

Before starting, ensure you have:
- [ ] SSH access to your Ubuntu server (192.168.2.174)
- [ ] GitHub repository is up to date (already done ✓)
- [ ] Your GitHub credentials or SSH key ready

---

## 🚀 Deployment Steps

### **1️⃣ Connect to Your Server**

From Windows PowerShell or Terminal:

```powershell
ssh your_username@192.168.2.174
```

Or use PuTTY with:
- **Host**: 192.168.2.174
- **Port**: 22
- **Connection Type**: SSH

---

### **2️⃣ Install Required Software**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v  # Should show v18.x.x
npm -v   # Should show 9.x.x or higher

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Install Git (if not already installed)
sudo apt install -y git
```

---

### **3️⃣ Setup PostgreSQL Database**

```bash
# Switch to postgres user and open PostgreSQL shell
sudo -u postgres psql
```

**In the PostgreSQL shell, run these commands ONE BY ONE:**

```sql
CREATE DATABASE repairshop;
CREATE USER repairshop_user WITH PASSWORD 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE repairshop TO repairshop_user;
ALTER DATABASE repairshop OWNER TO repairshop_user;
\q
```

**Test the connection:**

```bash
psql -U repairshop_user -d repairshop -h localhost
# Enter the password you set above
# Type \q to exit
```

---

### **4️⃣ Clone Your Application**

```bash
# Create application directory
sudo mkdir -p /var/www/kamerba
sudo chown -R $USER:$USER /var/www/kamerba

# Clone from GitHub
cd /var/www/kamerba
git clone https://github.com/junusg25/kamer-modul.git .

# Or if you have authentication issues:
git clone https://your_username:your_token@github.com/junusg25/kamer-modul.git .
```

---

### **5️⃣ Load Database Schema**

```bash
# Load the schema into PostgreSQL
sudo -u postgres psql -d repairshop -f /var/www/kamerba/backend/schema.sql

# This might take a minute...
# You should see CREATE TABLE, CREATE INDEX, etc. messages
```

---

### **6️⃣ Configure Backend**

```bash
cd /var/www/kamerba/backend

# Create .env file
nano .env
```

**Paste this configuration** (update the passwords and secrets!):

```env
# Database Configuration
DB_USER=repairshop_user
DB_PASSWORD=YourSecurePassword123!
DB_HOST=localhost
DB_PORT=5432
DB_NAME=repairshop

# JWT Configuration
JWT_SECRET=your_very_long_and_secure_jwt_secret_key_min_32_chars
JWT_REFRESH_SECRET=another_different_very_secure_secret_key_here

# Server Configuration
PORT=3000
NODE_ENV=production

# Frontend URLs
FRONTEND_URL=http://192.168.2.174
```

**Generate secure secrets (recommended):**

```bash
# Generate and append secure JWT secrets
echo "" >> .env
echo "# Auto-generated secrets" >> .env
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)" >> .env
```

**Install backend dependencies:**

```bash
npm install --production
```

**Test backend manually:**

```bash
NODE_ENV=production node index.js
# You should see "Server running on http://localhost:3000"
# Press Ctrl+C to stop
```

---

### **7️⃣ Build Frontend**

```bash
cd /var/www/kamerba/frontend

# Create production environment file
cat > .env.production << 'EOF'
VITE_API_BASE_URL=http://192.168.2.174:3000/api
EOF

# Install dependencies
npm install

# Build for production
npm run build

# Verify build was created
ls -la dist/
# You should see index.html and assets folder
```

---

### **8️⃣ Build Customer Portal**

```bash
cd /var/www/kamerba/customer-portal

# Create production environment file
cat > .env.production << 'EOF'
VITE_API_BASE_URL=http://192.168.2.174:3000/api
EOF

# Install dependencies
npm install

# Build for production
npm run build

# Verify build was created
ls -la dist/
# You should see index.html and assets folder
```

---

### **9️⃣ Configure Nginx**

```bash
# Create Nginx site configuration
sudo nano /etc/nginx/sites-available/kamerba
```

**Paste the configuration from `nginx.conf.example` file, or use this:**

```nginx
upstream backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name 192.168.2.174;

    location / {
        root /var/www/kamerba/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /portal {
        alias /var/www/kamerba/customer-portal/dist;
        try_files $uri $uri/ /portal/index.html;
    }

    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    client_max_body_size 50M;
}
```

**Save and exit** (Ctrl+X, then Y, then Enter)

**Enable the site:**

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/kamerba /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx on startup
sudo systemctl enable nginx
```

---

### **🔟 Start Backend with PM2**

```bash
cd /var/www/kamerba

# Create logs directory
mkdir -p logs

# Make deploy script executable
chmod +x deploy.sh
chmod +x backup-db.sh

# Start backend with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on server boot
pm2 startup
# Copy and run the command it outputs (it will be a sudo command)

# Check status
pm2 status

# View logs
pm2 logs kamerba-backend --lines 50
```

---

### **1️⃣1️⃣ Configure Firewall**

```bash
# Allow necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS (for future SSL)

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

### **1️⃣2️⃣ Test Your Deployment**

**From your browser**, visit:

1. **Main Dashboard**: http://192.168.2.174/
2. **Customer Portal**: http://192.168.2.174/portal/
3. **API Health**: http://192.168.2.174/api/health

**From command line:**

```bash
# Test API
curl http://192.168.2.174/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

---

### **1️⃣3️⃣ Setup Automated Backups**

```bash
# Make backup script executable
chmod +x /var/www/kamerba/backup-db.sh

# Test backup
./backup-db.sh

# Add to crontab for daily backups at 2 AM
crontab -e

# Add this line at the end:
0 2 * * * /var/www/kamerba/backup-db.sh

# Save and exit
```

---

## 🎉 You're Done!

Your application should now be running in production!

### **Access URLs:**
- **Main Dashboard**: http://192.168.2.174/
- **Customer Portal**: http://192.168.2.174/portal/

### **Default Login** (if using seed data):
- **Email**: admin@example.com
- **Password**: password123

⚠️ **CHANGE DEFAULT CREDENTIALS IMMEDIATELY!**

---

## 📊 Monitoring Commands

```bash
# View backend logs
pm2 logs kamerba-backend

# Monitor system resources
pm2 monit

# Check PM2 status
pm2 status

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Check PostgreSQL
sudo systemctl status postgresql

# Check Nginx
sudo systemctl status nginx
```

---

## 🔄 Future Updates

When you push changes to GitHub:

```bash
# SSH into server
ssh your_username@192.168.2.174

# Navigate to app directory
cd /var/www/kamerba

# Run deployment script
./deploy.sh
```

That's it! The script will:
- Pull latest code
- Install dependencies
- Build frontend and customer portal
- Restart backend
- Reload Nginx

---

## 🐛 Troubleshooting

### Backend Not Starting?

```bash
# Check PM2 logs
pm2 logs kamerba-backend

# Try starting manually to see errors
cd /var/www/kamerba/backend
NODE_ENV=production node index.js
```

### Can't Access Website?

```bash
# Check Nginx is running
sudo systemctl status nginx

# Check if backend is running
pm2 status

# Check firewall
sudo ufw status
```

### Database Connection Error?

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U repairshop_user -d repairshop -h localhost
```

### Permission Errors?

```bash
# Fix permissions
sudo chown -R $USER:$USER /var/www/kamerba
sudo chmod -R 755 /var/www/kamerba
```

---

## 📞 Need Help?

- Check **DEPLOYMENT_GUIDE.md** for detailed information
- View PM2 logs: `pm2 logs`
- View Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Check application logs in `/var/www/kamerba/logs/`

---

**Happy deploying! 🚀**

