# 🎯 START HERE - Quick Deployment Overview

Welcome! This guide will help you deploy Kamer.ba to your Ubuntu server in production.

---

## ⚡ The Simplest Way to Deploy

### Your Server Info:
- **Local IP**: `192.168.2.174` (when at home/office)
- **Tailscale IP**: `100.114.201.33` (remote access from anywhere)
- **OS**: Ubuntu Server

### 3-Step Deployment:

1️⃣ **Connect to your server:**
```bash
ssh username@192.168.2.174
```

2️⃣ **Run the setup script** (first time only):
```bash
cd /var/www/kamerba/deployment
./server-setup.sh
```

3️⃣ **Deploy the application:**
```bash
./deploy.sh
```

✅ **Done!** Access your app at: `http://192.168.2.174/` or `http://100.114.201.33/`

---

## 📚 Choose Your Path

### 🚀 **I Want It Fast** (5-10 minutes)
→ Read: [QUICK_START_DEPLOYMENT.md](QUICK_START_DEPLOYMENT.md)

### 📖 **I Want Details** (15-20 minutes)
→ Read: [STEP_BY_STEP_DEPLOYMENT.md](STEP_BY_STEP_DEPLOYMENT.md)

### 🔧 **I Need Everything** (Complete reference)
→ Read: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

### 🌐 **I Need Network Help** (Tailscale setup)
→ Read: [NETWORK_CONFIGURATION.md](NETWORK_CONFIGURATION.md)

---

## 💡 About Your Network Setup

**Great News!** You don't need to do anything special for Tailscale! 🎉

Your configuration uses the **local IP (192.168.2.174)**, and Tailscale automatically routes traffic from **100.114.201.33** to your server.

**This means:**
- ✅ Access locally: `http://192.168.2.174/`
- ✅ Access remotely: `http://100.114.201.33/`
- ✅ No extra configuration needed!

---

## 📦 What's in This Folder?

### **📚 Documentation:**
- `README.md` - Deployment folder overview
- `QUICK_START_DEPLOYMENT.md` - Fast deployment guide
- `STEP_BY_STEP_DEPLOYMENT.md` - Detailed instructions
- `DEPLOYMENT_GUIDE.md` - Complete reference
- `DEPLOYMENT_CHECKLIST.md` - Verification checklist
- `NETWORK_CONFIGURATION.md` - Tailscale & network guide
- `QUICK_REFERENCE.md` - Command reference

### **🛠️ Scripts:**
- `server-setup.sh` - Install all dependencies (run once)
- `deploy.sh` - Deploy/update application (run anytime)
- `backup-db.sh` - Backup database (run daily)

### **⚙️ Configuration:**
- `ecosystem.config.js` - PM2 process manager
- `nginx.conf.example` - Nginx web server
- `env.production.example` - Backend environment

### **🐳 Docker:**
- `Dockerfile` - Container build
- `docker-compose.yml` - Orchestration
- `.dockerignore` - Build optimization

---

## ✅ Pre-Deployment Checklist

Before you start, make sure you have:

- [ ] SSH access to your Ubuntu server (192.168.2.174 or 100.114.201.33)
- [ ] sudo privileges on the server
- [ ] Your GitHub credentials ready
- [ ] A secure database password prepared
- [ ] 10-20 minutes of time

---

## 🚀 Ready to Deploy?

**Option 1: Quick Deployment** (Recommended for first-time users)
```bash
# 1. SSH to server
ssh username@192.168.2.174

# 2. Clone repository
sudo mkdir -p /var/www/kamerba
sudo chown -R $USER:$USER /var/www/kamerba
cd /var/www/kamerba
git clone https://github.com/junusg25/kamer-modul.git .

# 3. Run setup & deploy
cd deployment
chmod +x server-setup.sh deploy.sh
./server-setup.sh
# Follow the prompts, then:
./deploy.sh
```

**Option 2: Docker Deployment** (If you prefer Docker)
```bash
# From project root
cd /var/www/kamerba
docker-compose -f deployment/docker-compose.yml up -d
```

---

## 🎯 After Deployment

### Test Your Deployment:

**1. Check Backend Health:**
```bash
curl http://192.168.2.174/api/health
```

**2. Access Main Dashboard:**
- Open browser: `http://192.168.2.174/`

**3. Access Customer Portal:**
- Open browser: `http://192.168.2.174/portal/`

**4. Test Remote Access (Tailscale):**
- From any device with Tailscale: `http://100.114.201.33/`

---

## 🔍 Verify Everything Works

Run this checklist:

- [ ] Backend API responds: `curl http://192.168.2.174/api/health`
- [ ] PM2 shows running: `pm2 status`
- [ ] Nginx is active: `sudo systemctl status nginx`
- [ ] Main dashboard loads in browser
- [ ] Customer portal loads in browser
- [ ] Can login to main dashboard
- [ ] Can track item in customer portal
- [ ] Both IPs work (local + Tailscale)

---

## 🆘 Something Wrong?

### Quick Fixes:

**Backend not responding?**
```bash
pm2 logs kamerba-backend
pm2 restart kamerba-backend
```

**Frontend not loading?**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

**Database connection error?**
```bash
sudo systemctl status postgresql
cd /var/www/kamerba/backend
cat .env  # Verify DB credentials
```

### Get More Help:
- See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Troubleshooting section
- Check [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Common commands

---

## 💬 Need Support?

1. Review the troubleshooting section in [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
2. Check PM2 logs: `pm2 logs kamerba-backend`
3. Check Nginx logs: `sudo tail -f /var/log/nginx/kamerba-error.log`

---

## 🎉 Success!

Once everything is working:

✅ Your app is live!  
✅ Accessible locally: `http://192.168.2.174/`  
✅ Accessible remotely: `http://100.114.201.33/`  
✅ Automatic backups scheduled  
✅ PM2 keeps it running 24/7  

**Next Steps:**
- Set up SSL certificates for HTTPS (see DEPLOYMENT_GUIDE.md)
- Schedule database backups with cron
- Monitor with `pm2 monit`

---

**Happy Deploying! 🚀**

For questions, refer to the comprehensive guides in this folder.

