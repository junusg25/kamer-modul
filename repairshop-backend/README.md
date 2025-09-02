# Repair Shop Management System - Frontend

A modern React-based frontend for the Repair Shop Management System, providing a comprehensive interface for managing repair operations, customers, inventory, and analytics.

## 🚀 Features

### ✅ Implemented
- **Authentication System** - Login/logout with role-based access control
- **Responsive Layout** - Mobile-friendly sidebar navigation
- **Dashboard** - Overview with key metrics and recent activity
- **Role-Based Navigation** - Different menu items based on user role
- **Modern UI/UX** - Clean, professional interface with Tailwind CSS

### 🚧 Under Development
- **Work Orders Management** - Create, view, and manage work orders
- **Customer Management** - Customer profiles and relationships
- **Machine Management** - Equipment tracking and maintenance
- **Inventory Management** - Parts and stock management
- **Time Tracking** - Track work hours and productivity
- **Analytics & Reporting** - Business intelligence and insights
- **Customer Portal** - Self-service portal for customers
- **File Attachments** - Document and image uploads
- **Notifications** - Real-time alerts and updates
- **Export Functionality** - Data export to CSV/PDF

## 🛠 Tech Stack

- **React 18** - Modern React with hooks
- **React Router 6** - Client-side routing
- **React Query** - Server state management
- **React Hook Form** - Form handling and validation
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons
- **Axios** - HTTP client
- **React Hot Toast** - Toast notifications
- **Date-fns** - Date manipulation

## 📋 Prerequisites

- Node.js 16+ 
- npm or yarn
- Backend API running on `http://localhost:3000`

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm start
   ```

3. **Open Browser**
   Navigate to `http://localhost:3001`

## 🔐 Authentication

The system supports multiple user roles:

### Demo Credentials
- **Admin**: `john.smith@repairshop.com` / `password123`
- **Manager**: `sarah.johnson@repairshop.com` / `password123`
- **Technician**: `mike.wilson@repairshop.com` / `password123`

### Role Permissions
- **Admin**: Full access to all features
- **Manager**: Access to management features (users, analytics, templates)
- **Technician**: Access to work orders, time tracking, basic features
- **Customer**: Access to customer portal only

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout.js       # Main layout with sidebar
│   ├── Header.js       # Top navigation bar
│   ├── Sidebar.js      # Sidebar navigation
│   ├── LoadingSpinner.js
│   └── PlaceholderPage.js
├── pages/              # Page components
│   ├── Login.js        # Authentication
│   ├── Dashboard.js    # Main dashboard
│   ├── WorkOrders.js   # Work order management
│   ├── Customers.js    # Customer management
│   ├── Inventory.js    # Inventory management
│   ├── Analytics.js    # Reports and analytics
│   └── ...
├── contexts/           # React contexts
│   └── AuthContext.js  # Authentication state
├── services/           # API services
│   └── api.js         # API client and endpoints
├── utils/              # Utility functions
│   └── helpers.js     # Helper functions
├── hooks/              # Custom React hooks
└── styles/             # Global styles
    └── index.css      # Tailwind imports
```

## 🎨 UI Components

### Design System
- **Colors**: Primary blue theme with semantic colors
- **Typography**: Inter font family
- **Spacing**: Consistent spacing scale
- **Components**: Reusable button, input, card components

### Responsive Design
- Mobile-first approach
- Collapsible sidebar on mobile
- Responsive grid layouts
- Touch-friendly interactions

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
REACT_APP_API_URL=http://localhost:3000/api
```

### API Configuration
The frontend is configured to communicate with the backend API. Make sure the backend is running and accessible.

## 📱 Features by Role

### Admin Dashboard
- Full system overview
- User management
- Analytics and reporting
- System configuration

### Manager Dashboard
- Work order management
- Customer management
- Inventory oversight
- Team performance

### Technician Dashboard
- Assigned work orders
- Time tracking
- Customer communication
- Parts usage

### Customer Portal
- Work order status
- Communication history
- Service history
- Document access

## 🚧 Development Roadmap

### Phase 1: Core Features ✅
- [x] Authentication system
- [x] Basic layout and navigation
- [x] Dashboard overview
- [x] Role-based access control

### Phase 2: Management Features 🚧
- [ ] Work order management
- [ ] Customer management
- [ ] Machine management
- [ ] Inventory management

### Phase 3: Advanced Features 📋
- [ ] Time tracking
- [ ] File attachments
- [ ] Notifications
- [ ] Analytics dashboard

### Phase 4: Customer Portal 📋
- [ ] Customer self-service
- [ ] Work order tracking
- [ ] Communication portal
- [ ] Document access

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## 📦 Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is part of the Repair Shop Management System.

## 🆘 Support

For support and questions:
- Check the backend API documentation
- Review the component documentation
- Open an issue for bugs or feature requests

---

**Note**: This frontend is designed to work with the Repair Shop Management System backend. Make sure the backend is properly configured and running before using this frontend.

