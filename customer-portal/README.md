# 🌐 Customer Portal - Kamer BA

A modern, responsive customer-facing portal for tracking repairs, work orders, quotes, and warranty claims.

## ✨ Features

### 🎯 Guest Tracking
- Track items without registration using tracking number + email
- Support for all tracking number formats:
  - `TK-XX/YY` - Repair Tickets
  - `WT-XX/YY` - Warranty Tickets
  - `WO-XX/YY` - Work Orders
  - `WW-XX/YY` - Warranty Work Orders
  - `QT-XX/YY` - Quotes

### 🔐 Authenticated Features
- User registration and login
- Personal dashboard with all items
- Real-time status updates
- View related items (e.g., ticket → work order)
- Filter by type (tickets, orders, quotes)

### 📊 Dashboard
- Overview statistics (total, active, completed, pending)
- Categorized tabs for easy navigation
- Detailed item information
- Status badges and priority indicators

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ installed
- Backend API running on `http://localhost:3000`
- Database migration `014_customer_portal_setup.sql` applied

### Installation

```bash
cd customer-portal
npm install
```

### Development

```bash
npm run dev
```

The customer portal will run on `http://localhost:5174`

### Build for Production

```bash
npm run build
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `customer-portal` directory:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

For production, update to your production API URL.

### Backend Configuration

The backend CORS settings have been updated to allow the customer portal on port 5174.

## 📁 Project Structure

```
customer-portal/
├── src/
│   ├── components/      # Reusable UI components
│   ├── contexts/        # React contexts (auth, etc.)
│   ├── lib/            # Utility functions
│   ├── pages/          # Page components
│   │   ├── Landing.tsx        # Home page with tracking
│   │   ├── TrackingResult.tsx # Guest tracking results
│   │   ├── Login.tsx          # User login
│   │   ├── Register.tsx       # User registration
│   │   └── Dashboard.tsx      # Authenticated dashboard
│   ├── services/       # API services
│   │   └── api.ts      # API client
│   ├── App.tsx         # Main app component
│   └── main.tsx        # Entry point
├── public/             # Static assets
└── index.html          # HTML template
```

## 🎨 Design

- **Framework**: React 19 with TypeScript
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **API Client**: Axios
- **Date Formatting**: date-fns

## 🔑 Key Features

### 1. Guest Tracking
Users can track their items without creating an account by entering:
- Tracking number (e.g., `TK-12/25`)
- Email address used when the item was created

### 2. Unified Tracking
- Track items using either the original ticket number OR the converted work order number
- Example: `TK-12/25` (ticket) → `WO-12/25` (work order)
- Entering either number shows both the ticket and work order information

### 3. Customer Registration
- Requires valid customer ID from the system
- Email verification (auto-verified in development)
- Secure password hashing (bcrypt)

### 4. Secure Authentication
- JWT-based authentication
- 7-day token expiration
- Separate token system from staff portal

## 📱 Pages

### Landing Page (`/`)
- Hero section with tracking form
- What can you track section
- Links to login/register

### Tracking Result (`/track-result`)
- Display tracked item details
- Show related items (linked tickets/orders)
- Customer and item information
- Call to action for registration

### Login (`/login`)
- Email and password authentication
- Remember user session
- Links to register and guest tracking

### Register (`/register`)
- Customer ID validation
- Email and password setup
- Automatic login after registration

### Dashboard (`/dashboard`)
- Overview statistics cards
- Filterable tabs (all, tickets, orders, quotes)
- Item list with status badges
- Quick actions

## 🔒 Security

- All passwords hashed with bcrypt (10 salt rounds)
- JWT tokens with expiration
- Customer-specific token type
- Activity logging for all actions
- Separate authentication from staff portal

## 🚧 TODO / Future Enhancements

- [ ] Email verification system
- [ ] Password reset functionality
- [ ] PDF download for quotes and work orders
- [ ] Real-time notifications (WebSocket)
- [ ] Customer profile management
- [ ] Communication/messaging with support
- [ ] File upload for tickets
- [ ] Quote acceptance/rejection
- [ ] Payment integration

## 📞 Support

For development questions or issues, contact the development team.

## 📄 License

Proprietary - Kamer BA © 2025
