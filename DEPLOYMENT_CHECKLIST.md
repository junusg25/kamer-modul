# ✅ Production Deployment Checklist

Use this checklist to ensure a smooth deployment to your Ubuntu server.

---

## 🔧 **Phase 1: Server Preparation**

### System Setup
- [ ] SSH access to server working (192.168.2.174)
- [ ] Server OS updated (`sudo apt update && sudo apt upgrade`)
- [ ] Node.js 18+ installed (`node -v`)
- [ ] PostgreSQL installed (`psql --version`)
- [ ] Nginx installed (`nginx -v`)
- [ ] PM2 installed (`pm2 -v`)
- [ ] Git installed (`git --version`)

### Directory Setup
- [ ] Application directory created (`/var/www/kamerba`)
- [ ] Proper permissions set (`chown $USER:$USER`)
- [ ] Logs directory created (`/var/www/kamerba/logs`)

---

## 🗄️ **Phase 2: Database Setup**

### PostgreSQL Configuration
- [ ] Database created (`repairshop`)
- [ ] Database user created (`repairshop_user`)
- [ ] Password set (secure, not default!)
- [ ] Privileges granted
- [ ] Database ownership transferred
- [ ] Connection tested successfully

### Schema & Data
- [ ] Schema loaded (`schema.sql`)
- [ ] No errors during schema load
- [ ] Tables created successfully
- [ ] Can query database

---

## 📦 **Phase 3: Application Setup**

### Code Deployment
- [ ] Repository cloned to `/var/www/kamerba`
- [ ] Latest code pulled from main branch
- [ ] All files present (frontend, backend, customer-portal)

### Backend Configuration
- [ ] `.env` file created in `/var/www/kamerba/backend/`
- [ ] Database credentials configured
- [ ] JWT secrets generated (NOT using defaults!)
- [ ] PORT set to 3000
- [ ] NODE_ENV set to production
- [ ] Dependencies installed (`npm install --production`)
- [ ] Backend tested manually (runs without errors)

### Frontend Build
- [ ] `.env.production` created
- [ ] API URL configured correctly
- [ ] Dependencies installed
- [ ] Build completed successfully (`npm run build`)
- [ ] `dist` folder exists with files

### Customer Portal Build
- [ ] `.env.production` created
- [ ] API URL configured correctly
- [ ] Dependencies installed
- [ ] Build completed successfully (`npm run build`)
- [ ] `dist` folder exists with files

---

## 🌐 **Phase 4: Web Server Setup**

### Nginx Configuration
- [ ] Site config created (`/etc/nginx/sites-available/kamerba`)
- [ ] Site enabled (symlink in sites-enabled)
- [ ] Default site removed
- [ ] Configuration tested (`sudo nginx -t`)
- [ ] Nginx restarted
- [ ] Nginx enabled on boot
- [ ] Can access static files

### Reverse Proxy
- [ ] API proxy working (`/api` routes to backend)
- [ ] WebSocket proxy configured (`/socket.io`)
- [ ] CORS headers configured
- [ ] File upload size set (50M)

---

## 🚀 **Phase 5: Process Manager**

### PM2 Setup
- [ ] `ecosystem.config.js` present
- [ ] Backend started with PM2
- [ ] PM2 configuration saved
- [ ] PM2 startup configured (runs on boot)
- [ ] Backend shows as "online" in `pm2 status`
- [ ] No errors in `pm2 logs`

---

## 🔒 **Phase 6: Security**

### Credentials & Secrets
- [ ] Database password changed from default
- [ ] JWT secrets generated (not using defaults)
- [ ] Default admin password will be changed after first login
- [ ] All `.env` files have restrictive permissions

### Firewall
- [ ] UFW enabled
- [ ] Port 22 (SSH) allowed
- [ ] Port 80 (HTTP) allowed
- [ ] Port 443 (HTTPS) allowed
- [ ] Unnecessary ports closed

### Application Security
- [ ] CORS configured correctly
- [ ] Security headers in Nginx config
- [ ] File upload restrictions in place
- [ ] Rate limiting enabled (if configured)

---

## 📊 **Phase 7: Monitoring & Maintenance**

### Logging
- [ ] PM2 logs working (`pm2 logs`)
- [ ] Nginx logs accessible
- [ ] Log rotation configured (optional)
- [ ] Can view application errors

### Backups
- [ ] Database backup script working
- [ ] Backup script executable
- [ ] Cron job configured for daily backups
- [ ] Backup retention policy set (7 days)
- [ ] Backup directory exists (`/var/backups/kamerba`)

### Health Checks
- [ ] Backend health endpoint responding (`/api/health`)
- [ ] Database queries working
- [ ] Can create/read/update/delete data
- [ ] WebSocket connections working

---

## 🧪 **Phase 8: Testing**

### Functional Testing
- [ ] Can access main dashboard
- [ ] Can access customer portal
- [ ] Can login to main dashboard
- [ ] Can login to customer portal
- [ ] Can create repair ticket
- [ ] Can create work order
- [ ] Can track items in customer portal
- [ ] Real-time updates working (WebSocket)

### Performance Testing
- [ ] Page load times acceptable
- [ ] API responses fast
- [ ] No console errors in browser
- [ ] Mobile responsive (test on phone)

---

## 📝 **Phase 9: Documentation**

### Internal Documentation
- [ ] Admin credentials documented (securely!)
- [ ] Database credentials documented (securely!)
- [ ] Deployment process documented
- [ ] Troubleshooting guide accessible

### User Documentation
- [ ] User guide available (if needed)
- [ ] Customer portal instructions
- [ ] Contact information updated

---

## 🎉 **Phase 10: Go Live**

### Final Checks
- [ ] All above items completed
- [ ] Team trained on system
- [ ] Support contact information ready
- [ ] Rollback plan documented
- [ ] Backup before going live

### Post-Launch
- [ ] Monitor logs for errors
- [ ] Check system resources (CPU, memory)
- [ ] Verify all features working
- [ ] Users can access the system
- [ ] Data is being saved correctly

---

## 🔄 **Ongoing Maintenance**

### Daily
- [ ] Check `pm2 status`
- [ ] Monitor disk space
- [ ] Review error logs

### Weekly
- [ ] Verify backups are running
- [ ] Check for security updates
- [ ] Review system performance

### Monthly
- [ ] Test backup restoration
- [ ] Review and rotate logs
- [ ] Update dependencies if needed
- [ ] Performance optimization review

---

## 📞 **Emergency Contacts**

- **Server Issues**: Check PM2 logs (`pm2 logs`)
- **Database Issues**: Check PostgreSQL logs
- **Web Server Issues**: Check Nginx logs (`sudo tail -f /var/log/nginx/error.log`)
- **Application Issues**: Check application logs in `/var/www/kamerba/logs/`

---

## 🛠️ **Quick Recovery Commands**

```bash
# Restart everything
pm2 restart all
sudo systemctl restart nginx

# View all logs
pm2 logs

# Check all services
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql

# Restore from backup
gunzip -c /var/backups/kamerba/backup_YYYYMMDD_HHMMSS.sql.gz | psql -U repairshop_user -d repairshop
```

---

**Last Updated**: $(date)

**Deployment Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete

Mark this checklist as you complete each item!

