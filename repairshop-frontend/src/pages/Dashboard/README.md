# Dashboard Architecture

This directory contains the refactored dashboard components with a clean separation of concerns.

## Structure

```
Dashboard/
├── index.jsx                 # Main router component
├── AdminDashboard.jsx        # Admin/Manager dashboard
├── TechnicianDashboard.jsx   # Technician dashboard
├── components/               # Shared dashboard components
│   ├── index.js             # Component exports
│   ├── StatCard.jsx         # Reusable stat card component
│   ├── RecentActivity.jsx   # Recent activity list
│   ├── MostUsedParts.jsx    # Most used parts chart
│   └── MostRepairedMachines.jsx # Most repaired machines chart
├── hooks/                    # Dashboard-specific hooks
│   └── useDashboardData.js  # Data fetching hooks
└── README.md                # This file
```

## Components

### Main Components

- **`index.jsx`**: Routes users to the appropriate dashboard based on their role
- **`AdminDashboard.jsx`**: Dashboard for admin and manager users
- **`TechnicianDashboard.jsx`**: Dashboard for technician users

### Shared Components

- **`StatCard.jsx`**: Reusable card component for displaying statistics
- **`RecentActivity.jsx`**: Displays recent system activities
- **`MostUsedParts.jsx`**: Chart showing most frequently used parts
- **`MostRepairedMachines.jsx`**: Chart showing most repaired machines

### Hooks

- **`useDashboardData.js`**: Custom hooks for fetching dashboard data

## Benefits of This Architecture

1. **Single Responsibility**: Each component has one clear purpose
2. **Role-Based Separation**: Admin and technician dashboards are completely separate
3. **Reusability**: Shared components can be used across different dashboards
4. **Maintainability**: Easier to find and modify specific features
5. **Performance**: Only loads components and data needed for the current user role
6. **Testing**: Can test each dashboard independently

## Usage

The dashboard automatically routes users based on their role:

- **Admin/Manager**: Sees business overview with revenue, work orders, warranty work orders, and warranty repair tickets
- **Technician**: Sees personal work overview with pending work, active work orders, completion rate, and total work orders

## Data Flow

1. User navigates to `/dashboard`
2. `index.jsx` determines user role
3. Appropriate dashboard component is rendered
4. Dashboard component uses hooks to fetch data
5. Data is displayed using shared components

## Adding New Features

To add new features:

1. **For role-specific features**: Add to the appropriate dashboard component
2. **For shared features**: Create a new component in `components/` directory
3. **For new data**: Add a new hook in `hooks/` directory
4. **For new charts**: Create a new chart component following the existing pattern
