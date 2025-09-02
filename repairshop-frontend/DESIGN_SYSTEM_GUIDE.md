# Design System Guide

This guide explains how to use the standardized design system components to ensure consistency across the Repair Shop application.

## Overview

The design system includes:
- **Enhanced Theme** with consistent colors, typography, and spacing
- **Standardized Form Components** for consistent form layouts and validation
- **Common UI Components** like search fields, data tables, and page layouts
- **Form Configurations** for rapid form development
- **Validation Rules** for consistent form validation

## Getting Started

### 1. Import Components

```jsx
// Common components
import { SearchField, DataTable, PageLayout } from '../components';

// Form components
import { FormField, FormLayout } from '../components';

// Configurations
import { customerFormConfig, validateFormData } from '../utils/formConfigurations';
```

### 2. Use the Enhanced Theme

The theme is automatically applied through the updated `App.jsx`. It includes:

- **Consistent spacing** (8px base unit)
- **Typography scale** with proper font weights
- **Color palette** with semantic colors
- **Component overrides** for consistent styling

## Components

### PageLayout

Use `PageLayout` for consistent page structure across all pages.

```jsx
<PageLayout
  title="Customers"
  subtitle="Manage customer information"
  breadcrumbs={[
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Customers' },
  ]}
  primaryAction={{
    label: 'Add Customer',
    icon: <AddIcon />,
    onClick: () => navigate('/create-customer'),
  }}
  showSearch={true}
  searchValue={search}
  onSearchChange={setSearch}
  stats={[
    { label: 'Total', value: 150, color: 'primary' },
    { label: 'Active', value: 120, color: 'success' },
  ]}
>
  {/* Page content */}
</PageLayout>
```

**Props:**
- `title` - Page title
- `subtitle` - Optional subtitle
- `breadcrumbs` - Array of breadcrumb objects
- `primaryAction` - Main action button configuration
- `secondaryActions` - Array of secondary actions
- `showSearch` - Enable search functionality
- `stats` - Array of stat cards to display
- `showFilters` - Enable filter functionality
- `onRefresh` - Refresh handler

### DataTable

Use `DataTable` for consistent table layouts with sorting, pagination, and actions.

```jsx
<DataTable
  data={customers}
  columns={[
    {
      field: 'name',
      headerName: 'Name',
      minWidth: 200,
      sortable: true,
    },
    {
      field: 'email',
      headerName: 'Email',
      minWidth: 200,
      type: 'custom',
      render: (value) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmailIcon />
          {value}
        </Box>
      ),
    },
  ]}
  actions={[
    {
      label: 'Edit',
      icon: <EditIcon />,
      onClick: (row) => navigate(`/edit/${row.id}`),
    },
  ]}
  page={page}
  rowsPerPage={rowsPerPage}
  totalCount={totalCount}
  onPageChange={setPage}
  onRowsPerPageChange={setRowsPerPage}
  loading={loading}
/>
```

**Column Types:**
- `text` - Plain text
- `date` - Formatted date
- `datetime` - Formatted date and time
- `currency` - Formatted currency
- `chip` - Status chip
- `boolean` - Yes/No chip
- `avatar` - User avatar
- `custom` - Custom render function

### SearchField

Use `SearchField` for consistent search functionality.

```jsx
<SearchField
  value={search}
  onChange={setSearch}
  placeholder="Search customers..."
  suggestions={[
    { label: 'Recent Customer', value: 'customer1' },
    { label: 'Another Customer', value: 'customer2' },
  ]}
  showFilters={true}
  onFiltersClick={() => setShowFilters(!showFilters)}
  clearable={true}
/>
```

### FormLayout

Use `FormLayout` for consistent form page structure.

```jsx
<FormLayout
  title="Create Customer"
  subtitle="Add a new customer to the system"
  showBackButton
  primaryAction={{
    label: 'Save Customer',
    icon: <SaveIcon />,
    onClick: handleSubmit,
    disabled: !isValid,
  }}
  secondaryAction={{
    label: 'Cancel',
    onClick: handleCancel,
  }}
  isDirty={isDirty}
  isValid={isValid}
  loading={loading}
>
  {/* Form content */}
</FormLayout>
```

### FormField

Use `FormField` for consistent form inputs.

```jsx
<FormField
  type="text"
  name="name"
  label="Customer Name"
  value={formData.name}
  onChange={handleChange}
  error={errors.name}
  required
  clearable
/>

<FormField
  type="select"
  name="status"
  label="Status"
  value={formData.status}
  onChange={handleChange}
  options={[
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]}
  required
/>

<FormField
  type="autocomplete"
  name="customer"
  label="Customer"
  value={formData.customer}
  onChange={handleChange}
  options={customers}
  freeSolo
/>
```

**Field Types:**
- `text`, `email`, `tel`, `url`, `number` - Text inputs
- `password` - Password input with visibility toggle
- `select` - Dropdown select
- `autocomplete` - Autocomplete with search
- `date` - Date picker
- `switch` - Boolean switch
- `checkbox` - Checkbox
- `radio` - Radio group

## Form Configurations

Use predefined form configurations for rapid development:

```jsx
import { customerFormConfig, validateFormData } from '../utils/formConfigurations';

// Use configuration to render form sections
customerFormConfig.sections.map(section => (
  <Box key={section.title}>
    <Typography variant="h6">{section.title}</Typography>
    <Grid container spacing={3}>
      {section.fields.map(field => (
        <Grid item xs={12} md={field.gridSize || 6} key={field.name}>
          <FormField
            {...field}
            value={formData[field.name]}
            onChange={handleChange}
            error={errors[field.name]}
          />
        </Grid>
      ))}
    </Grid>
  </Box>
))

// Validate form data
const formErrors = validateFormData(formData, customerFormConfig);
```

**Available Configurations:**
- `customerFormConfig` - Customer form fields
- `userFormConfig` - User management form
- `inventoryFormConfig` - Inventory item form
- `machineFormConfig` - Machine information form
- `repairTicketFormConfig` - Repair ticket form

## Styling Guidelines

### Colors

Use semantic colors from the theme:

```jsx
// Primary actions
<Button color="primary">Save</Button>

// Success states
<Chip color="success">Active</Chip>

// Warning states
<Alert severity="warning">Warning message</Alert>

// Error states
<Typography color="error">Error message</Typography>
```

### Spacing

Use the theme spacing function:

```jsx
// 8px spacing units
<Box sx={{ p: 2 }}>     {/* 16px padding */}
<Box sx={{ mb: 3 }}>    {/* 24px margin bottom */}
<Box sx={{ gap: 1 }}>   {/* 8px gap */}
```

### Typography

Use semantic typography variants:

```jsx
<Typography variant="h4">Page Title</Typography>
<Typography variant="h6">Section Title</Typography>
<Typography variant="body1">Body text</Typography>
<Typography variant="body2" color="text.secondary">Secondary text</Typography>
<Typography variant="caption">Small text</Typography>
```

### Shadows and Borders

Use consistent shadows and borders:

```jsx
<Paper sx={{ boxShadow: 2 }}>     {/* Medium shadow */}
<Card sx={{ border: 1 }}>         {/* Standard border */}
```

## Migration Guide

### Updating Existing Pages

1. **Replace page structure:**
   ```jsx
   // Before
   <Box sx={{ p: 3 }}>
     <Typography variant="h4">{title}</Typography>
     {/* content */}
   </Box>

   // After
   <PageLayout title={title}>
     {/* content */}
   </PageLayout>
   ```

2. **Replace table implementations:**
   ```jsx
   // Before
   <TableContainer>
     <Table>
       {/* complex table setup */}
     </Table>
   </TableContainer>

   // After
   <DataTable
     data={data}
     columns={columns}
     actions={actions}
   />
   ```

3. **Replace form fields:**
   ```jsx
   // Before
   <TextField
     label="Name"
     value={name}
     onChange={(e) => setName(e.target.value)}
     fullWidth
   />

   // After
   <FormField
     type="text"
     name="name"
     label="Name"
     value={name}
     onChange={handleChange}
   />
   ```

### Best Practices

1. **Always use PageLayout** for page structure
2. **Use FormLayout** for form pages
3. **Leverage FormField** for all form inputs
4. **Use DataTable** for data display
5. **Follow the color semantics** (primary, success, warning, error)
6. **Use consistent spacing** with theme units
7. **Implement proper loading states** and error handling
8. **Add proper accessibility** attributes

### Example: Complete Page Migration

```jsx
// Before
export default function CustomersOld() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4">Customers</Typography>
      <TextField placeholder="Search..." />
      <TableContainer>
        {/* Complex table setup */}
      </TableContainer>
    </Box>
  );
}

// After
export default function CustomersNew() {
  return (
    <PageLayout
      title="Customers"
      showSearch
      searchValue={search}
      onSearchChange={setSearch}
    >
      <DataTable
        data={customers}
        columns={columns}
        actions={actions}
      />
    </PageLayout>
  );
}
```

This design system ensures consistency, reduces development time, and provides a better user experience across the entire application.
