#!/bin/bash

# Initial Server Setup Script for Kamer.ba
# Run this script on a fresh Ubuntu server

set -e

echo "🔧 Kamer.ba Server Setup Script"
echo "================================================"
echo "This will install all required dependencies"
echo "Server: $(hostname)"
echo "IP: $(hostname -I | awk '{print $1}')"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Please do not run this script as root"
    echo "Run as a regular user with sudo privileges"
    exit 1
fi

# Update system
echo "📦 Updating system packages..."
sudo apt update
# Upgrade with error handling for missing packages
sudo apt upgrade -y || {
    echo "⚠️  Some packages failed to upgrade, but continuing..."
    sudo apt upgrade -y --fix-missing || true
}

# Install Node.js
echo ""
echo "📦 Installing Node.js 18 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    echo "✓ Node.js $(node -v) installed"
else
    echo "✓ Node.js $(node -v) already installed"
fi

# Install PostgreSQL
echo ""
echo "📦 Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    sudo apt install -y postgresql postgresql-contrib
    echo "✓ PostgreSQL installed"
else
    echo "✓ PostgreSQL already installed"
fi

# Install Nginx
echo ""
echo "📦 Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    echo "✓ Nginx installed"
else
    echo "✓ Nginx already installed"
fi

# Install PM2
echo ""
echo "📦 Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo "✓ PM2 installed"
else
    echo "✓ PM2 already installed"
fi

# Install Git (if not present)
echo ""
echo "📦 Checking Git installation..."
if ! command -v git &> /dev/null; then
    sudo apt install -y git
    echo "✓ Git installed"
else
    echo "✓ Git already installed"
fi

# Install useful tools
echo ""
echo "📦 Installing additional tools..."
sudo apt install -y curl wget htop unzip zip

# Create application directory
echo ""
echo "📁 Creating application directory..."
sudo mkdir -p /var/www/kamerba
sudo chown -R $USER:$USER /var/www/kamerba
echo "✓ Directory created at /var/www/kamerba"

# Create logs directory
mkdir -p /var/www/kamerba/logs
echo "✓ Logs directory created"

# Setup PostgreSQL
echo ""
echo "🗄️  Setting up PostgreSQL..."
echo "================================================"
echo "You'll need to create a database and user manually"
echo ""
echo "Run these commands:"
echo "  sudo -u postgres psql"
echo ""
echo "Then in PostgreSQL shell:"
echo "  CREATE DATABASE repairshop;"
echo "  CREATE USER repairshop_user WITH PASSWORD 'your_secure_password';"
echo "  GRANT ALL PRIVILEGES ON DATABASE repairshop TO repairshop_user;"
echo "  ALTER DATABASE repairshop OWNER TO repairshop_user;"
echo "  \q"
echo ""
read -p "Press Enter after you've set up the database..."

# Configure firewall
echo ""
echo "🔥 Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 22/tcp   # SSH
    sudo ufw allow 80/tcp   # HTTP
    sudo ufw allow 443/tcp  # HTTPS
    
    # Ask before enabling
    read -p "Enable firewall? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo ufw --force enable
        echo "✓ Firewall enabled"
    fi
else
    echo "⚠️  UFW not available, skipping firewall setup"
fi

# Start and enable services
echo ""
echo "🚀 Starting services..."
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo systemctl start nginx
sudo systemctl enable nginx

echo "✓ PostgreSQL started and enabled"
echo "✓ Nginx started and enabled"

# Summary
echo ""
echo "================================================"
echo "✅ Server Setup Complete!"
echo "================================================"
echo ""
echo "📋 Next Steps:"
echo "1. Clone your repository to /var/www/kamerba"
echo "   cd /var/www/kamerba"
echo "   git clone https://github.com/junusg25/kamer-modul.git ."
echo ""
echo "2. Configure backend environment"
echo "   cd backend"
echo "   cp .env.example .env"
echo "   nano .env  # Edit with your settings"
echo ""
echo "3. Run database schema"
echo "   sudo -u postgres psql -d repairshop -f backend/schema.sql"
echo ""
echo "4. Run deployment script"
echo "   cd /var/www/kamerba"
echo "   chmod +x deploy.sh"
echo "   ./deploy.sh"
echo ""
echo "5. Configure Nginx"
echo "   sudo nano /etc/nginx/sites-available/kamerba"
echo "   # See DEPLOYMENT_GUIDE.md for configuration"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT_GUIDE.md"
echo ""

