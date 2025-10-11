# Customer Portal - Setup and Documentation

## 📋 Overview

The Customer Portal allows customers to track their repairs, view work orders, manage quotes, and access their account information without needing access to the internal admin system.

## ✅ Completed Work

### 1. Database Changes
- ✅ Added tracking number prefixes to all documents:
  - `TK-` for Repair Tickets
  - `WT-` for Warranty Repair Tickets
  - `WO-` for Work Orders
  - `WW-` for Warranty Work Orders
  - `QT-` for Quotes
- ✅ Created `customer_portal_users` table for customer accounts
- ✅ Created `customer_portal_activity` table for activity tracking
- ✅ Updated 26 existing records with new prefixes

### 2. Backend API Routes

#### Authentication Routes (`/api/customer-portal/auth`)
- `POST /register` - Register new customer portal account
- `POST /login` - Login to customer portal  
- `GET /me` - Get current user information
- `POST /change-password` - Change password

#### Tracking Routes (`/api/customer-portal`)
- `POST /track` - Track item by number (guest, no auth)
- `GET /my-items` - Get all items for authenticated customer
- `GET /my-items/:trackingNumber` - Get detailed item information

### 3. Features Implemented

**Guest Tracking:**
- Customers can track items using tracking number + email
- No account required
- Shows current status and related items (ticket→work order links)

**Authenticated Portal:**
- Secure login with JWT tokens
- View all tickets, work orders, and quotes
- Detailed item information
- Activity logging for security

**Tracking Number System:**
- Unified format: `PREFIX-NUMBER/YY` (e.g., `TK-12/25`, `WO-8/25`)
- Automatic linking between tickets and work orders
- Enter either number to see complete history

## 🔄 How Tracking Works

### Example Workflow:

1. **Customer submits machine** → Gets `TK-12/25` (Repair Ticket)
2. **Ticket converted to work order** → Creates `WO-12/25`
3. **Customer can track with either number:**
   - Enter `TK-12/25` → Shows ticket + linked work order
   - Enter `WO-12/25` → Shows work order + original ticket

## 📡 API Endpoints

### Guest Tracking (No Auth)

```http
POST /api/customer-portal/track
Content-Type: application/json

{
  "tracking_number": "TK-12/25",
  "email": "customer@email.com"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "type": "repair_ticket",
    "item": {
      "id": 12,
      "tracking_number": "TK-12/25",
      "status": "converted",
      "problem_description": "Machine won't start",
      "created_at": "2025-01-10T10:00:00Z",
      "converted_to_work_order_id": 8
    },
    "related": {
      "type": "work_order",
      "tracking_number": "WO-12/25",
      "status": "in_progress",
      "technician_name": "Tech Mike",
      "total_cost": 150.00
    }
  }
}
```

### Register Account

```http
POST /api/customer-portal/auth/register
Content-Type: application/json

{
  "email": "customer@email.com",
  "password": "secure_password",
  "customer_id": 123
}
```

### Login

```http
POST /api/customer-portal/auth/login
Content-Type: application/json

{
  "email": "customer@email.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "customer@email.com",
      "customer_id": 123,
      "customer_name": "John Doe",
      "company_name": "Acme Corp"
    }
  }
}
```

### Get All Items (Authenticated)

```http
GET /api/customer-portal/my-items
Authorization: Bearer {token}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "repair_tickets": [...],
    "warranty_tickets": [...],
    "work_orders": [...],
    "warranty_work_orders": [...],
    "quotes": [...]
  }
}
```

## 🗄️ Database Schema

### customer_portal_users

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| customer_id | INTEGER | Links to customers table (unique) |
| email | VARCHAR(255) | Unique login email |
| password_hash | VARCHAR(255) | Bcrypt hashed password |
| is_verified | BOOLEAN | Email verification status |
| is_active | BOOLEAN | Account active status |
| verification_token | VARCHAR(255) | Email verification token |
| reset_token | VARCHAR(255) | Password reset token |
| last_login | TIMESTAMP | Last login time |
| created_at | TIMESTAMP | Account creation |
| updated_at | TIMESTAMP | Last update |

### customer_portal_activity

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| customer_id | INTEGER | Customer ID (nullable) |
| portal_user_id | INTEGER | Portal user ID (nullable) |
| action | VARCHAR(100) | Action performed |
| entity_type | VARCHAR(50) | Type of entity accessed |
| entity_id | INTEGER | ID of entity accessed |
| tracking_number | VARCHAR(50) | Tracking number used |
| ip_address | VARCHAR(45) | IP address |
| user_agent | TEXT | Browser user agent |
| details | JSONB | Additional details |
| created_at | TIMESTAMP | Activity timestamp |

## 🔐 Security Features

1. **Password Hashing:** Bcrypt with salt rounds = 10
2. **JWT Tokens:** 7-day expiration, separate from staff tokens
3. **Customer Isolation:** Customers can only see their own data
4. **Activity Logging:** All actions tracked with IP and user agent
5. **Email Verification:** (Ready for implementation)
6. **Rate Limiting:** Inherited from main app (500 req/15min)

## 📝 Next Steps

### Phase 1: Testing (Current)
- [ ] Test all API endpoints with Postman
- [ ] Verify data isolation (customers can't see others' data)
- [ ] Test guest tracking with various numbers
- [ ] Test authentication flow

### Phase 2: Customer Portal UI
- [ ] Create `customer-portal` folder
- [ ] Setup Vite + React + TypeScript
- [ ] Implement pages:
  - Landing page (track or login options)
  - Login/Register
  - Dashboard (all items)
  - Item details
  - Profile settings

### Phase 3: Advanced Features
- [ ] Email verification system
- [ ] Password reset flow
- [ ] Quote approval workflow
- [ ] File uploads (send photos)
- [ ] Real-time status updates
- [ ] Email/SMS notifications

## 🧪 Testing the API

### Quick Test Commands

```bash
# Test guest tracking
curl -X POST http://localhost:5000/api/customer-portal/track \
  -H "Content-Type: application/json" \
  -d '{"tracking_number":"TK-12/25","email":"hamza@kamer.ba"}'

# Test register
curl -X POST http://localhost:5000/api/customer-portal/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","customer_id":1}'

# Test login
curl -X POST http://localhost:5000/api/customer-portal/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Test get my items (replace TOKEN with actual token from login)
curl -X GET http://localhost:5000/api/customer-portal/my-items \
  -H "Authorization: Bearer TOKEN"
```

## 📂 File Structure

```
backend/
├── routes/
│   ├── customerPortalAuth.js      # Authentication routes
│   └── customerPortalTracking.js   # Tracking & dashboard routes
├── db/
│   └── migrations/
│       ├── 014_customer_portal_setup.sql          # Migration
│       └── 014_customer_portal_setup_rollback.sql # Rollback
└── index.js  # Routes registered here

customer-portal/ (TO BE CREATED)
├── src/
│   ├── pages/
│   │   ├── Landing.tsx          # Track or Login
│   │   ├── Login.tsx            # Login page
│   │   ├── Register.tsx         # Registration
│   │   ├── Dashboard.tsx        # Customer dashboard
│   │   ├── ItemDetail.tsx       # Item details
│   │   └── Profile.tsx          # Profile settings
│   ├── components/
│   ├── services/
│   │   └── api.ts               # API service
│   └── App.tsx
├── package.json
└── vite.config.ts
```

## 🎨 UI Design Mockup

### Landing Page
```
┌─────────────────────────────────────┐
│        KAMER BA - Track Repair      │
├─────────────────────────────────────┤
│                                     │
│   [Track Without Account]           │
│   Enter tracking number & email     │
│                                     │
│   ────────── OR ──────────         │
│                                     │
│   [Login to Your Account]           │
│   Access all your repairs           │
│                                     │
└─────────────────────────────────────┘
```

### Dashboard
```
┌─────────────────────────────────────┐
│  Hi, John Doe                [Logout]│
├─────────────────────────────────────┤
│  Active Repairs        Quotes       │
│  ├─ TK-12/25 (In Progress)         │
│  └─ WO-8/25  (Completed)           │
│                                     │
│  Warranty Items                     │
│  ├─ WT-5/25  (Pending)             │
│                                     │
└─────────────────────────────────────┘
```

## 🚀 Deployment Notes

1. **Environment Variables:**
   - `JWT_SECRET` - Must be set in production
   - `DATABASE_URL` - PostgreSQL connection

2. **Email Service:**
   - Configure SMTP for verification emails
   - Update registration flow to send emails

3. **Domain Setup:**
   - Recommended: `portal.kamerba.com` or `customers.kamerba.com`
   - Update CORS settings in backend

4. **SSL Certificate:**
   - Required for production (Let's Encrypt)

## 📞 Support

For any issues or questions, contact the development team.

