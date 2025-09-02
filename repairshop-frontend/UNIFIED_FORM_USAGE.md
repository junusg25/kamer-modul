# Unified Form System - Simple Usage Guide

## Overview

This guide shows you how to use the unified form system for **customers**, **users**, and **inventory** - the three core entities in your repair shop application.

## Quick Start

### 1. Customer Form

**File**: `src/pages/UnifiedCustomerForm.jsx`

**Usage**:
```jsx
import UnifiedCustomerForm from './pages/UnifiedCustomerForm';

// In your router
<Route path="/unified-customer" element={<UnifiedCustomerForm />} />
<Route path="/unified-customer/:id" element={<UnifiedCustomerForm />} />
```

**Features**:
- ✅ Multi-step form (Basic Info → Contact → Address)
- ✅ Auto-save for edit mode
- ✅ Custom validation (VAT required for companies)
- ✅ Data cleanup before submission

### 2. User Form

**File**: `src/pages/UnifiedUserForm.jsx`

**Usage**:
```jsx
import UnifiedUserForm from './pages/UnifiedUserForm';

// In your router
<Route path="/unified-user" element={<UnifiedUserForm />} />
<Route path="/unified-user/:id" element={<UnifiedUserForm />} />
```

**Features**:
- ✅ Multi-step form (Basic Info → Account → Role)
- ✅ Role-based validation
- ✅ Auto-save for edit mode
- ✅ Password validation

### 3. Inventory Form

**File**: `src/pages/UnifiedInventoryForm.jsx`

**Usage**:
```jsx
import UnifiedInventoryForm from './pages/UnifiedInventoryForm';

// In your router
<Route path="/unified-inventory" element={<UnifiedInventoryForm />} />
<Route path="/unified-inventory/:id" element={<UnifiedInventoryForm />} />
```

**Features**:
- ✅ Single-page form (no stepper)
- ✅ Number validation
- ✅ Auto-save for edit mode
- ✅ Data type conversion

## How It Works

### 1. Form Configuration

Each form uses a configuration object that defines:
- **Fields**: What inputs to show
- **Validation**: What rules to apply
- **API endpoints**: Where to send data
- **Default values**: Initial form state

**Example** (Customer):
```javascript
export const CUSTOMER_FORM_CONFIG = {
  entity: 'customer',
  createEndpoint: '/api/customers',
  updateEndpoint: '/api/customers',
  getEndpoint: '/api/customers',
  
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      xs: 12,
      md: 6
    },
    // ... more fields
  ],
  
  defaultValues: {
    name: '',
    email: '',
    // ... etc
  }
};
```

### 2. The Hook

The `useUnifiedForm` hook handles:
- ✅ Data fetching for edit mode
- ✅ Form state management
- ✅ API calls (create/update)
- ✅ Error handling
- ✅ Navigation

**Usage**:
```javascript
const {
  formConfig,
  defaultValues,
  isLoading,
  handleSubmit,
  handleCancel
} = useUnifiedForm({
  config: CUSTOMER_FORM_CONFIG,
  mode: 'create', // or 'edit'
  entityId: id,
  redirectOnSuccess: true,
  redirectPath: '/customers'
});
```

### 3. The Component

The `UnifiedForm` component renders:
- ✅ Form fields based on configuration
- ✅ Validation messages
- ✅ Loading states
- ✅ Action buttons
- ✅ Stepper (if enabled)

## Field Types Available

| Type | Description | Example |
|------|-------------|---------|
| `text` | Text input | Name, SKU |
| `email` | Email input | Email address |
| `password` | Password input | User password |
| `number` | Number input | Quantity, Price |
| `textarea` | Multi-line text | Description, Address |
| `select` | Dropdown | Role, Status |
| `phone` | Phone number | Phone, Fax |

## Validation Rules

### Built-in Rules
```javascript
// Required field
...VALIDATION_RULES.REQUIRED('name')

// Email validation
...VALIDATION_RULES.EMAIL

// Phone validation
...VALIDATION_RULES.PHONE

// Number validation
...VALIDATION_RULES.POSITIVE_NUMBER

// Length validation
...VALIDATION_RULES.MIN_LENGTH(8)
...VALIDATION_RULES.MAX_LENGTH(50)
```

### Custom Validation
```javascript
customValidation={(formData) => {
  const errors = {};
  
  // Business logic
  if (formData.company_name && !formData.vat_number) {
    errors.vat_number = 'VAT number is required for companies';
  }
  
  return errors;
}}
```

## API Integration

The forms automatically work with your existing API:

### Customer API
- **GET** `/api/customers` - List customers
- **GET** `/api/customers/:id` - Get customer
- **POST** `/api/customers` - Create customer
- **PATCH** `/api/customers/:id` - Update customer

### User API
- **GET** `/api/users` - List users
- **GET** `/api/users/:id` - Get user
- **POST** `/api/users` - Create user
- **PATCH** `/api/users/:id` - Update user

### Inventory API
- **GET** `/api/inventory` - List inventory
- **GET** `/api/inventory/:id` - Get inventory item
- **POST** `/api/inventory` - Create inventory item
- **PATCH** `/api/inventory/:id` - Update inventory item

## Migration from Existing Forms

### Before (Old Form)
```jsx
// CreateCustomer.jsx - 200+ lines
const [formData, setFormData] = useState({});
const [errors, setErrors] = useState({});
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async () => {
  // 50+ lines of validation and submission logic
};

return (
  <form>
    {/* 100+ lines of form fields */}
  </form>
);
```

### After (Unified Form)
```jsx
// UnifiedCustomerForm.jsx - 50 lines
const { formConfig, defaultValues, handleSubmit } = useUnifiedForm({
  config: CUSTOMER_FORM_CONFIG,
  mode: 'create'
});

return (
  <UnifiedForm
    config={formConfig}
    defaultValues={defaultValues}
    onSuccess={handleSubmit}
  />
);
```

## Benefits

### 1. **Consistency**
- All forms look and behave the same
- Same validation patterns
- Same error handling
- Same loading states

### 2. **Maintainability**
- One component to maintain
- Centralized validation logic
- Easy to add new fields
- Easy to modify behavior

### 3. **Developer Experience**
- Less code to write
- Fewer bugs
- Faster development
- Better testing

### 4. **User Experience**
- Consistent interface
- Better validation feedback
- Auto-save functionality
- Responsive design

## Next Steps

1. **Test the forms** - Try creating and editing customers, users, and inventory
2. **Customize as needed** - Add more fields or validation rules
3. **Extend to other entities** - Apply the same pattern to machines, work orders, etc.
4. **Add advanced features** - File uploads, nested forms, etc.

## Troubleshooting

### Common Issues

1. **Fields not showing**
   - Check field configuration in `formConfigs.js`
   - Verify field names match API response

2. **Validation not working**
   - Check validation rules in field config
   - Verify custom validation function

3. **API errors**
   - Check API endpoints in form config
   - Verify request/response format

4. **Navigation issues**
   - Check `redirectPath` in hook config
   - Verify route configuration

### Debug Mode

Add `debug={true}` to see detailed logging:
```jsx
<UnifiedForm
  {...config}
  debug={true}
/>
```

## Support

For questions or issues:
1. Check this guide
2. Review the example implementations
3. Check the main documentation (`UNIFIED_FORM_SYSTEM.md`)
4. Look at the source code in `src/components/UnifiedForm.jsx`
