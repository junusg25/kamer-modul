const express = require('express');
const router = express.Router();
const db = require('../db');
const { validateIdParam, handleValidationErrors } = require('../middleware/validators');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

// POST /api/customer-preferences - Create or update customer preferences
router.post('/', authenticateToken, [
  body('customer_id').isInt().withMessage('Customer ID must be a valid integer'),
  body('preferred_contact_method').optional().isIn(['email', 'phone', 'sms', 'mail']).withMessage('Preferred contact method must be email, phone, sms, or mail'),
  body('preferred_contact_time').optional().isIn(['morning', 'afternoon', 'evening', 'anytime']).withMessage('Preferred contact time must be morning, afternoon, evening, or anytime'),
  body('category').optional().isIn(['vip', 'regular', 'new', 'inactive']).withMessage('Category must be vip, regular, new, or inactive'),
  body('special_requirements').optional().isLength({ max: 500 }).withMessage('Special requirements must be less than 500 characters'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters'),
  body('auto_notifications').optional().isBoolean().withMessage('Auto notifications must be a boolean'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const {
      customer_id,
      preferred_contact_method,
      preferred_contact_time,
      category = 'regular',
      special_requirements,
      notes,
      auto_notifications = true
    } = req.body;

    // Verify customer exists
    const customerCheck = await db.query(
      'SELECT id, name FROM customers WHERE id = $1',
      [customer_id]
    );

    if (customerCheck.rows.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Customer not found'
      });
    }

    // Check if preferences already exist for this customer
    const existingCheck = await db.query(
      'SELECT id FROM customer_preferences WHERE customer_id = $1',
      [customer_id]
    );

    let result;
    if (existingCheck.rows.length > 0) {
      // Update existing preferences
      result = await db.query(
        `UPDATE customer_preferences 
         SET preferred_contact_method = $2, preferred_contact_time = $3, category = $4,
             special_requirements = $5, notes = $6, auto_notifications = $7, updated_at = CURRENT_TIMESTAMP
         WHERE customer_id = $1
         RETURNING id, customer_id, preferred_contact_method, preferred_contact_time, category, 
                   special_requirements, notes, auto_notifications, created_at, updated_at`,
        [customer_id, preferred_contact_method, preferred_contact_time, category, 
         special_requirements, notes, auto_notifications]
      );
    } else {
      // Create new preferences
      result = await db.query(
        `INSERT INTO customer_preferences 
         (customer_id, preferred_contact_method, preferred_contact_time, category, 
          special_requirements, notes, auto_notifications)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, customer_id, preferred_contact_method, preferred_contact_time, category, 
                   special_requirements, notes, auto_notifications, created_at, updated_at`,
        [customer_id, preferred_contact_method, preferred_contact_time, category, 
         special_requirements, notes, auto_notifications]
      );
    }

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customer-preferences/customer/:id - Get customer preferences
router.get('/customer/:id', authenticateToken, validateIdParam, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT cp.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
       FROM customer_preferences cp
       LEFT JOIN customers c ON cp.customer_id = c.id
       WHERE cp.customer_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Customer preferences not found'
      });
    }

    res.json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customer-preferences/:customerId - Get customer preferences (alternative route for tests)
router.get('/:customerId', authenticateToken, async (req, res, next) => {
  try {
    const { customerId } = req.params;

    const result = await db.query(
      `SELECT cp.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
       FROM customer_preferences cp
       LEFT JOIN customers c ON cp.customer_id = c.id
       WHERE cp.customer_id = $1`,
      [customerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Customer preferences not found'
      });
    }

    res.json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customer-preferences - Get all customer preferences (with filters)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { category, preferred_contact_method, auto_notifications } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (category) {
      whereConditions.push(`cp.category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    if (preferred_contact_method) {
      whereConditions.push(`cp.preferred_contact_method = $${paramIndex}`);
      queryParams.push(preferred_contact_method);
      paramIndex++;
    }

    if (auto_notifications !== undefined) {
      whereConditions.push(`cp.auto_notifications = $${paramIndex}`);
      queryParams.push(auto_notifications === 'true');
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT cp.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
       FROM customer_preferences cp
       LEFT JOIN customers c ON cp.customer_id = c.id
       ${whereClause}
       ORDER BY cp.updated_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const totalResult = await db.query(
      `SELECT COUNT(*) FROM customer_preferences cp
       LEFT JOIN customers c ON cp.customer_id = c.id
       ${whereClause}`,
      queryParams
    );

    res.json({
      status: 'success',
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(totalResult.rows[0].count),
        pages: Math.ceil(parseInt(totalResult.rows[0].count) / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/customer-preferences/:id - Update customer preferences
router.patch('/:id', authenticateToken, validateIdParam, [
  body('preferred_contact_method').optional().isIn(['email', 'phone', 'sms', 'mail']).withMessage('Preferred contact method must be email, phone, sms, or mail'),
  body('preferred_contact_time').optional().isIn(['morning', 'afternoon', 'evening', 'anytime']).withMessage('Preferred contact time must be morning, afternoon, evening, or anytime'),
  body('category').optional().isIn(['vip', 'regular', 'new', 'inactive']).withMessage('Category must be vip, regular, new, or inactive'),
  body('special_requirements').optional().isLength({ max: 500 }).withMessage('Special requirements must be less than 500 characters'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters'),
  body('auto_notifications').optional().isBoolean().withMessage('Auto notifications must be a boolean'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if preferences exist
    const existing = await db.query(
      'SELECT id FROM customer_preferences WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Customer preferences not found'
      });
    }

    // Build update query
    const updateFields = Object.keys(updates).filter(key => 
      ['preferred_contact_method', 'preferred_contact_time', 'category', 'special_requirements', 'notes', 'auto_notifications'].includes(key)
    );

    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'No valid fields to update'
      });
    }

    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE customer_preferences 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING id, customer_id, preferred_contact_method, preferred_contact_time, category, 
                special_requirements, notes, auto_notifications, created_at, updated_at
    `;

    const values = [id, ...updateFields.map(field => updates[field])];
    const result = await db.query(query, values);

    res.json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/customer-preferences/:id - Delete customer preferences
router.delete('/:id', authenticateToken, validateIdParam, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM customer_preferences WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Customer preferences not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Customer preferences deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customer-preferences/categories - Get customer categories summary
router.get('/categories', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT category, COUNT(*) as count
       FROM customer_preferences 
       GROUP BY category
       ORDER BY count DESC`
    );

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customer-preferences/vip-customers - Get VIP customers
router.get('/vip-customers', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT cp.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
       FROM customer_preferences cp
       LEFT JOIN customers c ON cp.customer_id = c.id
       WHERE cp.category = 'vip'
       ORDER BY cp.updated_at DESC`
    );

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/customer-preferences/:id/update-category - Update customer category
router.post('/:id/update-category', authenticateToken, validateIdParam, [
  body('category').isIn(['vip', 'regular', 'new', 'inactive']).withMessage('Category must be vip, regular, new, or inactive'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category } = req.body;

    const result = await db.query(
      `UPDATE customer_preferences 
       SET category = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING id, customer_id, category, updated_at`,
      [id, category]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Customer preferences not found'
      });
    }

    res.json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
