# 🔧 Kamer BA - Repair Shop Management System

A comprehensive, modern web application for managing repair shop operations, customer relationships, warranty tracking, sales pipeline, rental management, and business analytics.

**Version:** 0.6.0  
**Status:** ✅ Production Ready  
**Last Updated:** October 2025

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Database Setup](#-database-setup)
- [Deployment](#-deployment)
- [Recent Improvements](#-recent-improvements)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Features

### ✅ Core Features
- **Customer Management** - Complete customer profiles with sales history
- **Machine Management** - Equipment tracking, models, serials, assignments, and sales
- **Repair Tickets** - Service request tracking with conversion to work orders
- **Warranty Tickets** - Separate warranty repair workflow
- **Work Orders** - Comprehensive repair job management (regular & warranty)
- **Inventory Management** - Parts tracking with low-stock alerts
- **User Management** - Team members with role-based permissions

### ✅ Sales & CRM
- **Pipeline & Leads** - Lead tracking with follow-up scheduling
- **Quote Management** - Professional quote creation with templates
- **Sales Reports** - Analytics, trends, and performance tracking
- **Sales Targets** - Individual and team goal management

### ✅ Rental System
- **Rental Fleet** - Manage rental machines
- **Active Rentals** - Track rentals with automatic status updates
- **Dynamic Pricing** - Automated pricing optimization

### ✅ Recent Additions (October 2025)
- **Pagination** - All data tables show 25 rows with page navigation
- **Year Filtering** - Filter tickets/orders by year (2024, 2025, 2026, etc.)
- **Accent-Insensitive Search** - Search "cinjarevic" finds "Činjarević"
- **User Editing** - Edit user details and change passwords from settings
- **Customer Portal** - Customers can track their repairs and machines
- **PDF Generation** - Print/download tickets, orders, and quotes
- **Real-Time Sync** - WebSocket for live updates across PM2 cluster

---

## 🛠 Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- Socket.IO Client
- React Router 6

### Backend
- Node.js 18+
- Express.js
- PostgreSQL 12+
- Socket.IO
- Puppeteer (PDF generation)
- PM2 (cluster mode)

### Database
- PostgreSQL with extensions:
  - `pg_trgm` - Text search optimization
  - `unaccent` - Accent-insensitive search

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Git

### Local Development

```bash
# 1. Clone repository
git clone https://github.com/junusg25/kamer-modul.git
cd kamer-modul

# 2. Setup database
sudo -u postgres psql
CREATE DATABASE repairshop;
CREATE USER admin WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE repairshop TO admin;
\c repairshop
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
\q

# Import schema
sudo -u postgres psql repairshop < backend/schema.sql

# 3. Backend setup
cd backend
npm install
cp env.example .env
# Edit .env with your database credentials
npm run dev

# 4. Frontend setup (new terminal)
cd frontend
npm install
npm run dev

# 5. Customer Portal setup (optional, new terminal)
cd customer-portal
npm install
npm run dev
```

**Access:**
- Main Frontend: http://localhost:5173
- Customer Portal: http://localhost:5174
- Backend API: http://localhost:3000

---

## 📊 Database Setup

### Required Migrations

All migrations are in `backend/migrations/` directory. Run them in order:

```bash
cd /var/www/kamerba

# Core migrations (run if needed)
sudo -u postgres psql repairshop -f backend/migrations/001_add_online_users_table.sql
sudo -u postgres psql repairshop -f backend/migrations/004_separate_sequences_by_type.sql
sudo -u postgres psql repairshop -f backend/migrations/006_enable_accent_insensitive_search.sql
sudo -u postgres psql repairshop -f backend/migrations/008_create_sales_targets_table.sql
sudo -u postgres psql repairshop -f backend/migrations/010_create_user_table_preferences.sql
sudo -u postgres psql repairshop -f backend/migrations/011_create_user_action_logs.sql
sudo -u postgres psql repairshop -f backend/migrations/012_enhance_quotes_system.sql
sudo -u postgres psql repairshop -f backend/migrations/014_customer_portal_setup.sql

# Data cleanup migrations (optional, use with caution)
# sudo -u postgres psql repairshop -f backend/migrations/002_truncate_all_tables_except_users.sql
# sudo -u postgres psql repairshop -f backend/migrations/005_reset_repair_and_warranty_tickets.sql
```

### Migration Reference

| Migration | Purpose | Required |
|-----------|---------|----------|
| 001 | Online users table (PM2 cluster support) | ✅ Yes |
| 002 | Truncate all tables except users | ⚠️ Data wipe |
| 003 | Fix machine_models_with_stats view | ✅ Yes |
| 004 | Separate sequences by type (TK/WT/WO/WW) | ✅ Yes |
| 005 | Reset repair/warranty tickets | ⚠️ Data wipe |
| 006 | Enable accent-insensitive search | ✅ Yes |
| 008 | Create sales targets table | ✅ Yes |
| 010 | User table preferences (column visibility) | ✅ Yes |
| 011 | User action logs (audit trail) | ✅ Yes |
| 012 | Enhance quotes system | ✅ Yes |
| 013 | Quote yearly numbering | ✅ Yes |
| 014 | Customer portal setup | ✅ Yes (if using portal) |

---

## 🚀 Deployment

### Server Deployment (PM2 Cluster Mode)

```bash
# 1. Pull latest code
cd /var/www/kamerba
git pull origin main

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install
cd ../customer-portal && npm install

# 3. Run required migrations (see Database Setup above)

# 4. Build frontend
cd /var/www/kamerba/frontend
npm run build

# 5. Build customer portal
cd /var/www/kamerba/customer-portal
npm run build

# 6. Install Puppeteer dependencies (for PDF generation)
sudo apt-get update
sudo apt-get install -y chromium-browser

# 7. Start/restart PM2
cd /var/www/kamerba
pm2 stop all
pm2 delete all
pm2 start deployment/ecosystem.config.js
pm2 save

# 8. Setup PM2 startup
pm2 startup
# Follow the command it outputs
```

### PM2 Configuration

The app runs in cluster mode with 2 backend instances:

```javascript
// deployment/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'backend',
      script: './backend/index.js',
      instances: 2,
      exec_mode: 'cluster',
      // ... more config
    },
    {
      name: 'frontend-desktop',
      script: 'npm',
      args: 'run preview',
      cwd: './frontend',
      // ... more config
    }
  ]
}
```

### Force Backend Restart

If `pm2 restart` doesn't pick up new routes:

```bash
cd /var/www/kamerba
chmod +x FORCE_BACKEND_RESTART.sh
./FORCE_BACKEND_RESTART.sh
```

---

## ✨ Recent Improvements

### October 2025 Updates

#### ✅ Pagination (All Pages)
- **What**: All data tables now show 25 rows per page with navigation
- **Pages Updated**: 10 pages (customers, machines, inventory, tickets, orders, leads, quotes, rentals)
- **Benefits**: Faster loading, better UX, consistent behavior

#### ✅ Year Filtering
- **What**: Filter tickets/orders by year (TK-XX/25 for 2025)
- **Pages Updated**: Repair tickets, work orders, warranty tickets, warranty work orders
- **Smart**: Only shows years that have actual data
- **Default**: Current year automatically selected

#### ✅ Accent-Insensitive Search
- **What**: Search "cinjarevic" finds "Činjarević"
- **Supported**: č, ć, š, đ, ž, ä, ö, ü, and all accents
- **Pages Updated**: All search functionality (10+ pages)
- **Database**: Uses PostgreSQL `unaccent` extension

#### ✅ User Management
- **What**: Edit user details and change passwords from settings
- **Features**: Edit button and Password button on each user card
- **Fields**: Name, email, role, status, phone, department

#### ✅ PDF Printing Fixed
- **What**: Dynamic API URLs for PDF generation
- **Fixed**: 16 hardcoded localhost URLs replaced
- **Works**: On any server without reconfiguration

#### ✅ Customer Portal Fixed
- **What**: Dynamic API URL detection
- **Fixed**: Connection timeout errors
- **Works**: Automatically adapts to deployment environment

#### ✅ Independent Ticket Numbering
- **What**: Separate sequences for each ticket type
- **Result**: TK-01/25, WT-01/25, WO-01/25, WW-01/25 (independent counters)
- **Database**: yearly_sequences table with prefix column

---

## 🔍 Search Features

### Accent-Insensitive Search

Search now works with or without accents:

```
Search: "cinjarevic" → Finds: "Činjarević" ✅
Search: "karcher" → Finds: "Kärcher" ✅
Search: "dzevad" → Finds: "Dževad" ✅
```

**Works everywhere:**
- Customer names and companies
- Machine names and manufacturers
- Ticket descriptions
- Work order descriptions
- Lead names
- Quote titles
- Inventory items

### Year Filtering

Filter historical data by year:

```
Year: 2024 → Shows only TK-XX/24 tickets
Year: 2025 → Shows only TK-XX/25 tickets (default)
Year: 2026 → Shows only TK-XX/26 tickets
```

**Available on:**
- Repair Tickets
- Work Orders
- Warranty Repair Tickets
- Warranty Work Orders

---

## 🔐 Authentication

### Default Admin Account
After running schema.sql, login with:
- **Email**: `admin@kamer.ba`
- **Password**: `admin`

⚠️ **Change the default password immediately in production!**

### User Roles
- **Admin** - Full system access
- **Manager** - Operations and reporting
- **Technician** - Repairs and service
- **Sales** - CRM and sales features

---

## 🛠 Troubleshooting

### Year Filter Returns 404

```bash
# Force PM2 to reload routes
cd /var/www/kamerba
pm2 stop all
pm2 delete all
pm2 flush
pm2 start deployment/ecosystem.config.js
pm2 save
```

### PDF Generation Fails (500 Error)

```bash
# Install Puppeteer dependencies
sudo apt-get update
sudo apt-get install -y chromium-browser
pm2 restart backend
```

### Machine Rentals Page Blank

```bash
# Rebuild frontend with latest fixes
cd /var/www/kamerba/frontend
npm run build
pm2 restart frontend-desktop
```

### Search Not Finding Accented Names

```bash
# Enable unaccent extension
sudo -u postgres psql repairshop -c "CREATE EXTENSION IF NOT EXISTS unaccent;"

# Run migration
sudo -u postgres psql repairshop -f backend/migrations/006_enable_accent_insensitive_search.sql

# Restart backend
pm2 restart backend
```

---

## 📁 Project Structure

```
repairshop-app/
├── frontend/              # Main admin/staff app
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Page components
│   │   ├── contexts/     # React contexts
│   │   ├── services/     # API service
│   │   └── lib/          # Utilities
│   └── dist/             # Production build
├── customer-portal/       # Customer self-service portal
│   ├── src/
│   └── dist/
├── backend/              # Node.js API server
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── middleware/      # Express middleware
│   ├── migrations/      # Database migrations
│   ├── templates/       # PDF templates
│   └── logs/            # Application logs
├── deployment/          # Deployment configs
│   ├── ecosystem.config.js  # PM2 config
│   ├── nginx.conf.example   # Nginx template
│   ├── deploy.sh            # Deployment script
│   └── DEPLOY.md            # Deployment guide
└── README.md            # This file
```

---

## 📦 Dependencies

### Backend Key Packages
- express - Web framework
- pg - PostgreSQL client
- socket.io - Real-time communication
- puppeteer - PDF generation
- bcrypt - Password hashing
- jsonwebtoken - Authentication
- winston - Logging

### Frontend Key Packages
- react + react-dom - UI framework
- @tanstack/react-query - Data fetching
- socket.io-client - Real-time updates
- sonner - Toast notifications
- lucide-react - Icons
- tailwindcss - Styling

---

## 🔢 Ticket Numbering System

### Format
- Repair Tickets: `TK-01/25` (TK = ticket, 01 = sequence, 25 = year 2025)
- Warranty Tickets: `WT-01/25` (independent sequence)
- Work Orders: `WO-01/25` (independent sequence)
- Warranty Work Orders: `WW-01/25` (independent sequence)
- Quotes: `QT-01/25` (independent sequence)

### Features
- ✅ Independent sequences per type
- ✅ Automatic yearly reset (01 on Jan 1st)
- ✅ Two-digit formatting (01, 02, ..., 99)
- ✅ Database trigger auto-generation

---

## 🎨 UI/UX Features

### Pagination
- 25 rows per page (all data tables)
- Smart page numbers (1, 2, 3, ..., last)
- Shows "Showing X to Y of Z items"
- Resets to page 1 when filters change

### Search
- Accent-insensitive (č = c, ć = c, š = s, etc.)
- Case-insensitive
- Works on names, descriptions, models, manufacturers
- Real-time filtering

### Filters
- Year filter (for tickets/orders)
- Status filter
- Priority filter
- Technician filter
- Customer filter
- And more...

### Dark/Light Theme
- Full support across all pages
- User preference saved
- Smooth transitions

---

## 📱 Access URLs

### Local Development
- Main Frontend: http://localhost:5173
- Customer Portal: http://localhost:5174
- Backend API: http://localhost:3000

### Production (Server)
- Main App: http://100.114.201.33/
- Customer Portal: http://100.114.201.33/portal/
- Backend API: http://100.114.201.33/api

---

## 🔐 Security

- JWT authentication with refresh tokens
- Role-based access control
- Granular permission system
- Password hashing (bcrypt)
- Input validation
- SQL injection prevention
- Rate limiting
- Helmet security headers
- Audit logging

---

## 📊 Performance

### Optimizations
- Database indexes (GIN, composite)
- Query pagination (25 rows per page)
- Connection pooling
- Redis caching (optional)
- Functional indexes for unaccent()
- PM2 cluster mode (2 instances)

### Monitoring
- Winston logging
- PM2 process management
- Database query logging
- Error tracking

---

## 🐛 Common Issues & Fixes

### 1. Build Fails on Server

```bash
cd /var/www/kamerba
git pull origin main
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

### 2. Routes Return 404 After Update

```bash
# Use force restart script
cd /var/www/kamerba
chmod +x FORCE_BACKEND_RESTART.sh
./FORCE_BACKEND_RESTART.sh
```

### 3. PDF Generation Fails

```bash
# Install Chrome dependencies
sudo apt-get install -y chromium-browser
pm2 restart backend
```

### 4. Search Not Working

```bash
# Enable unaccent extension
sudo -u postgres psql repairshop -f backend/migrations/006_enable_accent_insensitive_search.sql
pm2 restart backend
```

### 5. Year Filter Shows Error

```bash
# Ensure backend has latest routes
pm2 stop all && pm2 delete all
pm2 start deployment/ecosystem.config.js
pm2 save
```

---

## 📚 Documentation Files

All documentation is consolidated in this README. Additional specific guides:

- **deployment/DEPLOY.md** - Server deployment guide
- **deployment/README.md** - Deployment scripts documentation
- **CUSTOMER_PORTAL_SETUP.md** - Customer portal setup
- **FORCE_BACKEND_RESTART.sh** - PM2 restart script
- **SERVER_DEPLOYMENT_FIX.md** - Troubleshooting guide

---

## 🗂️ Database Migrations

### Migration Strategy

All migrations are in `backend/migrations/` directory:

1. **Run migrations in order** (numbered)
2. **Don't skip migrations** (may cause errors)
3. **Backup before running** data-wipe migrations (002, 005)
4. **Use force restart** after migration to reload routes

### Migration Types

**Structure Migrations** (Safe to run anytime):
- 001, 003, 004, 006, 008, 010, 011, 012, 013, 014

**Data Migrations** (⚠️ CAUTION - deletes data):
- 002 - Truncates all tables except users
- 005 - Resets repair and warranty tickets

---

## 🎯 Feature Roadmap

### Completed ✅
- Pagination (25 rows per page)
- Year filtering
- Accent-insensitive search
- User editing & password change
- PDF printing with dynamic URLs
- Customer portal tracking
- Independent ticket sequences

### In Progress 🔄
- Global command palette search (Ctrl+K)
- Mobile PWA frontend

### Planned 📋
- Email notifications
- SMS notifications
- Advanced reporting
- QR code scanning
- Multi-location support

---

## 🤝 Support

### Getting Help

1. Check this README
2. Review `deployment/DEPLOY.md`
3. Check `SERVER_DEPLOYMENT_FIX.md` for common issues
4. Check browser console (F12) for errors
5. Check backend logs: `pm2 logs backend`
6. Check database logs: `sudo -u postgres tail -f /var/log/postgresql/postgresql-*.log`

### Deployment Checklist

- [ ] Database created and extensions enabled
- [ ] Migrations run in order
- [ ] .env file configured with correct credentials
- [ ] Frontend built (`npm run build`)
- [ ] Customer portal built (if used)
- [ ] PM2 started and saved
- [ ] Nginx configured (if used)
- [ ] Firewall rules configured
- [ ] SSL certificates installed (if using HTTPS)
- [ ] Default admin password changed
- [ ] Puppeteer dependencies installed
- [ ] Test all major features

---

## 📞 Technical Details

### Port Configuration
- Frontend: 5173 (dev), 4173 (preview)
- Customer Portal: 5174 (dev), 4174 (preview)
- Backend: 3000
- PostgreSQL: 5432
- Redis: 6379 (optional)

### Environment Variables

**Backend (.env):**
```env
DB_USER=admin
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=repairshop

JWT_SECRET=your_secret_key
JWT_REFRESH_SECRET=your_refresh_secret

PORT=3000
NODE_ENV=production
```

### API Endpoints

Base URL: `/api`

**Auth:**
- POST `/auth/login`
- POST `/auth/logout`
- POST `/auth/refresh`

**Customers:**
- GET `/customers`
- POST `/customers`
- PUT `/customers/:id`
- DELETE `/customers/:id`

**Tickets:**
- GET `/repairTickets`
- GET `/repairTickets/filter/years`
- POST `/repairTickets`
- PUT `/repairTickets/:id`
- POST `/repairTickets/:id/convert`

**PDF:**
- GET `/print/repair-ticket/:id`
- GET `/print/warranty-ticket/:id`
- GET `/print/work-order/:id`
- GET `/print/warranty-work-order/:id`

*...and 100+ more endpoints*

---

## 🏆 Credits

**Built for:** Kamer BA  
**Development:** October 2024 - Present  
**Tech Stack:** React + Node.js + PostgreSQL  
**Deployment:** PM2 + Nginx

---

## 📄 License

Proprietary - All rights reserved

---

**🎉 The repair shop management system is production-ready and continuously improving!**

For deployment help, see `deployment/DEPLOY.md`  
For troubleshooting, see `SERVER_DEPLOYMENT_FIX.md`  
For quick fixes, use `FORCE_BACKEND_RESTART.sh`
