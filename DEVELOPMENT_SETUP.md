# Development Setup Guide

## Port Configuration

Your repair shop application uses **two separate servers** to avoid conflicts:

- **Frontend (React)**: Port 3000
- **Backend (Node.js API)**: Port 3001

## Quick Start

### Option 1: Use Startup Scripts (Recommended)
```bash
# Windows Batch
start-dev.bat

# PowerShell
start-dev.ps1
```

### Option 2: Manual Start
```bash
# Terminal 1 - Backend
cd repairshop-backend
npm run dev

# Terminal 2 - Frontend  
cd repairshop-frontend
npm run dev
```

## Access URLs

- **Frontend Application**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health
- **Cache Stats**: http://localhost:3001/api/cache/stats

## Why This Setup?

### Port Conflict Resolution
- **Frontend**: Serves React app with hot reload
- **Backend**: Serves API endpoints
- **Proxy**: Frontend proxies `/api/*` requests to backend

### Benefits
- ✅ **No port conflicts** between frontend and backend
- ✅ **Hot reload** for both frontend and backend
- ✅ **API proxy** - frontend automatically routes API calls
- ✅ **Separate processes** for better debugging

## Troubleshooting

### "Can't find /xxx on this server"
This usually means:
1. **Backend not running** on port 3001
2. **Frontend trying to access** non-existent routes
3. **Port conflict** between servers

### "Connection refused"
Check:
1. **Backend status**: http://localhost:3001/health
2. **Port availability**: `netstat -ano | findstr :3001`
3. **Process conflicts**: Kill any conflicting processes

### Frontend Shows JSON Instead of React App
This means:
1. **Frontend not running** on port 3000
2. **Wrong port** - accessing backend instead of frontend
3. **Proxy misconfiguration**

## Development Workflow

1. **Start Backend First**
   ```bash
   cd repairshop-backend
   npm run dev
   ```

2. **Start Frontend Second**
   ```bash
   cd repairshop-frontend
   npm run dev
   ```

3. **Access Application**
   - Open http://localhost:3000 in browser
   - API calls automatically proxy to backend

## Environment Variables

### Backend (.env)
```bash
PORT=3001
NODE_ENV=development
# ... other variables
```

### Frontend (vite.config.js)
```javascript
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true
    }
  }
}
```

## Production Deployment

In production:
- **Single server** (no port conflicts)
- **Static build** of frontend served by backend
- **Environment variables** control configuration
- **Process manager** (PM2, Docker, etc.)

## Need Help?

1. **Check ports**: Ensure no conflicts
2. **Verify processes**: Both servers running
3. **Check logs**: Look for error messages
4. **Restart servers**: Kill and restart both processes

## Common Commands

```bash
# Check what's using port 3001
netstat -ano | findstr :3001

# Kill process by PID
taskkill /PID <PID> /F

# Check running Node processes
tasklist | findstr node

# Restart both servers
# 1. Kill existing processes
# 2. Run startup script
```
