const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

// Handle database errors (e.g., invalid IDs)
const handleCastErrorDB = (err) => {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400);
};

// Handle duplicate field errors (e.g., unique email)
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(`Duplicate ${field}: ${err.keyValue[field]}. Use another value!`, 400);
};

// Handle validation errors (e.g., "required" fields)
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  return new AppError(`Invalid input: ${errors.join('. ')}`, 400);
};

// Central error handling middleware
module.exports = (err, req, res, next) => {
  // Log the error first
  logger.error(`${err.statusCode || 500} - ${err.message}${err.stack ? `\n${err.stack}` : ''}`);

  // Set default values if not present
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Transform known database/validation errors
  if (err.name === 'CastError') err = handleCastErrorDB(err);
  if (err.code === 11000) err = handleDuplicateFieldsDB(err);
  if (err.name === 'ValidationError') err = handleValidationErrorDB(err);
  if (err.name === 'JsonWebTokenError') {
    err = new AppError('Invalid token. Please log in again!', 401);
  }
  if (err.name === 'TokenExpiredError') {
    err = new AppError('Token expired. Please log in again!', 401);
  }

  res.status(err.statusCode || 500).json({
    status: 'fail',
    message: err.message || 'Internal server error'
  });
};