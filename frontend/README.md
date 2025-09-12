# RepairShop Frontend - shadcn/ui

A modern, professional repair shop management system built with React, TypeScript, and shadcn/ui components.

## Features

- 🎨 **Modern UI/UX** - Built with shadcn/ui components and Tailwind CSS
- 📱 **Responsive Design** - Mobile-first approach with responsive layouts
- 🌙 **Dark/Light Theme** - Built-in theme switching capability
- 📊 **Dashboard** - Comprehensive dashboard with statistics and activity feeds
- 👥 **Customer Management** - Complete customer database with search and filtering
- 🔧 **Machine Management** - Track and manage customer machines
- 📋 **Ticket System** - Repair ticket creation and management
- 📦 **Inventory** - Parts and inventory management
- 📈 **Analytics** - Business insights and reporting
- 🔔 **Notifications** - Real-time notifications and alerts

## Tech Stack

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **shadcn/ui** - High-quality, accessible UI components
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Unstyled, accessible UI primitives
- **Lucide React** - Beautiful, customizable icons
- **React Router** - Client-side routing
- **TanStack Query** - Data fetching and caching

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the frontend-shadcn directory:
   ```bash
   cd frontend-shadcn
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Project Structure

```
src/
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Layout components (Header, Sidebar, etc.)
│   └── dashboard/          # Dashboard-specific components
├── pages/                  # Page components
├── lib/                    # Utility functions
└── hooks/                  # Custom React hooks
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Components

### Layout Components
- `MainLayout` - Main application layout with sidebar and header
- `Sidebar` - Navigation sidebar with menu items
- `Header` - Top header with search, notifications, and user menu

### Dashboard Components
- `StatsCards` - Key performance indicators
- `RecentActivity` - Activity feed
- `QuickActions` - Quick action buttons
- `PriorityAlerts` - Important alerts and notifications

### UI Components
All shadcn/ui components are available including:
- Button, Card, Input, Label
- Table, Dropdown Menu, Badge
- Avatar, Dialog, Toast
- And many more...

## Theming

The application supports both light and dark themes. The theme can be toggled using the theme switcher in the header.

## Contributing

1. Follow the existing code style
2. Use TypeScript for all new components
3. Follow the shadcn/ui component patterns
4. Ensure responsive design
5. Add proper TypeScript types

## License

This project is part of the RepairShop management system.