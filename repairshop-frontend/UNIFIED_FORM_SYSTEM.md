# Unified Form System Documentation

## Overview

The Unified Form System is a comprehensive, reusable form solution designed to standardize form creation, editing, and updating across the entire application. It provides a consistent user experience, reduces code duplication, and simplifies form management.

## Features

### ✅ Core Features
- **Multi-mode Support**: Create, Edit, Update operations
- **Multi-step Forms**: Wizard-style form progression
- **Dynamic Field Rendering**: Conditional and dependent fields
- **Real-time Validation**: Client-side and server-side validation
- **Auto-save**: Automatic form saving for edit mode
- **Optimistic Updates**: Immediate UI feedback
- **Translation Support**: Built-in internationalization
- **Responsive Design**: Mobile-friendly layouts
- **Accessibility**: WCAG compliant components

### 🎯 Advanced Features
- **Field Dependencies**: Show/hide fields based on other field values
- **Custom Validation**: Business logic validation rules
- **File Uploads**: Support for file attachments
- **Nested Forms**: Complex form structures
- **Performance Optimization**: Efficient rendering and caching
- **Error Handling**: Comprehensive error management
- **Loading States**: Beautiful loading indicators

## Architecture

### Components

1. **UnifiedForm.jsx** - Main form component
2. **formConfigs.js** - Predefined form configurations
3. **useUnifiedForm.js** - Custom hook for form operations

### File Structure
```
src/
├── components/
│   └── UnifiedForm.jsx          # Main form component
├── utils/
│   └── formConfigs.js           # Form configurations
├── hooks/
│   └── useUnifiedForm.js        # Form hook
└── pages/
    └── UnifiedCustomerForm.jsx  # Example implementation
```

## Quick Start

### 1. Basic Usage

```jsx
import React from 'react';
import UnifiedForm from '../components/UnifiedForm';
import { CUSTOMER_FORM_CONFIG } from '../utils/formConfigs';

const CustomerForm = () => {
  return (
    <UnifiedForm
      mode="create"
      entity="customer"
      fields={CUSTOMER_FORM_CONFIG.fields}
      createEndpoint="/api/customers"
      defaultValues={CUSTOMER_FORM_CONFIG.defaultValues}
    />
  );
};
```

### 2. Using the Hook

```jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import UnifiedForm from '../components/UnifiedForm';
import { CUSTOMER_FORM_CONFIG } from '../utils/formConfigs';
import useUnifiedForm from '../hooks/useUnifiedForm';

const CustomerForm = () => {
  const { id } = useParams();
  const mode = id ? 'edit' : 'create';
  
  const {
    formConfig,
    defaultValues,
    isLoading,
    handleSubmit,
    handleCancel
  } = useUnifiedForm({
    config: CUSTOMER_FORM_CONFIG,
    mode,
    entityId: id
  });
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <UnifiedForm
      mode={mode}
      entity="customer"
      entityId={id}
      fields={formConfig.fields}
      defaultValues={defaultValues}
      createEndpoint={formConfig.createEndpoint}
      updateEndpoint={formConfig.updateEndpoint}
      getEndpoint={formConfig.getEndpoint}
      onSuccess={handleSubmit}
      onCancel={handleCancel}
    />
  );
};
```

## Form Configuration

### Field Types

```javascript
import { FIELD_TYPES } from '../utils/formConfigs';

const fields = [
  {
    name: 'name',
    type: FIELD_TYPES.TEXT,
    required: true,
    xs: 12,
    md: 6
  },
  {
    name: 'email',
    type: FIELD_TYPES.EMAIL,
    required: true,
    validation: (value) => {
      if (!value) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return 'Invalid email format';
      }
      return null;
    }
  },
  {
    name: 'role',
    type: FIELD_TYPES.SELECT,
    options: [
      { value: 'admin', label: 'Administrator' },
      { value: 'user', label: 'User' }
    ]
  },
  {
    name: 'active',
    type: FIELD_TYPES.SWITCH,
    label: 'Active Status'
  }
];
```

### Available Field Types

| Type | Description | Props |
|------|-------------|-------|
| `text` | Text input | `minLength`, `maxLength` |
| `email` | Email input | Auto-validation |
| `password` | Password input | `minLength` |
| `number` | Number input | `min`, `max`, `step` |
| `textarea` | Multi-line text | `rows` |
| `select` | Dropdown select | `options` |
| `autocomplete` | Auto-complete input | `options` |
| `switch` | Toggle switch | - |
| `checkbox` | Checkbox | - |
| `radio` | Radio buttons | `options` |
| `date` | Date picker | - |
| `datetime-local` | Date/time picker | - |
| `tel` | Phone number | - |
| `url` | URL input | - |

### Validation Rules

```javascript
import { VALIDATION_RULES } from '../utils/formConfigs';

const fields = [
  {
    name: 'name',
    ...VALIDATION_RULES.REQUIRED('name'),
    ...VALIDATION_RULES.MIN_LENGTH(2),
    ...VALIDATION_RULES.MAX_LENGTH(50)
  },
  {
    name: 'email',
    ...VALIDATION_RULES.EMAIL
  },
  {
    name: 'age',
    ...VALIDATION_RULES.POSITIVE_NUMBER
  }
];
```

### Field Dependencies

```javascript
const fields = [
  {
    name: 'customer_type',
    type: FIELD_TYPES.RADIO,
    options: [
      { value: 'individual', label: 'Individual' },
      { value: 'company', label: 'Company' }
    ]
  },
  {
    name: 'company_name',
    type: FIELD_TYPES.TEXT,
    dependencies: ['customer_type=company'] // Only show for companies
  },
  {
    name: 'vat_number',
    type: FIELD_TYPES.TEXT,
    dependencies: ['customer_type=company'] // Only show for companies
  }
];
```

## Advanced Features

### Multi-step Forms

```javascript
const config = {
  fields: [
    {
      name: 'name',
      step: 0 // First step
    },
    {
      name: 'email',
      step: 0 // First step
    },
    {
      name: 'address',
      step: 1 // Second step
    }
  ],
  steps: [
    'Basic Information',
    'Address Information'
  ]
};

<UnifiedForm
  {...config}
  showStepper={true}
/>
```

### Custom Validation

```javascript
<UnifiedForm
  {...config}
  customValidation={(formData) => {
    const errors = {};
    
    // Business logic validation
    if (formData.company_name && !formData.vat_number) {
      errors.vat_number = 'VAT number is required for companies';
    }
    
    // Cross-field validation
    if (formData.password !== formData.confirm_password) {
      errors.confirm_password = 'Passwords do not match';
    }
    
    return errors;
  }}
/>
```

### Auto-save

```javascript
<UnifiedForm
  {...config}
  enableAutoSave={true}
  autoSaveInterval={30000} // 30 seconds
/>
```

### Pre/Post Processing

```javascript
<UnifiedForm
  {...config}
  beforeSubmit={(formData) => {
    // Clean up data before submission
    const cleaned = { ...formData };
    Object.keys(cleaned).forEach(key => {
      if (cleaned[key] === '') delete cleaned[key];
    });
    return cleaned;
  }}
  afterSubmit={(formData) => {
    // Post-submission processing
    console.log('Form submitted:', formData);
  }}
/>
```

## Form Configurations

### Customer Form

```javascript
import { CUSTOMER_FORM_CONFIG } from '../utils/formConfigs';

const CustomerForm = () => (
  <UnifiedForm
    config={CUSTOMER_FORM_CONFIG}
    mode="create"
  />
);
```

### User Form

```javascript
import { USER_FORM_CONFIG } from '../utils/formConfigs';

const UserForm = () => (
  <UnifiedForm
    config={USER_FORM_CONFIG}
    mode="edit"
    entityId={userId}
  />
);
```

### Machine Form

```javascript
import { MACHINE_FORM_CONFIG } from '../utils/formConfigs';

const MachineForm = () => (
  <UnifiedForm
    config={MACHINE_FORM_CONFIG}
    mode="create"
  />
);
```

### Inventory Form

```javascript
import { INVENTORY_FORM_CONFIG } from '../utils/formConfigs';

const InventoryForm = () => (
  <UnifiedForm
    config={INVENTORY_FORM_CONFIG}
    mode="edit"
    entityId={inventoryId}
  />
);
```

### Work Order Form

```javascript
import { WORK_ORDER_FORM_CONFIG } from '../utils/formConfigs';

const WorkOrderForm = () => (
  <UnifiedForm
    config={WORK_ORDER_FORM_CONFIG}
    mode="create"
    showStepper={true}
  />
);
```

### Repair Ticket Form

```javascript
import { REPAIR_TICKET_FORM_CONFIG } from '../utils/formConfigs';

const RepairTicketForm = () => (
  <UnifiedForm
    config={REPAIR_TICKET_FORM_CONFIG}
    mode="create"
    showStepper={true}
  />
);
```

## Customization

### Creating Custom Form Configurations

```javascript
import { createFormConfig, FIELD_TYPES } from '../utils/formConfigs';

const CUSTOM_FORM_CONFIG = createFormConfig(
  CUSTOMER_FORM_CONFIG,
  {
    fields: [
      {
        name: 'custom_field',
        type: FIELD_TYPES.TEXT,
        required: true
      }
    ],
    customValidation: (formData) => {
      // Custom validation logic
    }
  }
);
```

### Adding Custom Fields

```javascript
const customFields = [
  {
    name: 'notes',
    type: FIELD_TYPES.TEXTAREA,
    rows: 4,
    xs: 12
  }
];

<UnifiedForm
  {...config}
  customFields={customFields}
/>
```

### Styling Customization

```javascript
<UnifiedForm
  {...config}
  maxWidth="lg"
  elevation={3}
  spacing={4}
  sx={{
    '& .MuiTextField-root': {
      backgroundColor: '#f5f5f5'
    }
  }}
/>
```

## Best Practices

### 1. Form Configuration
- Use predefined configurations when possible
- Keep field names consistent across forms
- Use appropriate field types for data
- Implement proper validation rules

### 2. Performance
- Use `useUnifiedForm` hook for automatic data fetching
- Implement proper caching strategies
- Avoid unnecessary re-renders
- Use conditional rendering for complex forms

### 3. User Experience
- Provide clear error messages
- Use multi-step forms for complex data entry
- Implement auto-save for long forms
- Add loading states and feedback

### 4. Accessibility
- Use proper labels and descriptions
- Implement keyboard navigation
- Provide screen reader support
- Use semantic HTML elements

## Migration Guide

### From Existing Forms

1. **Identify form structure**
   ```javascript
   // Old form
   const [formData, setFormData] = useState({});
   const [errors, setErrors] = useState({});
   
   // New form
   const { formConfig, defaultValues } = useUnifiedForm({ config });
   ```

2. **Convert fields**
   ```javascript
   // Old field
   <TextField
     value={formData.name}
     onChange={(e) => setFormData({...formData, name: e.target.value})}
     error={!!errors.name}
     helperText={errors.name}
   />
   
   // New field (in config)
   {
     name: 'name',
     type: FIELD_TYPES.TEXT,
     required: true
   }
   ```

3. **Update validation**
   ```javascript
   // Old validation
   const validateForm = () => {
     const newErrors = {};
     if (!formData.name) newErrors.name = 'Name is required';
     return newErrors;
   };
   
   // New validation
   customValidation: (formData) => {
     const errors = {};
     if (!formData.name) errors.name = 'Name is required';
     return errors;
   }
   ```

## Troubleshooting

### Common Issues

1. **Fields not rendering**
   - Check field configuration
   - Verify dependencies are met
   - Ensure proper field types

2. **Validation not working**
   - Check validation rules
   - Verify field names match
   - Test custom validation functions

3. **Data not saving**
   - Check API endpoints
   - Verify form submission
   - Check network requests

4. **Performance issues**
   - Optimize field rendering
   - Use proper caching
   - Implement lazy loading

### Debug Mode

```javascript
<UnifiedForm
  {...config}
  debug={true} // Enable debug logging
/>
```

## API Reference

### UnifiedForm Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | string | 'create' | Form mode: 'create', 'edit', 'update' |
| `entity` | string | - | Entity name for translations |
| `entityId` | string/number | - | Entity ID for edit mode |
| `fields` | array | [] | Form field configurations |
| `steps` | array | [] | Multi-step form steps |
| `defaultValues` | object | {} | Default form values |
| `createEndpoint` | string | - | API endpoint for creation |
| `updateEndpoint` | string | - | API endpoint for updates |
| `getEndpoint` | string | - | API endpoint for fetching data |
| `showStepper` | boolean | false | Show multi-step stepper |
| `showActions` | boolean | true | Show action buttons |
| `enableAutoSave` | boolean | false | Enable auto-save |
| `customValidation` | function | - | Custom validation function |
| `onSuccess` | function | - | Success callback |
| `onError` | function | - | Error callback |
| `onCancel` | function | - | Cancel callback |

### useUnifiedForm Hook

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `config` | object | - | Form configuration |
| `mode` | string | 'create' | Form mode |
| `entityId` | string/number | - | Entity ID |
| `dependencies` | array | [] | Query dependencies |
| `enableDataFetching` | boolean | true | Enable data fetching |
| `customFields` | array | [] | Additional fields |
| `invalidateQueries` | array | [] | Queries to invalidate |
| `redirectOnSuccess` | boolean | true | Redirect after success |
| `redirectPath` | string | - | Custom redirect path |

## Examples

See the following files for complete examples:
- `src/pages/UnifiedCustomerForm.jsx` - Customer form implementation
- `src/utils/formConfigs.js` - All form configurations
- `src/hooks/useUnifiedForm.js` - Form hook implementation

## Support

For questions and support:
1. Check this documentation
2. Review example implementations
3. Check the troubleshooting section
4. Open an issue for bugs or feature requests
