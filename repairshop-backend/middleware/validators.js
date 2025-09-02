const { body, param, validationResult } = require('express-validator');
const AppError = require('../utils/AppError'); // FIXED: direct import

// Shared validation rules
const nameRule = body('name').notEmpty().trim().withMessage('Name is required');
const emailRule = body('email').isEmail().normalizeEmail().withMessage('Invalid email');
const positiveIntRule = (field) => body(field).isInt({ min: 0 }).withMessage(`Must be a positive number`);
const phoneRule = body('phone')
  .optional()
  .isMobilePhone()
  .withMessage('Invalid phone number');
const addressRule = body('address')
  .optional()
  .isLength({ max: 255 })
  .withMessage('Address too long');

// Central error handler for validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map(err => `${err.param}: ${err.msg}`).join(', ');
    throw new AppError(message, 400);
  }
  next();
};

// Reusable validators

exports.requireAtLeastOneField = (body, allowedFields) => {
  const providedFields = Object.keys(body).filter(key => body[key] !== undefined);
  const isValid = providedFields.some(field => allowedFields.includes(field));
  
  return {
    isValid,
    error: isValid ? null : `At least one of these fields is required: ${allowedFields.join(', ')}`
  };
};

// For POST (create new inventory item - strict validation)
exports.validateCreateInventory = [
  nameRule, // name is required
  positiveIntRule('quantity'), // quantity is required and positive
  body('unit_price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  handleValidationErrors
];

// For PATCH (update existing item - optional fields)
exports.validateUpdateInventory = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a positive number'),
  body('unit_price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  handleValidationErrors
];

exports.validateUser = [
  nameRule,
  emailRule,
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  handleValidationErrors
];

exports.validateIdParam = [
  param('id').isInt().withMessage('Invalid ID format'),
  handleValidationErrors
];

// Example: Use in customer validation
exports.validateCustomer = [
  body('name').notEmpty().withMessage('Name is required'),
  phoneRule,
  addressRule,
  handleValidationErrors
];

// More flexible validation (minimum requirements)
exports.validateMachineSerialNumber = [
  body('serial_number')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('Serial number must be between 3-20 characters')
    .trim(),
  handleValidationErrors
];

exports.validatePhone = [
  body('phone')
    .matches(/^\+?\d{10,15}$/)
    .withMessage('Phone must be 10-15 digits with optional +'),
  handleValidationErrors
];

exports.validateWarrantyDate = [
  body('warranty_expiry_date')
    .optional()
    .isDate()
    .withMessage('Invalid date format (YYYY-MM-DD)'),
  handleValidationErrors
];

// Add to validateUpdateInventory or create a new validator
body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority');

// Export handleValidationErrors for direct use in routes
exports.handleValidationErrors = handleValidationErrors;