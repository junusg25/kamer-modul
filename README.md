# Repair Shop Management System

A comprehensive web-based repair shop management system built with Node.js backend and React frontend.

## Features

### Backend (Node.js/Express)
- **User Management**: Authentication, authorization, and user roles
- **Customer Management**: Customer profiles, communications, and preferences
- **Machine Management**: Machine categories, models, serials, and assignments
- **Work Orders**: Complete work order lifecycle management
- **Repair Tickets**: Ticket creation, tracking, and resolution
- **Inventory Management**: Parts tracking, suppliers, and stock management
- **Warranty System**: Warranty repair tickets and work orders
- **Analytics & Reporting**: Dashboard analytics and export functionality
- **Real-time Notifications**: WebSocket-based notifications
- **Multi-language Support**: Internationalization support
- **Time Tracking**: Work order time tracking and billing
- **Print Functionality**: Work order and ticket printing

### Frontend (React)
- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Real-time Updates**: Live notifications and status updates
- **Form System**: Unified form handling with validation
- **Data Tables**: Advanced data display with search and filtering
- **Modal System**: Consistent modal dialogs throughout the app
- **Language Switching**: Dynamic language support
- **Performance Optimized**: Caching and optimization strategies

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (with migration support)
- **Authentication**: JWT tokens
- **Real-time**: WebSocket (ws)
- **Caching**: Redis
- **Validation**: Custom validators
- **Logging**: Winston

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **HTTP Client**: Fetch API
- **Real-time**: WebSocket client
- **Forms**: Custom unified form system
- **Icons**: Heroicons

## Project Structure

```
repairshop-app/
├── repairshop-backend/          # Backend API server
│   ├── routes/                  # API route handlers
│   ├── middleware/              # Express middleware
│   ├── services/                # Business logic services
│   ├── utils/                   # Utility functions
│   ├── db/                      # Database migrations
│   └── schema.sql              # Database schema
├── repairshop-frontend/         # React frontend application
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── pages/              # Page components
│   │   ├── contexts/           # React contexts
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API services
│   │   └── utils/              # Utility functions
│   └── public/                 # Static assets
├── start-dev.bat               # Windows development startup script
├── start-dev.ps1               # PowerShell development startup script
└── README.md                   # This file
```

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd repairshop-app
   ```

2. **Install backend dependencies**
   ```bash
   cd repairshop-backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../repairshop-frontend
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cd ../repairshop-backend
   cp env.example .env
   # Edit .env with your configuration
   ```

5. **Initialize the database**
   ```bash
   cd repairshop-backend
   npm run db:init
   ```

### Development

#### Option 1: Using the provided scripts
```bash
# Windows
start-dev.bat

# PowerShell
./start-dev.ps1
```

#### Option 2: Manual startup
```bash
# Terminal 1 - Start backend
cd repairshop-backend
npm run dev

# Terminal 2 - Start frontend
cd repairshop-frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Configuration

### Environment Variables

Create a `.env` file in the `repairshop-backend` directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DB_PATH=./repairshop.db

# JWT Secret
JWT_SECRET=your-secret-key-here

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

## API Documentation

The backend provides RESTful APIs for all major functionality:

- **Authentication**: `/api/auth/*`
- **Users**: `/api/users/*`
- **Customers**: `/api/customers/*`
- **Machines**: `/api/machines/*`
- **Work Orders**: `/api/work-orders/*`
- **Repair Tickets**: `/api/repair-tickets/*`
- **Inventory**: `/api/inventory/*`
- **Analytics**: `/api/analytics/*`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue in the GitHub repository.

## Version History

- **v0.4.0**: Current version with comprehensive features
- **v0.3.0**: Added warranty system and enhanced UI
- **v0.2.0**: Implemented real-time notifications
- **v0.1.0**: Initial release with basic functionality
