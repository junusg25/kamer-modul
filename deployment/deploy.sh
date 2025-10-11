#!/bin/bash

# Kamer.ba Deployment Script
# This script automates the deployment process

set -e  # Exit on any error

echo "🚀 Starting Kamer.ba Deployment..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory (deployment folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Go to project root (parent of deployment folder)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    print_error "This script is designed for Linux servers"
    exit 1
fi

# Pull latest changes
print_status "Pulling latest code from Git..."
if git pull origin main; then
    print_status "Code updated successfully"
else
    print_error "Failed to pull latest code"
    exit 1
fi

# Backend deployment
echo ""
echo "📦 Deploying Backend..."
echo "------------------------------------------------"
cd backend

print_status "Installing backend dependencies..."
npm install --production

# Check if .env exists
if [ ! -f .env ]; then
    print_warning ".env file not found! Please create it before continuing."
    print_warning "Copy .env.example and update with production values"
    exit 1
fi

print_status "Backend dependencies installed"

# Frontend deployment
echo ""
echo "🎨 Building Frontend..."
echo "------------------------------------------------"
cd ../frontend

print_status "Installing frontend dependencies..."
npm install

print_status "Building frontend for production..."
if npm run build; then
    print_status "Frontend built successfully"
else
    print_error "Frontend build failed"
    exit 1
fi

# Customer Portal deployment
echo ""
echo "🌐 Building Customer Portal..."
echo "------------------------------------------------"
cd ../customer-portal

print_status "Installing customer portal dependencies..."
npm install

print_status "Building customer portal for production..."
if npm run build; then
    print_status "Customer portal built successfully"
else
    print_error "Customer portal build failed"
    exit 1
fi

# Return to deployment directory
cd "$SCRIPT_DIR"

# Restart PM2 if it's running
if command -v pm2 &> /dev/null; then
    echo ""
    echo "🔄 Restarting Backend Service..."
    echo "------------------------------------------------"
    
    if pm2 list | grep -q "kamerba-backend"; then
        print_status "Restarting PM2 process..."
        pm2 restart kamerba-backend
        print_status "Backend restarted successfully"
    else
        print_warning "PM2 process not found. Starting new process..."
        cd "$SCRIPT_DIR"  # Use ecosystem.config.js from deployment folder
        pm2 start ecosystem.config.js
        pm2 save
        print_status "Backend started successfully"
    fi
    
    # Show PM2 status
    pm2 status
else
    print_warning "PM2 not installed. Please install PM2: npm install -g pm2"
fi

# Reload Nginx if it's running
if command -v nginx &> /dev/null; then
    echo ""
    echo "♻️ Reloading Nginx..."
    echo "------------------------------------------------"
    
    if sudo nginx -t; then
        sudo systemctl reload nginx
        print_status "Nginx reloaded successfully"
    else
        print_error "Nginx configuration test failed"
        exit 1
    fi
else
    print_warning "Nginx not installed. Static files will not be served."
fi

# Summary
echo ""
echo "================================================"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "📍 Access your applications at:"
echo "   • Main Dashboard: http://192.168.2.174/"
echo "   • Customer Portal: http://192.168.2.174/portal/"
echo "   • API Health: http://192.168.2.174/api/health"
echo ""
echo "📊 Useful commands:"
echo "   • View logs: pm2 logs kamerba-backend"
echo "   • Monitor: pm2 monit"
echo "   • Status: pm2 status"
echo ""
print_status "Deployment completed successfully at $(date)"

