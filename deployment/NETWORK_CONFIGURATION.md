# 🌐 Network Configuration Guide - Tailscale + Local Network

## 📡 Your Network Setup

You have **two IP addresses** for accessing your Ubuntu server:

| Network Type | IP Address | Use Case |
|-------------|------------|----------|
| **Local LAN** | `192.168.2.174` | Access from same network (home/office) |
| **Tailscale VPN** | `100.114.201.33` | Remote access from anywhere |

---

## 🎯 Recommended Configuration

**Use BOTH IP addresses** - this gives you maximum flexibility:

✅ **Local network (192.168.2.174)**: Fast, direct connection when at home/office  
✅ **Tailscale (100.114.201.33)**: Secure remote access from anywhere  

The application will work on **both** automatically with proper configuration!

---

## ⚙️ Configuration Strategy

### **Backend Configuration**

The backend should accept connections from both IPs. Update your `.env` file:

```env
# Database Configuration
DB_USER=repairshop_user
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=repairshop

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret
JWT_REFRESH_SECRET=your_secure_refresh_secret

# Server Configuration
PORT=3000
NODE_ENV=production

# CORS Configuration - Allow both IPs
FRONTEND_URL=http://192.168.2.174,http://100.114.201.33
```

### **Frontend Configuration**

Create **TWO** environment files for flexibility:

**Option 1: Use Local IP** (`frontend/.env.production.local`)
```env
VITE_API_BASE_URL=http://192.168.2.174:3000/api
```

**Option 2: Use Tailscale IP** (`frontend/.env.production.tailscale`)
```env
VITE_API_BASE_URL=http://100.114.201.33:3000/api
```

**Option 3: Auto-detect** (Recommended)
```env
# Use the current host's IP
VITE_API_BASE_URL=http://${window.location.hostname}:3000/api
```

---

## 🔧 Backend CORS Update

Update `backend/index.js` to accept both IPs:

```javascript
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://192.168.2.174',           // Local network
  'http://192.168.2.174:5173',      // Local dev
  'http://192.168.2.174:5174',      // Local customer portal
  'http://100.114.201.33',          // Tailscale
  'http://100.114.201.33:5173',     // Tailscale dev
  'http://100.114.201.33:5174',     // Tailscale customer portal
];
```

---

## 📝 Nginx Configuration for Both IPs

Update `nginx.conf` to listen on all interfaces:

```nginx
upstream backend {
    server localhost:3000;
}

server {
    listen 80;
    listen [::]:80;
    # Accept connections from any IP
    server_name 192.168.2.174 100.114.201.33 localhost;

    # Frontend
    location / {
        root /var/www/kamerba/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Customer Portal
    location /portal {
        alias /var/www/kamerba/customer-portal/dist;
        try_files $uri $uri/ /portal/index.html;
    }

    # API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    client_max_body_size 50M;
}
```

---

## 🚀 Smart Deployment - Auto-Detect IP

### Create Dynamic API Configuration

Update your frontend to automatically use the correct IP:

**`frontend/src/config.ts`** (create this file):

```typescript
// Auto-detect the correct API URL based on current host
const getApiBaseUrl = (): string => {
  const hostname = window.location.hostname;
  
  // If accessing via Tailscale IP
  if (hostname === '100.114.201.33') {
    return 'http://100.114.201.33:3000/api';
  }
  
  // If accessing via local IP
  if (hostname === '192.168.2.174') {
    return 'http://192.168.2.174:3000/api';
  }
  
  // Fallback to localhost for development
  return 'http://localhost:3000/api';
};

export const API_BASE_URL = getApiBaseUrl();
```

Then use it in your API service:

```typescript
// frontend/src/services/api.ts
import { API_BASE_URL } from '../config';

class ApiService {
  private baseUrl = API_BASE_URL;
  // ... rest of your code
}
```

---

## 🌍 Access URLs After Deployment

### Via Local Network (192.168.2.174):
- **Main Dashboard**: `http://192.168.2.174/`
- **Customer Portal**: `http://192.168.2.174/portal/`
- **API**: `http://192.168.2.174/api/health`

### Via Tailscale (100.114.201.33):
- **Main Dashboard**: `http://100.114.201.33/`
- **Customer Portal**: `http://100.114.201.33/portal/`
- **API**: `http://100.114.201.33/api/health`

Both will work! 🎉

---

## 🔒 Firewall Configuration

### Ubuntu UFW (for local network)
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### Tailscale
Tailscale automatically handles firewall rules! No additional configuration needed for Tailscale connections.

---

## 🧪 Testing Both Networks

### Test Local Access:
```bash
# From a device on your local network
curl http://192.168.2.174/api/health
```

### Test Tailscale Access:
```bash
# From any device with Tailscale connected
curl http://100.114.201.33/api/health
```

Both should return the same health check response!

---

## 💡 Recommended Approach

### For Maximum Compatibility:

1. **Configure Nginx** to listen on all interfaces (0.0.0.0)
2. **Update backend CORS** to allow both IPs
3. **Build frontend ONCE** - it will auto-detect which IP to use
4. **Access via either IP** - both work seamlessly

### Simple Setup:
- Use **local IP (192.168.2.174)** in configuration files
- Nginx listens on all interfaces by default
- Tailscale routing automatically maps 100.114.201.33 → 192.168.2.174
- **No changes needed!** It will just work! ✨

---

## 🎯 Quick Answer

**TL;DR**: Using just the **local IP (192.168.2.174)** in your configuration is **enough**!

Tailscale automatically routes traffic from `100.114.201.33` to your server's local IP `192.168.2.174`. 

**You don't need to update any configuration files** - they'll work with both IPs automatically! 🎉

---

## 🔍 How It Works

```
Remote Client (Tailscale)
    ↓
100.114.201.33 (Tailscale IP)
    ↓
Tailscale Magic™ (automatic routing)
    ↓
192.168.2.174 (Local IP)
    ↓
Your Ubuntu Server
    ↓
Nginx (listening on all interfaces)
    ↓
Your Application
```

---

## 📝 Verification Steps

After deployment, test both:

1. **Local network test:**
   ```bash
   curl http://192.168.2.174/api/health
   ```

2. **Tailscale test:**
   ```bash
   curl http://100.114.201.33/api/health
   ```

Both should work without any changes!

---

## 🆘 Troubleshooting

### If Tailscale IP doesn't work:

1. **Check Nginx is listening on all interfaces:**
   ```bash
   sudo netstat -tlnp | grep nginx
   # Should show: 0.0.0.0:80
   ```

2. **Check Tailscale is running:**
   ```bash
   sudo tailscale status
   ```

3. **Check UFW isn't blocking:**
   ```bash
   sudo ufw status
   # Port 80 should be allowed
   ```

4. **Test Tailscale connectivity:**
   ```bash
   ping 100.114.201.33
   ```

---

## ✅ Conclusion

**You can keep using 192.168.2.174 in all configuration files.**

Tailscale automatically handles the routing from 100.114.201.33 to 192.168.2.174.

No additional configuration needed! 🎉

