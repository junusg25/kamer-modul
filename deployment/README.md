# 📦 Deployment Resources

This folder contains all the necessary tools, scripts, and documentation for deploying the Kamer.ba Repair Shop Management System to production.

---

## 📚 Documentation

| File | Description | When to Use |
|------|-------------|-------------|
| **[QUICK_START_DEPLOYMENT.md](QUICK_START_DEPLOYMENT.md)** | ⭐ Fast track deployment guide | Start here! |
| **[STEP_BY_STEP_DEPLOYMENT.md](STEP_BY_STEP_DEPLOYMENT.md)** | Detailed step-by-step instructions | For first-time deployment |
| **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** | Complete deployment reference | Comprehensive documentation |
| **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** | Verification checklist | Ensure nothing is missed |
| **[NETWORK_CONFIGURATION.md](NETWORK_CONFIGURATION.md)** | Tailscale & network setup | For multi-IP access setup |
| **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** | Quick command reference | Daily operations |

---

## 🛠️ Automation Scripts

| File | Description | Usage |
|------|-------------|-------|
| `server-setup.sh` | Initial server setup (Node.js, PostgreSQL, Nginx, PM2) | Run once on new server |
| `deploy.sh` | Automated deployment script | Run for updates |
| `backup-db.sh` | Database backup automation | Run daily via cron |

**Make scripts executable:**
```bash
chmod +x server-setup.sh deploy.sh backup-db.sh
```

---

## ⚙️ Configuration Files

| File | Description | Copy To |
|------|-------------|---------|
| `env.production.example` | Backend environment variables | `../backend/.env` |
| `ecosystem.config.js` | PM2 process manager config | Use as-is |
| `nginx.conf.example` | Nginx web server config | `/etc/nginx/sites-available/kamerba` |

---

## 🐳 Docker Files

| File | Description |
|------|-------------|
| `Dockerfile` | Multi-stage production Docker build |
| `docker-compose.yml` | Complete Docker orchestration (backend + database + redis) |
| `.dockerignore` | Docker build optimization |

**Docker deployment:**
```bash
cd ..  # Go to project root
docker-compose -f deployment/docker-compose.yml up -d
```

---

## 🚀 Quick Start

### First-Time Deployment:

```bash
# 1. SSH to your server
ssh username@192.168.2.174
# or via Tailscale:
ssh username@100.114.201.33

# 2. Clone repository
sudo mkdir -p /var/www/kamerba
sudo chown -R $USER:$USER /var/www/kamerba
cd /var/www/kamerba
git clone https://github.com/junusg25/kamer-modul.git .

# 3. Run server setup (first time only)
cd deployment
chmod +x server-setup.sh deploy.sh backup-db.sh
./server-setup.sh

# 4. Configure environment
cp env.production.example ../backend/.env
nano ../backend/.env  # Edit with your settings

# 5. Deploy application
./deploy.sh
```

### Deploy Updates:

```bash
# SSH to server
ssh username@192.168.2.174

# Navigate and deploy
cd /var/www/kamerba/deployment
./deploy.sh
```

---

## 🌐 Network Configuration

Your server has **two IP addresses**:

| Network | IP Address | Access |
|---------|-----------|--------|
| **Local LAN** | `192.168.2.174` | Fast, when at home/office |
| **Tailscale VPN** | `100.114.201.33` | Secure remote access |

**Good News**: Both work automatically! The configuration supports both IPs.

**Access URLs:**
- Main Dashboard: `http://192.168.2.174/` or `http://100.114.201.33/`
- Customer Portal: `http://192.168.2.174/portal/` or `http://100.114.201.33/portal/`

See [NETWORK_CONFIGURATION.md](NETWORK_CONFIGURATION.md) for details.

---

## 📋 Deployment Checklist

Before deploying, ensure:

- [ ] Server has Ubuntu 20.04+ installed
- [ ] You have sudo access
- [ ] Server is accessible via SSH
- [ ] You have your GitHub credentials ready
- [ ] Database password is prepared (secure!)
- [ ] JWT secrets are generated

After deployment:

- [ ] Application responds on both IPs
- [ ] Database migrations completed
- [ ] PM2 shows services running
- [ ] Nginx is active
- [ ] SSL certificates installed (if using HTTPS)
- [ ] Backups scheduled

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for complete list.

---

## 🔧 Common Commands

### PM2 Process Manager:
```bash
pm2 status                # View all services
pm2 logs kamerba-backend  # View logs
pm2 restart all           # Restart services
pm2 monit                 # Live monitoring
pm2 save                  # Save configuration
```

### Nginx Web Server:
```bash
sudo systemctl status nginx    # Check status
sudo systemctl reload nginx    # Reload config
sudo nginx -t                  # Test config
sudo tail -f /var/log/nginx/kamerba-error.log  # View errors
```

### Database:
```bash
# Backup
./backup-db.sh

# Access PostgreSQL
sudo -u postgres psql -d repairshop

# View tables
sudo -u postgres psql -d repairshop -c "\dt"
```

### Application Logs:
```bash
# Backend logs
pm2 logs kamerba-backend

# Nginx access logs
sudo tail -f /var/log/nginx/kamerba-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/kamerba-error.log
```

---

## 🆘 Troubleshooting

### App not starting?
```bash
pm2 logs kamerba-backend --lines 100
```

### Port already in use?
```bash
sudo lsof -i :3000
```

### Nginx errors?
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Database connection issues?
```bash
sudo systemctl status postgresql
sudo -u postgres psql -d repairshop -c "SELECT 1"
```

---

## 📖 Full Documentation

For complete documentation, see the main [README.md](../README.md).

---

## 💬 Support

For deployment issues:
1. Check the troubleshooting section in [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
2. Review logs with `pm2 logs`
3. Check system health with `pm2 monit`

---

**Last Updated**: October 11, 2025  
**Version**: 0.6.0  
**Maintained By**: Kamer.ba Development Team

