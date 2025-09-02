# Translation Guide for Repair Shop App

## Overview

This document provides a comprehensive guide to the translation system implemented in the Repair Shop App frontend. It includes all detected hardcoded English labels and instructions for using the translation utilities.

## Translation System

### Files
- `src/utils/translations.js` - Centralized translation file containing all English labels
- `src/utils/translations-bs.js` - Bosnian translation file
- `src/contexts/LanguageContext.jsx` - Language context provider
- `src/components/LanguageSwitcher.jsx` - Language switcher component
- `TRANSLATION_GUIDE.md` - This documentation file

### Translation Utilities

#### Using the Language Context (Recommended)
```javascript
import { useLanguage } from '../contexts/LanguageContext'

function MyComponent() {
  const { translate, currentLanguage, changeLanguage } = useLanguage()
  
  // Simple translation
  const label = translate('navigation.dashboard') // Returns: 'Dashboard' or 'Kontrolna tabla'
  
  // Translation with interpolation
  const welcome = translate('dashboard.welcomeBack', { name: 'John' }) // Returns: 'Welcome back, John!' or 'Dobrodošli nazad, John!'
  
  // Change language
  const switchToBosnian = () => changeLanguage('bs')
  
  return <div>{label}</div>
}
```

#### Direct Translation Functions (Legacy)
```javascript
import { t } from '../utils/translations'
import { tBs } from '../utils/translations-bs'

// English translation
const label = t('navigation.dashboard') // Returns: 'Dashboard'

// Bosnian translation
const labelBs = tBs('navigation.dashboard') // Returns: 'Kontrolna tabla'

// Translation with interpolation
const welcome = t('dashboard.welcomeBack', { name: 'John' }) // Returns: 'Welcome back, John!'
```

#### Pluralization Function
```javascript
import { useLanguage } from '../contexts/LanguageContext'

function MyComponent() {
  const { translatePlural } = useLanguage()
  
  // Pluralization with count
  const notificationCount = translatePlural('notifications.notificationCount', 5, { count: 5 }) // Returns: '5 notifications' or '5 obavještenja'
  const notificationCount2 = translatePlural('notifications.notificationCount', 1, { count: 1 }) // Returns: '1 notification' or '1 obavještenje'
}
```

#### Direct Pluralization Functions (Legacy)
```javascript
import { tPlural } from '../utils/translations'
import { tPluralBs } from '../utils/translations-bs'

// English pluralization
const notificationCount = tPlural('notifications.notificationCount', 5, { count: 5 }) // Returns: '5 notifications'

// Bosnian pluralization
const notificationCountBs = tPluralBs('notifications.notificationCount', 5, { count: 5 }) // Returns: '5 obavještenja'
```

## Language Switcher

The application includes a language switcher component that allows users to switch between English and Bosnian languages. The language switcher is located in the top navigation bar and displays the current language with a flag icon.

### Features
- **Visual Language Indicator**: Shows current language with flag (🇺🇸 for English, 🇧🇦 for Bosnian)
- **Easy Switching**: Click to open language menu and select desired language
- **Persistent Preference**: Language choice is saved in localStorage
- **Immediate Updates**: All translated content updates immediately when language is changed

### Usage
```javascript
import LanguageSwitcher from './components/LanguageSwitcher'

// Add to your layout component
<LanguageSwitcher />
```

## Detected Hardcoded English Labels

### Navigation and Layout
- Dashboard
- Repair Tickets
- Warranty Tickets
- Work Orders
- Warranty Orders
- Machines
- Customers
- Inventory
- Users
- Notifications
- Search everything...
- Logout
- Role

### Authentication
- Repair Shop
- Sign in to your account
- Email Address
- Password
- Sign In
- Login failed

### Dashboard
- Business Dashboard
- My Dashboard
- Welcome back, {name}!
- Here's your business overview.
- Here's your work overview.
- Auto-refresh
- Refresh Dashboard
- Data Loading Error
- Failed to load dashboard data

#### Stat Cards
- Total Revenue
- Work Orders
- Warranty Work Orders
- Total Customers
- My Pending Work
- Active Work Orders
- Completion Rate
- Warranty Orders
- Repair Tickets
- Loading...

#### Stat Card Subtitles
- From completed work orders
- completed
- active
- high priority
- revenue
- in progress
- converted
- 0 high priority
- $0 revenue
- 0 completed

#### Stat Card Links
- View Completed Work Orders
- View All Work Orders
- View All Warranty Work Orders
- View All Customers
- View My Pending Work
- View My Active Orders
- View My Completed Orders
- View My Warranty Orders
- View My Repair Tickets

#### Recent Activity
- Loading recent activity...
- No recent activity

#### Most Repaired Machines
- Loading most repaired machines...
- No machine data available
- repairs
- Avg:
- hours
- customers

#### Most Used Parts
- Loading most used parts...
- No parts data available
- units used
- value
- work orders
- avg price

#### Technician Work Overview
- Loading work overview...
- No work assigned
- Customer:
- Est. Value:

#### Team Overview
- Team Overview
- Quick access to team management and performance
- View Team
- All Work Orders

### Form Labels and Placeholders

#### Customer Forms
- Customer Name
- Full Name
- Company Name
- Company Name (if applicable)
- VAT Number
- VAT Number (if Company)
- Email
- Phone 1
- Phone 2
- Fax
- City
- Postal Code
- Street Address
- Address
- Enter full name
- Enter complete address
- Enter secure password

#### Machine Forms
- Select Machine
- Select Machine Model
- Machine Name
- Machine Model Name
- Manufacturer
- Model Name
- Catalogue Number
- Category
- Serial Number
- Bought At
- Receipt Number
- Purchase Date
- Machine Description
- Enter unique serial number
- Enter description
- Enter serial number

#### Problem and Notes
- Problem Description
- Notes
- Additional Equipment
- Brought By
- Describe the issue or problem with the machine...
- Additional notes or observations...
- Any additional equipment brought with the machine...
- Name of person who brought the machine (or express mail company)
- Equipment brought with the machine
- Name of person who brought the machine

#### Work Order Forms
- Assigned Technician
- Estimated Hours
- Labor Hours
- Troubleshooting Fee
- Parts Subtotal
- Note Content
- Inventory Item
- Estimated time to complete the work
- Describe the warranty work to be performed

#### Inventory Forms
- Item Name
- Initial Quantity
- Unit Price
- Minimum Stock Level

#### User Forms
- User Role

#### Search and Selection
- Search and Select Customer
- Search and Select Machine
- Search and Select Category
- Select Customer
- Select Machine Model

#### Error Messages
- Error loading customers
- No customers available
- No customers found
- Error loading machines
- No machines found for this customer
- Loading machine models...
- Error loading machine models
- No machine models available
- Error loading categories
- No categories found
- Please select a customer first

### Status and Priority
- Under Warranty
- No Warranty
- Expired
- high
- medium
- low
- completed
- in_progress
- pending
- cancelled
- converted
- intake
- active
- Read
- Unread
- New

### Buttons and Actions
- Cancel
- Close
- Delete
- Edit
- Save
- Submit
- Add
- View
- Convert
- Refresh
- Export
- Import
- Download
- Upload
- Search
- Filter
- Clear
- Reset
- Back
- Next
- Previous
- Finish
- Confirm
- Reject
- Approve
- Mark as read
- Mark all read
- View All
- View Details
- View Machine Details
- Remove Part
- Convert to Work Order
- Convert to Warranty Work Order
- Refresh Page
- Go to Dashboard
- Sign In
- Logout
- Select All
- Deselect All
- Delete Selected

### Tooltips
- View Details
- Convert to Work Order
- Convert to Warranty Work Order
- Remove Part
- Refresh Dashboard
- Filter by type
- Mark as read
- Delete
- Settings
- Export
- Refresh
- Sound On
- Sound Off

### Notifications
- Notifications
- unread
- All
- Filtered by:
- Search notifications...
- Error loading notifications
- No notifications
- No notifications match your filters
- Mark all read
- View All
- {count} notification{plural}
- {count} unread
- All ({count})
- Unread ({count})
- New

#### Notification Types
- All Types
- Work Orders
- Warranty Work Orders
- Repair Tickets
- Inventory
- Customers
- Machines
- Communication
- Success
- Warning
- Error
- Info

#### Notification Settings
- Notification Settings
- Enable sound notifications
- Auto-refresh notifications
- Refresh Interval (seconds)
- 15 seconds
- 30 seconds
- 1 minute
- 5 minutes

#### Stats
- Total
- Errors
- Warnings
- Work Orders

### Error Messages
- Something went wrong
- We're sorry, but something unexpected happened. Our team has been notified.
- Error Details:
- Failed to load data
- Failed to load notifications
- useModal must be used within a ModalProvider

### Time and Date
- Just now
- {minutes}m ago
- {hours}h ago
- {days}d ago
- Loading...

### Pagination and Data
- Showing {start} to {end} of {total} {item}
- Page {current} of {total}
- Rows per page
- of

### Dialog and Modal Titles
- Delete Confirmation
- Edit Item
- Add Item
- View Details
- Settings
- Notification Settings

### Table Headers
- Title
- Message
- Type
- Status
- Time
- Actions
- ID
- Read
- Created At

### Alert Messages
- Error
- Warning
- Info
- Success

### Common Labels
- Loading...
- No data available
- Error
- Success
- Warning
- Info
- Yes
- No
- OK
- Cancel
- Close
- Save
- Delete
- Edit
- Add
- View
- Search
- Filter
- Refresh
- Export
- Import
- Download
- Upload
- Back
- Next
- Previous
- Finish
- Confirm
- Reject
- Approve

## Usage Examples

### Replacing Hardcoded Labels

#### Before (Hardcoded)
```javascript
<Typography variant="h4">Dashboard</Typography>
<Button>Cancel</Button>
<TextField label="Customer Name" />
```

#### After (Using Translation)
```javascript
import { t } from '../utils/translations'

<Typography variant="h4">{t('navigation.dashboard')}</Typography>
<Button>{t('actions.cancel')}</Button>
<TextField label={t('forms.customerName')} />
```

### Using Interpolation
```javascript
// Welcome message with user name
const welcomeMessage = t('dashboard.welcomeBack', { name: user.name })

// Pagination info
const paginationInfo = t('pagination.showing', { 
  start: 1, 
  end: 10, 
  total: 100, 
  item: 'notifications' 
})
```

### Using Pluralization
```javascript
// Notification count
const notificationText = tPlural('notifications.notificationCount', count)

// Time ago
const timeAgo = t('time.minutesAgo', { minutes: 5 })
```

## Migration Strategy

1. **Import the translation utilities** in each component file
2. **Replace hardcoded strings** with translation function calls
3. **Test the application** to ensure all translations work correctly
4. **Add new translations** to the centralized file as needed

## Adding New Translations

When adding new features or components:

1. Add new translation keys to `src/utils/translations.js`
2. Use the translation functions in your components
3. Update this documentation with new labels

## Benefits

- **Centralized Management**: All text is managed in one place
- **Internationalization Ready**: Easy to add other languages
- **Consistency**: Ensures consistent terminology across the app
- **Maintainability**: Easier to update and maintain text content
- **Type Safety**: Structured approach reduces typos and errors

## Future Enhancements

- Add support for multiple languages
- Implement locale detection
- Add translation management tools
- Create translation validation scripts
- Add translation memory for consistency
