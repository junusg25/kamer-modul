# 🚀 Quick Reference - Deployment Commands

Quick reference for deploying and managing Kamer.ba on Ubuntu server (192.168.2.174)

---

## 📋 **Essential Commands**

### **Initial Deployment**

```bash
# SSH to server
ssh username@192.168.2.174

# Clone repository
cd /var/www/kamerba
git clone https://github.com/junusg25/kamer-modul.git .

# Run setup
chmod +x server-setup.sh deploy.sh backup-db.sh
./server-setup.sh

# Deploy
./deploy.sh
```

### **Deploy Updates**

```bash
# SSH to server
ssh username@192.168.2.174

# Navigate and deploy
cd /var/www/kamerba
./deploy.sh
```

---

## 🔧 **PM2 Commands**

```bash
# Start application
pm2 start ecosystem.config.js

# Restart
pm2 restart kamerba-backend

# Stop
pm2 stop kamerba-backend

# View logs
pm2 logs kamerba-backend

# Monitor
pm2 monit

# Status
pm2 status

# Save configuration
pm2 save
```

---

## 🌐 **Nginx Commands**

```bash
# Test configuration
sudo nginx -t

# Restart
sudo systemctl restart nginx

# Reload (zero downtime)
sudo systemctl reload nginx

# Status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

---

## 🗄️ **Database Commands**

```bash
# Access database
psql -U repairshop_user -d repairshop -h localhost

# Backup database
./backup-db.sh

# Manual backup
pg_dump -U repairshop_user repairshop > backup.sql

# Restore database
psql -U repairshop_user -d repairshop < backup.sql

# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## 📊 **Monitoring**

```bash
# View backend logs
pm2 logs kamerba-backend

# View all PM2 processes
pm2 list

# System resources
pm2 monit
# or
htop

# Disk usage
df -h

# Memory usage
free -h

# Check running processes
ps aux | grep node
```

---

## 🔄 **Service Management**

```bash
# Restart everything
pm2 restart all
sudo systemctl restart nginx

# Stop everything
pm2 stop all
sudo systemctl stop nginx

# Check all services
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql
```

---

## 🔥 **Firewall**

```bash
# Status
sudo ufw status

# Allow port
sudo ufw allow 80/tcp

# Enable firewall
sudo ufw enable

# Disable firewall
sudo ufw disable
```

---

## 📂 **Important Paths**

```bash
# Application root
/var/www/kamerba/

# Backend
/var/www/kamerba/backend/

# Frontend build
/var/www/kamerba/frontend/dist/

# Customer Portal build
/var/www/kamerba/customer-portal/dist/

# Logs
/var/www/kamerba/logs/

# Backups
/var/backups/kamerba/

# Nginx config
/etc/nginx/sites-available/kamerba

# Nginx logs
/var/log/nginx/
```

---

## 🆘 **Emergency Commands**

### **Application Not Responding**

```bash
# Restart backend
pm2 restart kamerba-backend

# Reload Nginx
sudo systemctl reload nginx

# Check logs for errors
pm2 logs kamerba-backend --err
```

### **Database Issues**

```bash
# Restart PostgreSQL
sudo systemctl restart postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname='repairshop';"

# Clear connections
sudo -u postgres psql -d repairshop -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='repairshop' AND pid <> pg_backend_pid();"
```

### **High Memory Usage**

```bash
# Restart backend with fresh memory
pm2 restart kamerba-backend

# Check memory
free -h
pm2 info kamerba-backend
```

### **Disk Full**

```bash
# Check disk usage
df -h

# Clean PM2 logs
pm2 flush

# Clean old backups
find /var/backups/kamerba/ -name "*.sql.gz" -mtime +30 -delete

# Clean old logs
sudo journalctl --vacuum-time=7d
```

---

## 🔍 **Debugging**

```bash
# Check if backend is running
curl http://localhost:3000/api/health

# Check if port 3000 is listening
sudo netstat -tlnp | grep 3000

# Test database connection
psql -U repairshop_user -d repairshop -h localhost -c "SELECT NOW();"

# Check Nginx configuration
sudo nginx -t

# View recent errors
pm2 logs kamerba-backend --lines 100 --err
```

---

## 📱 **Access URLs**

- **Main Dashboard**: http://192.168.2.174/
- **Customer Portal**: http://192.168.2.174/portal/
- **API Health**: http://192.168.2.174/api/health
- **API Base**: http://192.168.2.174/api/

---

## 🔐 **Security Checklist**

```bash
# Generate new JWT secret
openssl rand -base64 32

# Check file permissions
ls -la /var/www/kamerba/backend/.env

# Should be: -rw------- or -rw-r-----

# Fix if needed
chmod 600 /var/www/kamerba/backend/.env
```

---

## 📞 **Support**

If something goes wrong:

1. **Check logs**: `pm2 logs kamerba-backend`
2. **Check status**: `pm2 status`
3. **Check Nginx**: `sudo tail -f /var/log/nginx/error.log`
4. **Restart services**: `pm2 restart all && sudo systemctl reload nginx`

For detailed help, see: **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**

---

**Last Updated**: 2025-10-11
**Server**: 192.168.2.174 (Ubuntu)
**Repository**: https://github.com/junusg25/kamer-modul

