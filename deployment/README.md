# 📦 Deployment Resources

Everything you need to deploy Kamer.ba to production.

---

## 🚀 Quick Start

**1. Read the deployment guide:**  
→ **[DEPLOY.md](DEPLOY.md)** ⭐ START HERE

**2. Run the automated deployment:**

```bash
# SSH to your server
ssh username@192.168.2.174

# Clone and setup
sudo mkdir -p /var/www/kamerba
sudo chown -R $USER:$USER /var/www/kamerba
cd /var/www/kamerba
git clone https://github.com/junusg25/kamer-modul.git .

# Deploy
cd deployment
chmod +x *.sh
./server-setup.sh
# Follow prompts, then:
./deploy.sh
```

**3. Access your app:**
- Main Dashboard: `http://192.168.2.174/`
- Customer Portal: `http://192.168.2.174/portal/`

---

## 📚 Files in This Folder

### **Documentation**
- **[DEPLOY.md](DEPLOY.md)** - Complete deployment guide (READ THIS!)

### **Scripts**
- `server-setup.sh` - Install dependencies (run once on new server)
- `deploy.sh` - Deploy/update application
- `backup-db.sh` - Database backup automation

### **Configuration**
- `ecosystem.config.js` - PM2 process manager config
- `nginx.conf.example` - Nginx web server config template
- `env.production.example` - Backend environment template

### **Docker** (Optional Alternative)
- `Dockerfile` - Container image build
- `docker-compose.yml` - Full stack orchestration
- `.dockerignore` - Build optimization

---

## 🛠️ Automation Scripts

### Make Scripts Executable

```bash
cd /var/www/kamerba/deployment
chmod +x server-setup.sh deploy.sh backup-db.sh
```

### Script Usage

| Script | Purpose | When to Run |
|--------|---------|-------------|
| `server-setup.sh` | Install Node.js, PostgreSQL, Nginx, PM2 | Once on fresh server |
| `deploy.sh` | Build & deploy application | After code changes |
| `backup-db.sh` | Backup PostgreSQL database | Daily (via cron) |

---

## 🔄 Update Your App

After making changes and pushing to GitHub:

```bash
ssh username@192.168.2.174
cd /var/www/kamerba/deployment
./deploy.sh
```

---

## 📊 Common Commands

```bash
# View backend logs
pm2 logs kamerba-backend

# Restart backend
pm2 restart kamerba-backend

# Check status
pm2 status

# Monitor resources
pm2 monit

# Restart Nginx
sudo systemctl restart nginx

# Check Nginx config
sudo nginx -t
```

---

## 🌐 Network Access

Your server has **two IPs** that both work automatically:

| IP | Network | Access |
|----|---------|--------|
| `192.168.2.174` | Local LAN | Fast, when at office |
| `100.114.201.33` | Tailscale VPN | Secure remote access |

Access your app via either IP - no special configuration needed!

---

## 🐛 Troubleshooting

### Backend Not Starting?
```bash
pm2 logs kamerba-backend
```

### Frontend Not Loading?
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Database Issues?
```bash
sudo systemctl status postgresql
sudo -u postgres psql -d repairshop
```

**For detailed troubleshooting, see [DEPLOY.md](DEPLOY.md)**

---

## 📞 Need Help?

1. Check [DEPLOY.md](DEPLOY.md) troubleshooting section
2. View PM2 logs: `pm2 logs kamerba-backend`
3. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`

---

**Last Updated:** 2025-10-11  
**Version:** 0.6.0  
**Repository:** https://github.com/junusg25/kamer-modul
