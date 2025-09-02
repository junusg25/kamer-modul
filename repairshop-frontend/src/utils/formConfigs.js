/**
 * Form Configuration Utility
 * 
 * This file contains predefined form configurations for different entities
 * in the application. These configurations can be used with the UnifiedForm component
 * to quickly create consistent forms across the app.
 */

// Common field types and configurations
export const FIELD_TYPES = {
  TEXT: 'text',
  EMAIL: 'email',
  PASSWORD: 'password',
  NUMBER: 'number',
  TEXTAREA: 'textarea',
  SELECT: 'select',
  AUTOCOMPLETE: 'autocomplete',
  SWITCH: 'switch',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  DATE: 'date',
  DATETIME: 'datetime-local',
  PHONE: 'tel',
  URL: 'url'
};

// Common validation rules with enhanced messages
export const VALIDATION_RULES = {
  REQUIRED: (fieldName) => ({
    required: true,
    validation: (value) => !value || value.toString().trim() === '' ? `${fieldName} is required` : null
  }),
  
  EMAIL: {
    type: FIELD_TYPES.EMAIL,
    validation: (value) => {
      if (!value) return null;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return !emailRegex.test(value) ? 'forms.invalidEmail' : null;
    }
  },
  
  PHONE: {
    type: FIELD_TYPES.PHONE,
    validation: (value) => {
      if (!value) return null;
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      return !phoneRegex.test(value.replace(/\s/g, '')) ? 'forms.invalidPhone' : null;
    }
  },
  
  MIN_LENGTH: (min) => ({
    minLength: min,
    validation: (value) => value && value.length < min ? `forms.minLength` : null
  }),
  
  MAX_LENGTH: (max) => ({
    maxLength: max,
    validation: (value) => value && value.length > max ? `forms.maxLength` : null
  }),
  
  POSITIVE_NUMBER: {
    type: FIELD_TYPES.NUMBER,
    validation: (value) => {
      if (!value) return null;
      const num = parseFloat(value);
      return isNaN(num) || num < 0 ? 'forms.positiveNumber' : null;
    }
  },
  
  VAT_NUMBER: {
    validation: (value) => {
      if (!value) return null;
      // Basic VAT number validation (can be enhanced based on country)
      const vatRegex = /^[A-Z]{2}[0-9A-Z]+$/;
      return !vatRegex.test(value.toUpperCase()) ? 'forms.invalidVatNumber' : null;
    }
  },
  
  POSTAL_CODE: {
    validation: (value) => {
      if (!value) return null;
      // Basic postal code validation (can be enhanced based on country)
      const postalRegex = /^[0-9A-Z\s-]{3,10}$/i;
      return !postalRegex.test(value) ? 'forms.invalidPostalCode' : null;
    }
  }
};

// Customer form configuration - matches your API structure
export const CUSTOMER_FORM_CONFIG = {
  entity: 'customer',
  createEndpoint: '/api/customers',
  updateEndpoint: '/api/customers',
  getEndpoint: '/api/customers',
  
  fields: [
    // Step 0: Basic Information
    {
      name: 'name',
      type: FIELD_TYPES.TEXT,
      required: true,
      step: 0,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterCustomerName',
      ...VALIDATION_RULES.REQUIRED('forms.name')
    },
    {
      name: 'company_name',
      type: FIELD_TYPES.TEXT,
      step: 0,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterCompanyName'
    },
    {
      name: 'vat_number',
      type: FIELD_TYPES.TEXT,
      step: 0,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterVatNumber',
      ...VALIDATION_RULES.VAT_NUMBER
    },
    
    // Step 1: Contact Information
    {
      name: 'email',
      type: FIELD_TYPES.EMAIL,
      step: 1,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterEmailAddress',
      ...VALIDATION_RULES.EMAIL
    },
    {
      name: 'phone',
      type: FIELD_TYPES.PHONE,
      step: 1,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterPrimaryPhone',
      ...VALIDATION_RULES.PHONE
    },
    {
      name: 'phone2',
      type: FIELD_TYPES.PHONE,
      step: 1,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterSecondaryPhone',
      ...VALIDATION_RULES.PHONE
    },
    {
      name: 'fax',
      type: FIELD_TYPES.TEXT,
      step: 1,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterFaxNumber'
    },
    
    // Step 2: Address Information
    {
      name: 'city',
      type: FIELD_TYPES.TEXT,
      step: 2,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterCity'
    },
    {
      name: 'postal_code',
      type: FIELD_TYPES.TEXT,
      step: 2,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterPostalCode',
      ...VALIDATION_RULES.POSTAL_CODE
    },
    {
      name: 'street_address',
      type: FIELD_TYPES.TEXTAREA,
      step: 2,
      rows: 3,
      xs: 12,
      placeholder: 'forms.enterStreetAddress'
    },
    {
      name: 'address',
      type: FIELD_TYPES.TEXTAREA,
      step: 2,
      rows: 3,
      xs: 12,
      placeholder: 'forms.enterAdditionalAddress'
    }
  ],
  
  steps: [
    'forms.basicInformation',
    'forms.contactInformation',
    'forms.addressInformation'
  ],
  
  defaultValues: {
    name: '',
    email: '',
    phone: '',
    phone2: '',
    company_name: '',
    vat_number: '',
    city: '',
    postal_code: '',
    street_address: '',
    address: '',
    fax: ''
  }
};

// User form configuration - matches your API structure
export const USER_FORM_CONFIG = {
  entity: 'user',
  createEndpoint: '/api/users',
  updateEndpoint: '/api/users',
  getEndpoint: '/api/users',
  
  fields: [
    // Step 0: Basic Information
    {
      name: 'name',
      type: FIELD_TYPES.TEXT,
      required: true,
      step: 0,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterFullName',
      ...VALIDATION_RULES.REQUIRED('forms.name')
    },
    {
      name: 'email',
      type: FIELD_TYPES.EMAIL,
      required: true,
      step: 0,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterEmailAddress',
      ...VALIDATION_RULES.EMAIL
    },
    {
      name: 'phone',
      type: FIELD_TYPES.PHONE,
      step: 0,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterPhoneNumber',
      ...VALIDATION_RULES.PHONE
    },
    
    // Step 1: Account Information
    {
      name: 'password',
      type: FIELD_TYPES.PASSWORD,
      required: true,
      step: 1,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterPassword',
      ...VALIDATION_RULES.MIN_LENGTH(8)
    },
    {
      name: 'department',
      type: FIELD_TYPES.TEXT,
      step: 1,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterDepartment'
    },
    
    // Step 2: Role Assignment
    {
      name: 'role',
      type: FIELD_TYPES.SELECT,
      required: true,
      step: 2,
      xs: 12,
      md: 6,
      options: [
        { value: 'admin', label: 'forms.administrator' },
        { value: 'manager', label: 'forms.manager' },
        { value: 'technician', label: 'forms.technician' }
      ]
    },
    {
      name: 'status',
      type: FIELD_TYPES.SELECT,
      step: 2,
      xs: 12,
      md: 6,
      options: [
        { value: 'active', label: 'forms.active' },
        { value: 'inactive', label: 'forms.inactive' }
      ]
    }
  ],
  
  steps: [
    'forms.basicInformation',
    'forms.accountInformation',
    'forms.roleAssignment'
  ],
  
  defaultValues: {
    name: '',
    email: '',
    password: '',
    role: 'technician',
    phone: '',
    department: '',
    status: 'active'
  }
};

// Inventory form configuration - matches your API structure
export const INVENTORY_FORM_CONFIG = {
  entity: 'inventory',
  createEndpoint: '/api/inventory',
  updateEndpoint: '/api/inventory',
  getEndpoint: '/api/inventory',
  
  fields: [
    {
      name: 'name',
      type: FIELD_TYPES.TEXT,
      required: true,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterItemName',
      ...VALIDATION_RULES.REQUIRED('forms.name')
    },
    {
      name: 'description',
      type: FIELD_TYPES.TEXTAREA,
      rows: 3,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterItemDescription'
    },
    {
      name: 'category',
      type: FIELD_TYPES.TEXT,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterCategory'
    },
    {
      name: 'quantity',
      type: FIELD_TYPES.NUMBER,
      required: true,
      xs: 12,
      md: 4,
      placeholder: 'forms.enterQuantity',
      ...VALIDATION_RULES.POSITIVE_NUMBER
    },
    {
      name: 'unit_price',
      type: FIELD_TYPES.NUMBER,
      xs: 12,
      md: 4,
      startAdornment: '$',
      placeholder: 'forms.enterUnitPrice',
      ...VALIDATION_RULES.POSITIVE_NUMBER
    },
    {
      name: 'min_stock_level',
      type: FIELD_TYPES.NUMBER,
      xs: 12,
      md: 4,
      placeholder: 'forms.enterMinStockLevel',
      ...VALIDATION_RULES.POSITIVE_NUMBER
    },
    {
      name: 'supplier',
      type: FIELD_TYPES.TEXT,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterSupplierName'
    },
    {
      name: 'sku',
      type: FIELD_TYPES.TEXT,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterSku'
    },
    {
      name: 'location',
      type: FIELD_TYPES.TEXT,
      xs: 12,
      md: 6,
      placeholder: 'forms.enterLocation'
    }
  ],
  
  defaultValues: {
    name: '',
    description: '',
    category: '',
    quantity: '',
    unit_price: '',
    min_stock_level: '',
    supplier: '',
    sku: '',
    location: ''
  }
};

// Repair Ticket Form Configuration
export const REPAIR_TICKET_FORM_CONFIG = {
  title: 'forms.repairTicket',
  createEndpoint: '/api/repairTickets',
  updateEndpoint: '/api/repairTickets',
  getEndpoint: '/api/repairTickets',
  steps: [
    'forms.customerInformation',
    'forms.machineInformation', 
    'forms.problemDetails'
  ],
  fields: [
    // Step 0: Customer Information
    {
      name: 'customer_type',
      type: 'radio',
      label: 'forms.selectCustomerType',
      required: true,
      options: [
        { value: 'existing', label: 'forms.existingCustomer' },
        { value: 'new', label: 'forms.newCustomer' }
      ],
      step: 0
    },
    {
      name: 'customer_id',
      type: 'autocomplete',
      label: 'forms.selectExistingCustomer',
      placeholder: 'forms.searchCustomersPlaceholder',
      required: true,
      dependsOn: { field: 'customer_type', value: 'existing' },
      apiEndpoint: '/customers',
      getOptionLabel: (option) => `${option.name}${option.company_name ? ` (${option.company_name})` : ''}`,
      step: 0
    },
    // New customer fields
    {
      name: 'customer_name',
      type: 'text',
      label: 'forms.customerName',
      placeholder: 'forms.enterCustomerName',
      required: true,
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_email',
      type: 'email',
      label: 'forms.email',
      placeholder: 'forms.enterEmail',
      required: true,
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_phone',
      type: 'text',
      label: 'forms.phone1',
      placeholder: 'forms.enterPhone1',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_phone2',
      type: 'text',
      label: 'forms.phone2',
      placeholder: 'forms.enterPhone2',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_fax',
      type: 'text',
      label: 'forms.fax',
      placeholder: 'forms.enterFax',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_company_name',
      type: 'text',
      label: 'forms.companyName',
      placeholder: 'forms.enterCompanyName',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_vat_number',
      type: 'text',
      label: 'forms.vatNumber',
      placeholder: 'forms.enterVatNumber',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_street_address',
      type: 'text',
      label: 'forms.streetAddress',
      placeholder: 'forms.enterStreetAddress',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_city',
      type: 'text',
      label: 'forms.city',
      placeholder: 'forms.enterCity',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_postal_code',
      type: 'text',
      label: 'forms.postalCode',
      placeholder: 'forms.enterPostalCode',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },

    // Step 1: Machine Information
    {
      name: 'machine_type',
      type: 'radio',
      label: 'forms.selectMachineType',
      required: true,
      options: [
        { value: 'existing', label: 'forms.existingMachine' },
        { value: 'new', label: 'forms.newMachine' }
      ],
      step: 1
    },
    {
      name: 'machine_id',
      type: 'autocomplete',
      label: 'forms.selectExistingMachine',
      placeholder: 'forms.searchMachinesPlaceholder',
      required: true,
      dependsOn: { field: 'machine_type', value: 'existing' },
      apiEndpoint: (formData) => `/machines/by-customer/${formData.customer_id}`,
      getOptionLabel: (option) => `${option.model_name || option.name} - ${option.serial_number}`,
      step: 1
    },
    // New machine fields
    {
      name: 'machine_model_type',
      type: 'radio',
      label: 'forms.selectModelType',
      required: true,
      dependsOn: { field: 'machine_type', value: 'new' },
      options: [
        { value: 'existing', label: 'forms.existingModel' },
        { value: 'new', label: 'forms.newModel' }
      ],
      step: 1
    },
    {
      name: 'machine_model_name',
      type: 'autocomplete',
      label: 'forms.selectExistingModel',
      placeholder: 'forms.searchModelsPlaceholder',
      required: true,
      dependsOn: { field: 'machine_model_type', value: 'existing' },
      apiEndpoint: '/machines/models',
      getOptionLabel: (option) => `${option.name} - ${option.manufacturer}`,
      step: 1
    },
    {
      name: 'machine_manufacturer',
      type: 'text',
      label: 'forms.manufacturer',
      placeholder: 'forms.enterManufacturer',
      required: true,
      dependsOn: { field: 'machine_model_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_catalogue_number',
      type: 'text',
      label: 'forms.catalogueNumber',
      placeholder: 'forms.enterCatalogueNumber',
      dependsOn: { field: 'machine_model_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_category_id',
      type: 'autocomplete',
      label: 'forms.category',
      placeholder: 'forms.searchCategoriesPlaceholder',
      dependsOn: { field: 'machine_model_type', value: 'new' },
      apiEndpoint: '/machine-categories',
      getOptionLabel: (option) => option.name,
      step: 1
    },
    {
      name: 'machine_serial_number',
      type: 'text',
      label: 'forms.serialNumber',
      placeholder: 'forms.enterSerialNumber',
      required: true,
      dependsOn: { field: 'machine_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_receipt_number',
      type: 'text',
      label: 'forms.receiptNumber',
      placeholder: 'forms.enterReceiptNumber',
      dependsOn: { field: 'machine_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_purchase_date',
      type: 'date',
      label: 'forms.purchaseDate',
      dependsOn: { field: 'machine_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_bought_at',
      type: 'text',
      label: 'forms.boughtAt',
      placeholder: 'forms.enterBoughtAt',
      dependsOn: { field: 'machine_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_description',
      type: 'textarea',
      label: 'forms.machineDescription',
      placeholder: 'forms.enterMachineDescription',
      dependsOn: { field: 'machine_type', value: 'new' },
      step: 1
    },

    // Step 2: Problem Details
    {
      name: 'problem_description',
      type: 'textarea',
      label: 'forms.problemDescription',
      placeholder: 'forms.enterProblemDescription',
      required: true,
      step: 2
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'forms.notes',
      placeholder: 'forms.enterNotes',
      step: 2
    },
    {
      name: 'additional_equipment',
      type: 'text',
      label: 'forms.additionalEquipment',
      placeholder: 'forms.enterAdditionalEquipment',
      step: 2
    },
    {
      name: 'brought_by',
      type: 'text',
      label: 'forms.broughtBy',
      placeholder: 'forms.enterBroughtBy',
      step: 2
    }
  ],
  validation: {
    customer_name: [VALIDATION_RULES.REQUIRED('forms.customerName')],
    customer_email: [VALIDATION_RULES.REQUIRED('forms.email'), VALIDATION_RULES.EMAIL],
    machine_serial_number: [VALIDATION_RULES.REQUIRED('forms.serialNumber')],
    machine_model_name: [VALIDATION_RULES.REQUIRED('forms.modelName')],
    machine_manufacturer: [VALIDATION_RULES.REQUIRED('forms.manufacturer')],
    problem_description: [VALIDATION_RULES.REQUIRED('forms.problemDescription')]
  }
};

// Warranty Repair Ticket Form Configuration
export const WARRANTY_REPAIR_TICKET_FORM_CONFIG = {
  title: 'forms.warrantyRepairTicket',
  createEndpoint: '/api/warrantyRepairTickets',
  updateEndpoint: '/api/warrantyRepairTickets',
  getEndpoint: '/api/warrantyRepairTickets',
  steps: [
    'forms.customerInformation',
    'forms.machineInformation', 
    'forms.problemDetails'
  ],
  fields: [
    // Step 0: Customer Information
    {
      name: 'customer_type',
      type: 'radio',
      label: 'forms.selectCustomerType',
      required: true,
      options: [
        { value: 'existing', label: 'forms.existingCustomer' },
        { value: 'new', label: 'forms.newCustomer' }
      ],
      step: 0
    },
    {
      name: 'customer_id',
      type: 'autocomplete',
      label: 'forms.selectExistingCustomer',
      placeholder: 'forms.searchCustomersPlaceholder',
      required: true,
      dependsOn: { field: 'customer_type', value: 'existing' },
      apiEndpoint: '/customers',
      getOptionLabel: (option) => `${option.name}${option.company_name ? ` (${option.company_name})` : ''}`,
      step: 0
    },
    // New customer fields
    {
      name: 'customer_name',
      type: 'text',
      label: 'forms.customerName',
      placeholder: 'forms.enterCustomerName',
      required: true,
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_email',
      type: 'email',
      label: 'forms.email',
      placeholder: 'forms.enterEmail',
      required: true,
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_phone',
      type: 'text',
      label: 'forms.phone1',
      placeholder: 'forms.enterPhone1',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_phone2',
      type: 'text',
      label: 'forms.phone2',
      placeholder: 'forms.enterPhone2',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_fax',
      type: 'text',
      label: 'forms.fax',
      placeholder: 'forms.enterFax',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_company_name',
      type: 'text',
      label: 'forms.companyName',
      placeholder: 'forms.enterCompanyName',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_vat_number',
      type: 'text',
      label: 'forms.vatNumber',
      placeholder: 'forms.enterVatNumber',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_street_address',
      type: 'text',
      label: 'forms.streetAddress',
      placeholder: 'forms.enterStreetAddress',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_city',
      type: 'text',
      label: 'forms.city',
      placeholder: 'forms.enterCity',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },
    {
      name: 'customer_postal_code',
      type: 'text',
      label: 'forms.postalCode',
      placeholder: 'forms.enterPostalCode',
      dependsOn: { field: 'customer_type', value: 'new' },
      step: 0
    },

    // Step 1: Machine Information
    {
      name: 'machine_type',
      type: 'radio',
      label: 'forms.selectMachineType',
      required: true,
      options: [
        { value: 'existing', label: 'forms.existingMachine' },
        { value: 'new', label: 'forms.newMachine' }
      ],
      step: 1
    },
    {
      name: 'machine_id',
      type: 'autocomplete',
      label: 'forms.selectExistingMachine',
      placeholder: 'forms.searchMachinesPlaceholder',
      required: true,
      dependsOn: { field: 'machine_type', value: 'existing' },
      apiEndpoint: (formData) => `/machines/by-customer/${formData.customer_id}`,
      getOptionLabel: (option) => `${option.model_name || option.name} - ${option.serial_number}`,
      step: 1
    },
    // New machine fields
    {
      name: 'machine_model_type',
      type: 'radio',
      label: 'forms.selectModelType',
      required: true,
      dependsOn: { field: 'machine_type', value: 'new' },
      options: [
        { value: 'existing', label: 'forms.existingModel' },
        { value: 'new', label: 'forms.newModel' }
      ],
      step: 1
    },
    {
      name: 'machine_model_name',
      type: 'autocomplete',
      label: 'forms.selectExistingModel',
      placeholder: 'forms.searchModelsPlaceholder',
      required: true,
      dependsOn: { field: 'machine_model_type', value: 'existing' },
      apiEndpoint: '/machines/models',
      getOptionLabel: (option) => `${option.name} - ${option.manufacturer}`,
      step: 1
    },
    {
      name: 'machine_manufacturer',
      type: 'text',
      label: 'forms.manufacturer',
      placeholder: 'forms.enterManufacturer',
      required: true,
      dependsOn: { field: 'machine_model_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_catalogue_number',
      type: 'text',
      label: 'forms.catalogueNumber',
      placeholder: 'forms.enterCatalogueNumber',
      dependsOn: { field: 'machine_model_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_category_id',
      type: 'autocomplete',
      label: 'forms.category',
      placeholder: 'forms.searchCategoriesPlaceholder',
      dependsOn: { field: 'machine_model_type', value: 'new' },
      apiEndpoint: '/machine-categories',
      getOptionLabel: (option) => option.name,
      step: 1
    },
    {
      name: 'machine_serial_number',
      type: 'text',
      label: 'forms.serialNumber',
      placeholder: 'forms.enterSerialNumber',
      required: true,
      dependsOn: { field: 'machine_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_receipt_number',
      type: 'text',
      label: 'forms.receiptNumber',
      placeholder: 'forms.enterReceiptNumber',
      dependsOn: { field: 'machine_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_purchase_date',
      type: 'date',
      label: 'forms.purchaseDate',
      dependsOn: { field: 'machine_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_bought_at',
      type: 'text',
      label: 'forms.boughtAt',
      placeholder: 'forms.enterBoughtAt',
      dependsOn: { field: 'machine_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_description',
      type: 'textarea',
      label: 'forms.machineDescription',
      placeholder: 'forms.enterMachineDescription',
      dependsOn: { field: 'machine_type', value: 'new' },
      step: 1
    },
    {
      name: 'machine_warranty_active',
      type: 'checkbox',
      label: 'forms.warrantyActive',
      default: true,
      dependsOn: { field: 'machine_type', value: 'new' },
      step: 1
    },

    // Step 2: Problem Details
    {
      name: 'problem_description',
      type: 'textarea',
      label: 'forms.problemDescription',
      placeholder: 'forms.enterProblemDescription',
      required: true,
      step: 2
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'forms.notes',
      placeholder: 'forms.enterNotes',
      step: 2
    },
    {
      name: 'additional_equipment',
      type: 'text',
      label: 'forms.additionalEquipment',
      placeholder: 'forms.enterAdditionalEquipment',
      step: 2
    },
    {
      name: 'brought_by',
      type: 'text',
      label: 'forms.broughtBy',
      placeholder: 'forms.enterBroughtBy',
      step: 2
    }
  ],
  validation: {
    customer_name: [VALIDATION_RULES.REQUIRED('forms.customerName')],
    customer_email: [VALIDATION_RULES.REQUIRED('forms.email'), VALIDATION_RULES.EMAIL],
    machine_serial_number: [VALIDATION_RULES.REQUIRED('forms.serialNumber')],
    machine_model_name: [VALIDATION_RULES.REQUIRED('forms.modelName')],
    machine_manufacturer: [VALIDATION_RULES.REQUIRED('forms.manufacturer')],
    problem_description: [VALIDATION_RULES.REQUIRED('forms.problemDescription')]
  }
};

// Helper function to create form configuration
export const createFormConfig = (baseConfig, customizations = {}) => {
  return {
    ...baseConfig,
    ...customizations,
    fields: [
      ...baseConfig.fields,
      ...(customizations.fields || [])
    ]
  };
};

// Helper function to populate select options from API data
export const populateSelectOptions = (config, data, fieldName, valueKey = 'id', labelKey = 'name') => {
  const updatedConfig = { ...config };
  const fieldIndex = updatedConfig.fields.findIndex(f => f.name === fieldName);
  
  if (fieldIndex !== -1) {
    updatedConfig.fields[fieldIndex] = {
      ...updatedConfig.fields[fieldIndex],
      options: data.map(item => ({
        value: item[valueKey],
        label: item[labelKey]
      }))
    };
  }
  
  return updatedConfig;
};

// Export all configurations
export const FORM_CONFIGS = {
  CUSTOMER: CUSTOMER_FORM_CONFIG,
  USER: USER_FORM_CONFIG,
  INVENTORY: INVENTORY_FORM_CONFIG,
  REPAIR_TICKET: REPAIR_TICKET_FORM_CONFIG,
  WARRANTY_REPAIR_TICKET: WARRANTY_REPAIR_TICKET_FORM_CONFIG
};
