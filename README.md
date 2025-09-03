# Repair Shop Management System

A comprehensive, modern web application for managing repair shop operations, customer relationships, sales pipeline, and business analytics. Built with React, Node.js, and PostgreSQL.

## 🚀 Features

### ✅ Core Management System
- **Authentication & Authorization** - Role-based access control (Admin, Manager, Technician, Sales)
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
- **Customer Value Analysis** - Purchase history and lifetime value

### ✅ Advanced Features
- **Real-Time Notifications** - WebSocket-powered instant updates
- **Multi-Language Support** - English and Bosnian translations
- **Responsive Design** - Mobile-friendly interface
- **Export Functionality** - Data export to CSV/PDF
- **File Attachments** - Document and image uploads
- **Time Tracking** - Work hours and productivity monitoring
- **Analytics & Reporting** - Business intelligence dashboards

## 🛠 Tech Stack

### Frontend
- **React 18** - Modern React with hooks and concurrent features
- **Vite** - Fast build tool and development server
- **Material-UI (MUI)** - Component library for consistent UI
- **Tailwind CSS** - Utility-first styling framework
- **TanStack Query** - Server state management and caching
- **React Router 6** - Client-side routing
- **React Beautiful DnD** - Drag-and-drop functionality
- **Socket.IO Client** - Real-time communication

### Backend
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework
- **PostgreSQL** - Relational database with advanced features
- **Socket.IO** - Real-time bidirectional communication
- **Redis** - Caching and session storage
- **JWT** - JSON Web Token authentication
- **Helmet** - Security middleware
- **Rate Limiting** - API protection
- **Winston** - Logging framework

### Database
- **PostgreSQL 17+** - Primary database
- **Redis** - Cache and session store
- **Database Views** - Optimized queries for analytics
- **Indexes** - Performance optimization
- **Migrations** - Version-controlled schema changes

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 12+ database server
- **Redis** server (for caching and sessions)
- **Git** for version control

## 🚀 Quick Start

### 1. Database Setup

#### Option A: Complete Backup (Recommended)
```sql
-- Create database and user in PostgreSQL
CREATE DATABASE repairshop;
CREATE USER repairadmin WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE repairshop TO repairadmin;

-- Run the comprehensive backup (includes all data and structure)
psql -U repairadmin -d repairshop -f "DB SA PRODAJOM FINAL.sql"
```

#### Option B: Schema Only (Clean Installation)
```sql
-- Create database and user in PostgreSQL
CREATE DATABASE repairshop;
CREATE USER repairadmin WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE repairshop TO repairadmin;

-- Run the schema file (structure only, no data)
psql -U repairadmin -d repairshop -f "repairshop-backend/schema.sql"
```

### 2. Backend Setup
```bash
cd repairshop-backend
npm install
cp env.example .env
# Edit .env with your database credentials
npm run dev
```

### 3. Frontend Setup
```bash
cd repairshop-frontend
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

## 🌐 Access URLs

- **Frontend Application**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Health Check**: http://localhost:3001/health
- **Cache Statistics**: http://localhost:3001/api/cache/stats

## 🏗 Architecture

### Port Configuration
- **Frontend (React)**: Port 3000
- **Backend (Node.js API)**: Port 3001
- **PostgreSQL**: Port 5432 (default)
- **Redis**: Port 6379 (default)

### Real-Time Features
The application uses WebSocket (Socket.IO) for real-time updates:
- Work order status changes
- New repair ticket notifications
- User presence indicators
- Inventory low-stock alerts
- Sales opportunity updates

### Caching Strategy
Redis is used for:
- Session storage
- API response caching
- Real-time data synchronization
- Performance optimization

## 📊 Database Schema

### Core Tables
- `users` - System users with role-based access
- `customers` - Customer information and contacts
- `machine_models` - Equipment model definitions
- `machine_serials` - Individual machine serial numbers
- `assigned_machines` - Customer-machine relationships
- `repair_tickets` - Service requests and intake
- `work_orders` - Active repair jobs
- `inventory` - Parts and stock management

### Sales Tables
- `leads` - Sales prospects and opportunities
- `lead_follow_ups` - Follow-up activities and notes
- `quotes` - Customer quotations
- `quote_items` - Itemized quote details

### System Tables
- `notifications` - User notifications
- `customer_communications` - Communication history
- `attachments` - File uploads and documents

## 🔐 Authentication & Authorization

### User Roles
- **Admin** - Full system access and configuration
- **Manager** - Operations management and reporting
- **Technician** - Work orders and repair tickets
- **Sales** - CRM, leads, and sales pipeline

### Security Features
- JWT-based authentication
- Role-based route protection
- API rate limiting
- CORS configuration
- Input validation and sanitization
- SQL injection prevention

## 🌍 Internationalization

The application supports multiple languages:
- **English** (default)
- **Bosnian** - Complete translation coverage

Language switching is available in the user interface, with automatic persistence of user preferences.

## 📱 Responsive Design

The application is fully responsive and optimized for:
- **Desktop** - Full feature access
- **Tablet** - Touch-friendly interface
- **Mobile** - Streamlined mobile experience

## 🔧 Development

### Environment Configuration
Create `.env` files in both frontend and backend directories:

**Backend (.env)**:
```env
DATABASE_URL=postgresql://repairadmin:password@localhost:5432/repairshop
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
PORT=3001
NODE_ENV=development
```

**Frontend** uses Vite's environment variables for API configuration.

### Development Scripts
```bash
# Backend
npm run dev        # Start development server
npm run start      # Start production server
npm test           # Run tests

# Frontend
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
```

### Code Quality
- ESLint for code linting
- Prettier for code formatting
- Git hooks for pre-commit checks
- TypeScript support (optional)

## 🚀 Deployment

### Production Build
```bash
# Frontend
cd repairshop-frontend
npm run build

# Backend
cd repairshop-backend
npm run start
```

### Environment Setup
- Configure production database
- Set up Redis server
- Configure reverse proxy (Nginx recommended)
- Set up SSL certificates
- Configure environment variables

## 📈 Performance

### Optimization Features
- React query caching
- Database query optimization
- Redis caching layer
- Lazy loading components
- Image optimization
- Bundle splitting

### Monitoring
- Application logging with Winston
- Error tracking and reporting
- Performance metrics
- Database query monitoring

## 🔍 Troubleshooting

### Common Issues

**Database Connection Errors**:
- Verify PostgreSQL is running
- Check database credentials in .env
- Ensure database exists and migrations are applied

**Redis Connection Issues**:
- Verify Redis server is running
- Check Redis URL configuration
- Ensure Redis is accessible

**Port Conflicts**:
- Frontend: Port 3000
- Backend: Port 3001
- Use different ports if conflicts occur

**WebSocket Connection Issues**:
- Check firewall settings
- Verify CORS configuration
- Ensure Socket.IO versions match

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is proprietary software developed for repair shop management.

## 📞 Support

For technical support or questions about the system, please contact the development team.

---

**Built with ❤️ for efficient repair shop management**