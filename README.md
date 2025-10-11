# 🔧 Repair Shop Management System

A comprehensive, modern web application for managing repair shop operations, customer relationships, sales pipeline, rental management, and business analytics. Built with React, TypeScript, Node.js, Express, and PostgreSQL.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Database](#-database)
- [Authentication & Authorization](#-authentication--authorization)
- [Key Systems](#-key-systems)
- [Development](#-development)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Features

### ✅ Core Management System
- **Authentication & Authorization** - Role-based access control with granular permissions
- **Dashboard** - Real-time overview with key metrics and activity
- **Customer Management** - Complete customer profiles with communication history
- **Machine Management** - Equipment tracking, models, serials, and assignments
- **Work Orders** - Comprehensive repair workflow management
- **Repair Tickets** - Service request tracking and conversion
- **Inventory Management** - Parts tracking with low-stock alerts
- **User Management** - Team member profiles and role assignments

### ✅ Sales & CRM System
- **Sales Dashboard** - Performance metrics and opportunity tracking
- **Lead Management** - Prospect tracking with follow-up scheduling
- **Sales Pipeline** - Visual Kanban board for deal progression
- **Quote Management** - Professional quote creation and tracking
- **Sales Reports** - Analytics, trends, and team performance
- **Sales Targets** - Set and track individual and team sales goals
- **Customer Value Analysis** - Purchase history and lifetime value

### ✅ Rental Management System
- **Rental Fleet** - Manage rental machines with status tracking
- **Machine Rentals** - Track active, reserved, and overdue rentals
- **Dynamic Pricing** - Automated pricing based on demand, season, and customer tier
- **Rental Analytics** - Comprehensive analytics dashboard with real-time insights
- **Automatic Status Updates** - Smart status transitions (reserved → active → overdue)

### ✅ Advanced Features
- **Real-Time Notifications** - WebSocket-powered instant updates
- **Toast Notifications** - Beautiful, consistent user feedback with Sonner
- **User Feedback System** - Built-in feedback widget for bug reports and feature requests
- **Granular Permissions** - User-specific permission overrides with audit trail
- **Comprehensive Audit Logging** - Track every user action across the entire system
- **Column Visibility** - Customizable table columns with user-specific preferences
- **Multi-Language Support** - English and Bosnian translations
- **Responsive Design** - Mobile-friendly interface
- **Export Functionality** - Data export to CSV/PDF
- **File Attachments** - Document and image uploads
- **Time Tracking** - Work hours and productivity monitoring
- **Analytics & Reporting** - Business intelligence dashboards
- **Dark/Light Theme** - Full theme support across entire application

---

## 🛠 Tech Stack

### Frontend
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **shadcn/ui** - High-quality, accessible UI components
- **Tailwind CSS** - Utility-first styling framework
- **Radix UI** - Unstyled, accessible UI primitives
- **Lucide React** - Beautiful, customizable icons
- **React Router 6** - Client-side routing
- **Sonner** - Beautiful toast notifications
- **Socket.IO Client** - Real-time communication

### Backend
- **Node.js 18+** - JavaScript runtime environment
- **Express.js** - Web application framework
- **PostgreSQL 17+** - Relational database with advanced features
- **Socket.IO** - Real-time bidirectional communication
- **Redis** - Caching and session storage (optional)
- **JWT** - JSON Web Token authentication
- **Helmet** - Security middleware
- **Express Rate Limit** - API protection
- **Winston** - Logging framework
- **Puppeteer** - PDF generation
- **Bcrypt** - Password hashing

### Database
- **PostgreSQL 17+** - Primary database
- **Redis** (optional) - Cache and session store
- **Database Views** - Optimized queries for analytics
- **GIN Indexes** - Full-text search optimization
- **Migrations** - Version-controlled schema changes
- **Triggers & Functions** - Automated data management

---

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 12+ database server
- **Redis** server (optional, for caching)
- **Git** for version control

---

## 🚀 Quick Start

### 1. Database Setup

#### Option A: Complete Backup (Recommended)
```sql
-- Create database and user in PostgreSQL
CREATE DATABASE repairshop;
CREATE USER repairadmin WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE repairshop TO repairadmin;

-- Enable required extensions
\c repairshop
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Run the comprehensive backup (includes all data and structure)
psql -U repairadmin -d repairshop -f "DB SA PRODAJOM FINAL.sql"
```

#### Option B: Schema Only (Clean Installation)
```sql
-- Create database and user in PostgreSQL
CREATE DATABASE repairshop;
CREATE USER repairadmin WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE repairshop TO repairadmin;

-- Enable required extensions
\c repairshop
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Run the schema file (structure only, no data)
psql -U repairadmin -d repairshop -f "backend/schema.sql"

-- Run migrations
cd backend
node run-migration.js
```

### 2. Backend Setup
```bash
cd backend
npm install
cp env.example .env
# Edit .env with your database credentials
npm run dev
```

**Backend .env Configuration:**
```env
# Database Configuration
DB_USER=repairadmin
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=repairshop

# JWT Configuration
JWT_SECRET=your_secret_key_here_make_it_long_and_secure
JWT_REFRESH_SECRET=your_refresh_secret_key_here_make_it_different

# Server Configuration
PORT=3000
NODE_ENV=development

# Optional: Logging Level
LOG_LEVEL=info
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 4. Using Startup Scripts (Recommended)
```bash
# Windows Batch
start-dev.bat

# PowerShell
start-dev.ps1
```

---

## 🌐 Access URLs

- **Frontend Application**: http://localhost:5173 (Vite dev server)
- **Backend API**: http://localhost:3000
- **API Health Check**: http://localhost:3000/health
- **Cache Statistics**: http://localhost:3000/api/cache/stats

---

## 🏗 Architecture

### Port Configuration
- **Frontend (React/Vite)**: Port 5173
- **Backend (Node.js API)**: Port 3000
- **PostgreSQL**: Port 5432 (default)
- **Redis**: Port 6379 (default, optional)

### Real-Time Features
The application uses WebSocket (Socket.IO) for real-time updates:
- Work order status changes
- New repair ticket notifications
- User presence indicators
- Inventory low-stock alerts
- Sales opportunity updates
- Feedback submissions

### Caching Strategy
Redis is used for (optional):
- Session storage
- API response caching
- Real-time data synchronization
- Performance optimization

---

## 📊 Database

### Core Tables
- `users` - System users with role-based access
- `customers` - Customer information and contacts
- `machine_models` - Equipment model definitions
- `machine_serials` - Individual machine serial numbers
- `assigned_machines` - Customer-machine relationships
- `repair_tickets` - Service requests and intake
- `warranty_repair_tickets` - Warranty service requests
- `work_orders` - Active repair jobs
- `warranty_work_orders` - Warranty repair jobs
- `inventory` - Parts and stock management

### Sales Tables
- `leads` - Sales prospects and opportunities
- `lead_follow_ups` - Follow-up activities and notes
- `quotes` - Customer quotations
- `quote_items` - Itemized quote details
- `sales_targets` - Individual and team sales targets

### Rental Tables
- `rental_machines` - Machines available for rent
- `machine_rentals` - Active and historical rentals
- `machine_pricing` - Base pricing for rental machines
- `pricing_rules` - Dynamic pricing rules
- `customer_pricing_tiers` - Customer loyalty tiers
- `demand_tracking` - Demand analytics for pricing
- `pricing_history` - Historical pricing data

### System Tables
- `notifications` - User notifications
- `feedback` - User feedback and bug reports
- `user_permissions` - User-specific permission overrides
- `user_permissions_audit` - Permission change audit trail
- `user_table_preferences` - User-specific table column visibility preferences
- `user_action_logs` - Comprehensive audit trail of all user actions
- `customer_communications` - Communication history
- `work_order_attachments` - File uploads and documents

### Database Optimization

#### Text Search Indexes (GIN with pg_trgm)
- **Purpose**: Optimize `ILIKE` queries for fuzzy text search
- **Performance**: 10-100x faster text searches
- **Tables**: customers, inventory, machine_models, repair_tickets, warranty_repair_tickets

#### Composite Indexes
- **Purpose**: Optimize queries with multiple WHERE conditions
- **Performance**: 5-20x faster filtered queries
- **Examples**: `(status, priority)`, `(created_at DESC, status)`

#### Installation
```sql
-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indexes are included in schema.sql
-- Or run optimization script:
psql -d repairshop -f backend/essential_search_indexes.sql
```

---

## 🔐 Authentication & Authorization

### User Roles
- **Admin** - Full system access and configuration
- **Manager** - Operations management and reporting
- **Technician** - Work orders and repair tickets
- **Sales** - CRM, leads, and sales pipeline

### Two-Layer Permission System

#### 1. Role-Based Permissions (Default)
Every user has default permissions based on their role:

**Admin:**
- Full access to everything (`*` wildcard)

**Manager:**
- Work orders, repair tickets, inventory, customers, machines
- Reports, analytics, pipeline, quotes, sales reports, sales targets
- Users (read-only), settings (read-only)

**Technician:**
- Work orders, repair tickets, inventory, customers (read/write)
- Machines (read-only)
- Reports, analytics (read-only)

**Sales:**
- Work orders (read-only), repair tickets (read-only)
- Inventory, customers, machines (read/write)
- Pipeline, quotes, sales reports (full access)
- Sales targets (can be granted via user permissions)

#### 2. User-Specific Overrides
Admins can grant individual users permissions beyond their role defaults:
- Grant specific permissions to any user
- Set expiration dates for temporary access
- Revoke permissions at any time
- Add reasons for audit trail

### Available Permissions

**Work Orders & Tickets:**
- `work_orders:read`, `work_orders:write`, `work_orders:delete`
- `repair_tickets:read`, `repair_tickets:write`, `repair_tickets:delete`

**Inventory Management:**
- `inventory:read`, `inventory:write`, `inventory:delete`

**Customer Management:**
- `customers:read`, `customers:write`, `customers:delete`

**Machine Management:**
- `machines:read`, `machines:write`, `machines:assign`

**Reports & Analytics:**
- `reports:read`, `analytics:read`

**Sales Features:**
- `pipeline:read`, `pipeline:write`, `pipeline:delete`
- `quotes:read`, `quotes:write`, `quotes:delete`
- `sales_reports:read`, `sales_reports:write`, `sales_reports:delete`
- `sales_targets:read`, `sales_targets:write`

**Administration:**
- `users:read`, `users:write`, `users:delete`
- `settings:read`, `settings:write`
- `permissions:manage`

### How to Manage Permissions

#### For Administrators:
1. Navigate to **Settings** → **Permissions** tab
2. Select a user from the list
3. Click "Grant Permission" to add a new permission
4. Select permission, optionally set expiration and reason
5. Click "Revoke" to remove a permission

#### For Developers:
```javascript
// Backend - Protect a route
const { authorizePermission } = require('../middleware/auth');

router.get('/sales/targets', 
  authenticateToken, 
  authorizePermission('sales_targets:read'),
  async (req, res) => {
    // Route logic
  }
);

// Frontend - Check permission
import { useAuth } from '../contexts/auth-context';

function MyComponent() {
  const { hasPermission } = useAuth();
  
  return (
    <div>
      {hasPermission('sales_targets:write') && (
        <Button>Create Target</Button>
      )}
    </div>
  );
}
```

### Security Features
- JWT-based authentication with refresh tokens
- Role-based route protection
- Permission-based UI hiding
- API rate limiting (500 requests per 15 minutes)
- CORS configuration
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- Helmet security headers
- Password hashing with bcrypt

---

## 🎯 Key Systems

### 1. Toast Notifications System

**Library:** Sonner v2.0.7  
**Position:** Top-right corner  
**Coverage:** 100% of key user actions

**Features:**
- ✅ Beautiful, consistent design
- ✅ Rich colors (green/red/blue/yellow)
- ✅ Auto-dismiss after 4-5 seconds
- ✅ Theme-aware (light/dark mode)
- ✅ Close button on all toasts
- ✅ Title + description for context

**Implementation:**
```typescript
// Success
toast.success('Operation successful', {
  description: 'Details about what happened'
})

// Error
toast.error('Operation failed', {
  description: error.message
})

// Info
toast.info('Information', {
  description: 'Additional context'
})

// Warning
toast.warning('Warning', {
  description: 'Warning details'
})
```

**Coverage:**
- Authentication (login, logout, session expired)
- Permissions (grant, revoke)
- Sales targets (create, update, delete)
- Dynamic pricing (rules, tiers, base pricing)
- Repair tickets (create, convert, delete)
- Warranty repair tickets (create, convert, delete)
- Work orders (update, delete, inventory, notes)

### 2. User Feedback System

**Purpose:** Allow users to submit feedback, bug reports, and feature requests

**Features:**
- Floating feedback widget (bottom-right corner)
- Real-time notifications to admins
- Admin management interface
- Multiple feedback types (bug, feature, improvement, complaint, other)
- Priority levels (low, medium, high, urgent)
- Status tracking (open, in progress, resolved, closed)
- Admin notes and resolution tracking

**Access:**
- **Users:** Feedback widget on all pages
- **Admins:** Settings → Feedback tab

**API Endpoints:**
- `GET /api/feedback` - Get all feedback (admin only)
- `POST /api/feedback` - Submit new feedback
- `PATCH /api/feedback/:id` - Update feedback status (admin only)
- `DELETE /api/feedback/:id` - Delete feedback (admin only)
- `GET /api/feedback/stats` - Get feedback statistics (admin only)

### 3. Rental Management System

**Features:**
- Automatic status updates (reserved → active → overdue)
- Custom timing (08:00 for active, 08:30 for overdue)
- Rental details page with comprehensive information
- Dynamic pricing with multiple factors
- Real-time analytics dashboard

**Status Flow:**
1. **Reserved** - Rental booked for future date
2. **Active** - Rental started (auto-activated at 08:00 if start date has passed)
3. **Overdue** - Rental past planned return date (auto-marked at 08:30)
4. **Returned** - Rental completed
5. **Cancelled** - Rental cancelled

**Smart Activation:**
- When an active rental is deleted/returned, the system automatically activates the next reserved rental for the same machine if its start date has passed

### 4. Dynamic Pricing System

**Components:**
- **Base Pricing** - Set daily/weekly/monthly rates per machine
- **Pricing Rules** - Automated adjustments based on:
  - Demand level (low, medium, high, peak)
  - Seasonal factors
  - Availability
  - Customer tier
  - Rental duration
- **Customer Tiers** - Loyalty-based discounts
- **Demand Tracking** - Analytics for pricing optimization
- **Pricing History** - Historical pricing data

**Billing Logic:**
The system calculates the most cost-effective billing period:
1. Calculate total days of rental
2. Calculate cost for each billing period:
   - Daily: `days × daily_rate`
   - Weekly: `(weeks × weekly_rate) + (remaining_days × daily_rate)`
   - Monthly: `(months × monthly_rate) + (remaining_days × daily_rate)`
3. Select the cheapest option
4. Apply customer tier discount if applicable
5. Apply pricing rules (demand, seasonal, etc.)

**Example:**
- 5-day rental
- Daily: 100 KM/day = 500 KM
- Weekly: 600 KM/week = 600 KM
- Monthly: 2000 KM/month = 2000 KM
- **Result:** Daily billing (500 KM) is cheapest

### 5. Sales Target Management

**Features:**
- Set monthly, quarterly, and yearly targets
- Track individual and team performance
- Real-time progress tracking
- Target vs. actual comparison
- Historical target data

**Access:**
- **Admins/Managers:** Full access to all targets
- **Sales Users:** Can view targets (can be granted write access via permissions)

**API Endpoints:**
- `GET /api/sales/targets` - Get all targets
- `GET /api/sales/targets/user/:userId` - Get user's targets
- `POST /api/sales/targets` - Create new target
- `PUT /api/sales/targets/:id` - Update target
- `DELETE /api/sales/targets/:id` - Delete target

### 6. Rental Analytics Dashboard

**Features:**
- Fleet statistics (total machines, utilization rates)
- Revenue analytics (total, average, trends)
- Customer analytics (top customers, average rentals)
- Status distribution
- Overdue rental tracking
- Real-time dashboard with current rentals
- Machine performance metrics
- Duration and billing period analytics

**Access:** Settings → Rental Analytics

### 7. Comprehensive Audit Logging System

**Purpose:** Track every user action across the entire application for security, compliance, and debugging.

**Features:**
- **Complete Action Tracking** - 40+ operations across 13 route files
- **Detailed Context** - User, timestamp, IP address, user agent, before/after values
- **User Activity History** - Dedicated page showing complete user timeline
- **Advanced Filtering** - Filter by action type, entity type, date range
- **Statistics Dashboard** - Total actions, breakdown by type and entity
- **CSV Export** - Download complete activity history
- **Real-Time Updates** - Live action count in admin dashboard
- **Non-Blocking** - Logging doesn't affect application performance

**What's Logged:**
- ✅ Customer operations (create, update, delete)
- ✅ Inventory operations (create, update, delete)
- ✅ Repair tickets (create, update, delete, convert)
- ✅ Warranty tickets (create, delete)
- ✅ Work orders (update, delete)
- ✅ Warranty work orders (update, delete)
- ✅ Machine operations (assign, sell, create model, update model, delete model)
- ✅ Sales operations (leads: create, update, delete)
- ✅ Quote operations (create, update, delete)
- ✅ Rental operations (create, update, delete)
- ✅ Rental fleet (create, update, delete)
- ✅ User management (create, update)

**Access:**
- **Admin Dashboard** → User Management tab → Click any user row
- **Route:** `/admin/user-activity/:userId`

**API Endpoints:**
- `GET /api/action-logs` - Get all action logs (admin only)
- `GET /api/action-logs/user/:userId` - Get user-specific logs
- `GET /api/action-logs/stats` - Get overall statistics
- `GET /api/action-logs/entity/:entityType/:entityId` - Get entity history

### 8. Column Visibility System

**Purpose:** Allow users to customize which columns are visible in data tables, with preferences saved per user.

**Features:**
- **User-Specific Preferences** - Each user has their own column visibility settings
- **Smart Sync** - localStorage for instant loading + database for cross-device sync
- **14 Tables Supported** - All major data tables have column visibility
- **Beautiful UI** - Dropdown with checkboxes, search, and quick actions
- **Instant Updates** - Columns hide/show immediately
- **Graceful Fallback** - Works offline with localStorage

**Tables with Column Visibility:**
1. ✅ Customers
2. ✅ Machines (Machine Models)
3. ✅ Inventory
4. ✅ Repair Tickets
5. ✅ Work Orders
6. ✅ Warranty Repair Tickets
7. ✅ Warranty Work Orders
8. ✅ Leads
9. ✅ Follow-ups
10. ✅ Quotes
11. ✅ Quote Items
12. ✅ Rental Fleet
13. ✅ Active Rentals
14. ✅ Sales Reports (Performance, Trends, Forecast)
15. ✅ Sales Targets

**Features:**
- Show/Hide individual columns
- "Show All" / "Hide All" quick actions
- "Reset to Default" button
- Search columns (for tables with many columns)
- Column count display
- Sync indicator
- Theme-aware design

**API Endpoints:**
- `GET /api/table-preferences` - Get all preferences
- `GET /api/table-preferences/:tableKey` - Get specific table preference
- `PUT /api/table-preferences/:tableKey` - Save preference
- `DELETE /api/table-preferences/:tableKey` - Reset to defaults
- `POST /api/table-preferences/bulk` - Save multiple preferences

---

## 🔧 Development

### Environment Configuration

**Backend (.env):**
```env
# Database Configuration
DB_USER=repairadmin
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=repairshop

# JWT Configuration
JWT_SECRET=your_secret_key_here_make_it_long_and_secure
JWT_REFRESH_SECRET=your_refresh_secret_key_here_make_it_different

# Server Configuration
PORT=3000
NODE_ENV=development

# Optional: Logging Level
LOG_LEVEL=info
```

**Frontend:** Uses Vite's environment variables for API configuration.

### Development Scripts

**Backend:**
```bash
npm run dev        # Start development server with nodemon
npm run start      # Start production server
npm test           # Run tests
npm run db:migrate # Run database migrations
```

**Frontend:**
```bash
npm run dev        # Start Vite development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### Code Quality
- ESLint for code linting
- TypeScript for type safety
- Express-validator for input validation
- Git hooks for pre-commit checks

### Project Structure

**Frontend:**
```
frontend/src/
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Layout components (Header, Sidebar)
│   ├── dashboard/          # Dashboard-specific components
│   ├── feedback/           # Feedback widget
│   └── notifications/      # Notification components
├── pages/                  # Page components
├── contexts/               # React contexts (Auth, Theme, WebSocket, etc.)
├── lib/                    # Utility functions
└── services/               # API service layer
```

**Backend:**
```
backend/
├── routes/                 # API route handlers
├── middleware/             # Express middleware (auth, cache, validation)
├── services/               # Business logic services
├── utils/                  # Helper functions
├── db/                     # Database connection and migrations
└── templates/              # PDF templates
```

---

## 🚀 Deployment

### Production Build

**Frontend:**
```bash
cd frontend
npm run build
# Build output in dist/ directory
```

**Backend:**
```bash
cd backend
npm run start
```

### Environment Setup
- Configure production database
- Set up Redis server (optional)
- Configure reverse proxy (Nginx recommended)
- Set up SSL certificates
- Configure environment variables
- Set `NODE_ENV=production`

### Nginx Configuration Example
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

### 📖 **NEW: Complete Deployment Documentation**

We've added comprehensive deployment guides and automation tools:

**📚 Deployment Guides**:
- **[QUICK_START_DEPLOYMENT.md](QUICK_START_DEPLOYMENT.md)** ⭐ - Fast deployment (Start here!)
- **[STEP_BY_STEP_DEPLOYMENT.md](STEP_BY_STEP_DEPLOYMENT.md)** - Detailed instructions
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Complete documentation
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Verification checklist

**🛠️ Automation Scripts**:
- `deploy.sh` - Automated deployment for updates
- `server-setup.sh` - Initial server setup
- `backup-db.sh` - Automated database backups
- `ecosystem.config.js` - PM2 configuration
- `nginx.conf.example` - Nginx template

**🐳 Docker Support**:
- `Dockerfile` - Optimized multi-stage build
- `docker-compose.yml` - Complete orchestration
- `.dockerignore` - Build optimization

**⚡ Quick Deploy Command**:
```bash
cd /var/www/kamerba
./deploy.sh
```

**Access After Deployment**:
- Main Dashboard: `http://your-server-ip/`
- Customer Portal: `http://your-server-ip/portal/`

---

## 📈 Performance

### Optimization Features
- React query caching
- Database query optimization with indexes
- Redis caching layer (optional)
- Lazy loading components
- Image optimization
- Bundle splitting
- Connection pooling (max 20 connections)
- Slow query monitoring (logs queries > 1000ms)

### Monitoring
- Application logging with Winston
- Error tracking and reporting
- Performance metrics
- Database query monitoring
- Cache statistics endpoint

### Database Performance
```sql
-- Monitor index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE indexname LIKE 'idx_%'
ORDER BY idx_tup_read DESC;

-- Check slow queries
-- Add to postgresql.conf:
# log_min_duration_statement = 100
```

---

## 🔍 Troubleshooting

### Common Issues

**Database Connection Errors:**
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check database credentials in .env
- Ensure database exists: `psql -l`
- Run migrations: `node run-migration.js`

**Redis Connection Issues (Optional):**
- Verify Redis server is running: `redis-cli ping`
- Check Redis URL configuration
- Application will fall back to memory cache if Redis unavailable

**Port Conflicts:**
- Frontend: Port 5173 (Vite default)
- Backend: Port 3000
- Use different ports if conflicts occur

**WebSocket Connection Issues:**
- Check firewall settings
- Verify CORS configuration in `backend/index.js`
- Ensure Socket.IO versions match (v4.7.5)

**Permission Issues:**
- User can't access feature after granting permission:
  - Check permission hasn't expired
  - Verify permission key is correct
  - User may need to logout and login again (JWT refresh)
  - Check browser cache (hard refresh: Ctrl+Shift+R)

**Session Expired on Login:**
- This was fixed - session expired notification now only shows when actually expired
- Check JWT_SECRET is set correctly
- Verify token expiration times

**Sales User Can't See Sales Targets:**
- Grant `sales_targets:read` permission in Settings → Permissions
- Backend routes now support both role-based and permission-based access

**Dark Mode Issues:**
- All pages now support dark mode
- Check theme context is properly initialized
- Verify Tailwind dark mode classes are used

### Debug Tools

**Backend Logs:**
```bash
# View logs in development
tail -f backend/logs/combined.log

# Check specific errors
tail -f backend/logs/error.log
```

**Database Queries:**
```sql
-- Check active connections
SELECT * FROM pg_stat_activity WHERE datname = 'repairshop';

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Frontend Debug:**
- Open browser DevTools (F12)
- Check Console for errors
- Check Network tab for API calls
- Check Application → Local Storage for auth tokens

---

## 🌍 Internationalization

The application supports multiple languages:
- **English** (default)
- **Bosnian** - Complete translation coverage

Language switching is available in the user interface, with automatic persistence of user preferences.

---

## 📱 Responsive Design

The application is fully responsive and optimized for:
- **Desktop** - Full feature access (1920x1080+)
- **Tablet** - Touch-friendly interface (768px - 1024px)
- **Mobile** - Streamlined mobile experience (320px - 767px)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Submit a pull request

### Code Style
- Use TypeScript for frontend
- Follow ESLint rules
- Use meaningful variable names
- Add comments for complex logic
- Write clean, readable code

---

## 📚 Additional Documentation

### Database Migrations
All database migrations are located in `backend/db/migrations/`:
- `008_create_sales_targets_table.sql` - Sales target management
- `009_create_user_permissions_table.sql` - Granular permission system
- `010_create_user_table_preferences.sql` - Column visibility preferences
- `011_create_user_action_logs.sql` - Comprehensive audit logging

To run migrations:
```bash
cd backend
node run-migration.js db/migrations/010_create_user_table_preferences.sql
node run-migration.js db/migrations/011_create_user_action_logs.sql
```

### API Documentation
API endpoints follow RESTful conventions:
- `GET` - Retrieve data
- `POST` - Create new resource
- `PUT/PATCH` - Update existing resource
- `DELETE` - Delete resource

All responses follow this format:
```json
{
  "status": "success|fail|error",
  "data": { ... },
  "message": "Optional message",
  "pagination": { "page": 1, "limit": 20, "total": 100, "pages": 5 }
}
```

### WebSocket Events
The application emits and listens for various real-time events:
- `notification_received` - New notification
- `work_order_update` - Work order changed
- `repair_ticket_update` - Repair ticket changed
- `machine_update` - Machine changed
- `customer_update` - Customer changed
- `user_activity_update` - User status changed (includes action count)
- `feedback_submitted` - New feedback submitted

### Audit Logging System

**Database Table:** `user_action_logs`

**Logged Actions:**
- `create` - Entity creation (customers, inventory, tickets, etc.)
- `update` - Entity modifications (status changes, field updates)
- `delete` - Entity deletion (with details preserved)
- `convert` - Ticket to work order conversions
- `assign` - Machine assignments to customers
- `sell` - Machine sales to customers

**Logged Entities:**
- Customers, Inventory, Repair Tickets, Warranty Repair Tickets
- Work Orders, Warranty Work Orders
- Machines (assigned/sold), Machine Models
- Leads, Quotes
- Machine Rentals, Rental Machines
- Users

**Access Control:**
- Only admins can view action logs
- Logs are read-only (no edit/delete)
- Complete audit trail preserved

**Usage:**
```javascript
// Backend - Add logging to any route
const { logCustomAction } = require('../utils/actionLogger');

await logCustomAction(req, 'create', 'customer', customerId, customerName, {
  customer_type: 'company',
  company_name: 'Acme Corp'
});
```

### Column Visibility System

**Database Table:** `user_table_preferences`

**Storage Strategy:**
- **localStorage** - Instant loading and updates
- **PostgreSQL** - Cross-device synchronization
- **Hybrid Approach** - Best of both worlds

**Implementation:**
```typescript
// Frontend - Use in any table component
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '../hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '../components/ui/column-visibility-dropdown'

const TABLE_COLUMNS = defineColumns([
  { key: 'column1', label: 'Column 1' },
  { key: 'column2', label: 'Column 2' }
])

const { visibleColumns, isColumnVisible, toggleColumn, ... } = 
  useColumnVisibility('table_key', getDefaultColumnKeys(TABLE_COLUMNS))

// In table headers
{isColumnVisible('column1') && <TableHead>Column 1</TableHead>}

// In table cells
{isColumnVisible('column1') && <TableCell>{item.column1}</TableCell>}
```

---

## 🔒 Security Best Practices

1. **Never commit .env files** - Use .env.example as template
2. **Use strong JWT secrets** - Generate with `openssl rand -base64 64`
3. **Keep dependencies updated** - Run `npm audit` regularly
4. **Use HTTPS in production** - Always use SSL certificates
5. **Validate all inputs** - Both frontend and backend
6. **Sanitize user data** - Prevent XSS attacks
7. **Use parameterized queries** - Prevent SQL injection
8. **Set expiration dates** - For temporary permission grants
9. **Review audit logs** - Regularly check permission changes
10. **Backup database** - Regular automated backups

---

## 📄 License

This project is proprietary software developed for repair shop management.

---

## 📞 Support

For technical support or questions about the system:
- Check this documentation
- Review browser console for frontend errors
- Check backend logs for API errors
- Review database logs for query issues
- Contact the development team

---

## 📝 Changelog

### Version 0.6.0 (Current)
- ✅ Added granular permission system with user-specific overrides
- ✅ Implemented toast notifications across entire application
- ✅ Added user feedback system with admin management
- ✅ Implemented sales target management
- ✅ Added rental management system with dynamic pricing
- ✅ Implemented rental analytics dashboard
- ✅ Added automatic rental status updates
- ✅ **Comprehensive audit logging system** - 40+ operations across 13 routes
- ✅ **Column visibility system** - 15 tables with customizable columns
- ✅ **User activity history page** - Complete timeline with filters and export
- ✅ **Admin dashboard improvements** - Real-time metrics, user management
- ✅ Fixed dark mode support across all pages
- ✅ Added real-time WebSocket notifications
- ✅ Improved RBAC with sales user permissions
- ✅ Enhanced UI/UX with consistent design

### Previous Versions
- 0.5.0 - Sales pipeline and CRM features
- 0.4.0 - Work order and repair ticket system
- 0.3.0 - Customer and machine management
- 0.2.0 - Basic authentication and dashboard
- 0.1.0 - Initial release

---

## 🎯 Future Enhancements

### Planned Features
- [ ] Email notifications for important events
- [ ] SMS notifications for customers
- [ ] Mobile app (React Native)
- [ ] Advanced reporting with custom report builder
- [ ] Integration with accounting software
- [ ] Customer portal for self-service
- [ ] Barcode scanning for inventory
- [ ] QR code generation for machines
- [ ] Multi-location support
- [ ] Advanced scheduling and calendar
- [ ] Payment processing integration
- [ ] Automated backup system

### Permission System Enhancements
- [ ] Permission groups/templates (e.g., "Team Leader" bundle)
- [ ] Bulk permission management
- [ ] Permission request workflow (users request → admin approves)
- [ ] Email notifications on permission changes
- [ ] Permission analytics dashboard
- [ ] Export/import permission configurations

---

**Built with ❤️ for efficient repair shop management**

**Version:** 0.6.0  
**Last Updated:** January 2025  
**Status:** Production Ready