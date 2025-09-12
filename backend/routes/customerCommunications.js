const express = require('express');
const router = express.Router();
const db = require('../db');
const { validateIdParam, handleValidationErrors } = require('../middleware/validators');
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { createCustomerCommunicationNotification } = require('../utils/notificationHelpers');

// POST /api/customer-communications - Create new communication record
router.post('/', authenticateToken, [
  body('customer_id').isInt().withMessage('Customer ID must be a valid integer'),
  body('type').isIn(['call', 'email', 'note', 'follow_up', 'meeting']).withMessage('Type must be call, email, note, follow_up, or meeting'),
  body('subject').optional().isLength({ max: 200 }).withMessage('Subject must be less than 200 characters'),
  body('content').isLength({ min: 1, max: 2000 }).withMessage('Content must be between 1 and 2000 characters'),
  body('direction').isIn(['inbound', 'outbound']).withMessage('Direction must be inbound or outbound'),
  body('status').optional().isIn(['pending', 'completed', 'scheduled']).withMessage('Status must be pending, completed, or scheduled'),
  body('scheduled_date').optional().isISO8601().withMessage('Scheduled date must be a valid date'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const {
      customer_id,
      type,
      subject,
      content,
      direction,
      status = 'completed',
      scheduled_date
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

    const result = await db.query(
      `INSERT INTO customer_communications 
       (customer_id, type, subject, content, direction, status, scheduled_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, customer_id, type, subject, content, direction, status, scheduled_date, created_at`,
      [customer_id, type, subject, content, direction, status, scheduled_date, req.user.id]
    );

    const communication = result.rows[0];

    // Create notification for customer communication
    try {
      await createCustomerCommunicationNotification(
        customer_id, 
        null, // workOrderId - not applicable for general communications
        customerCheck.rows[0].name, 
        'message'
      );
    } catch (notificationError) {
      console.error('Error creating customer communication notification:', notificationError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      status: 'success',
      data: communication
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customer-communications/customer/:id - Get communications for a customer
router.get('/customer/:id', authenticateToken, validateIdParam, async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { type, direction, status } = req.query;

    let whereConditions = ['cc.customer_id = $1'];
    let queryParams = [id];
    let paramIndex = 2;

    if (type) {
      whereConditions.push(`cc.type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    if (direction) {
      whereConditions.push(`cc.direction = $${paramIndex}`);
      queryParams.push(direction);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`cc.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await db.query(
      `SELECT 
        cc.id, cc.type, cc.subject, cc.content, cc.direction, cc.status, 
        cc.scheduled_date, cc.created_at, cc.updated_at,
        u.name as created_by_name
       FROM customer_communications cc
       LEFT JOIN users u ON cc.created_by = u.id
       WHERE ${whereClause}
       ORDER BY cc.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const totalResult = await db.query(
      `SELECT COUNT(*) FROM customer_communications cc WHERE ${whereClause}`,
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

// GET /api/customer-communications - Get all communications (with filters)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { customer_id, type, direction, status, date_from, date_to } = req.query;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (customer_id) {
      whereConditions.push(`cc.customer_id = $${paramIndex}`);
      queryParams.push(customer_id);
      paramIndex++;
    }

    if (type) {
      whereConditions.push(`cc.type = $${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    if (direction) {
      whereConditions.push(`cc.direction = $${paramIndex}`);
      queryParams.push(direction);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`cc.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (date_from) {
      whereConditions.push(`cc.created_at >= $${paramIndex}`);
      queryParams.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      whereConditions.push(`cc.created_at <= $${paramIndex}`);
      queryParams.push(date_to);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT 
        cc.id, cc.customer_id, cc.type, cc.subject, cc.content, cc.direction, 
        cc.status, cc.scheduled_date, cc.created_at, cc.updated_at,
        c.name as customer_name,
        u.name as created_by_name
       FROM customer_communications cc
       LEFT JOIN customers c ON cc.customer_id = c.id
       LEFT JOIN users u ON cc.created_by = u.id
       ${whereClause}
       ORDER BY cc.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const totalResult = await db.query(
      `SELECT COUNT(*) FROM customer_communications cc
       LEFT JOIN customers c ON cc.customer_id = c.id
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

// GET /api/customer-communications/:id - Get communication by ID
router.get('/:id', authenticateToken, validateIdParam, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        cc.id, cc.customer_id, cc.type, cc.subject, cc.content, cc.direction, 
        cc.status, cc.scheduled_date, cc.created_at, cc.updated_at,
        c.name as customer_name,
        u.name as created_by_name
       FROM customer_communications cc
       LEFT JOIN customers c ON cc.customer_id = c.id
       LEFT JOIN users u ON cc.created_by = u.id
       WHERE cc.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Communication record not found'
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

// PATCH /api/customer-communications/:id - Update communication
router.patch('/:id', authenticateToken, validateIdParam, [
  body('type').optional().isIn(['call', 'email', 'note', 'follow_up', 'meeting']).withMessage('Type must be call, email, note, follow_up, or meeting'),
  body('subject').optional().isLength({ max: 200 }).withMessage('Subject must be less than 200 characters'),
  body('content').optional().isLength({ min: 1, max: 2000 }).withMessage('Content must be between 1 and 2000 characters'),
  body('direction').optional().isIn(['inbound', 'outbound']).withMessage('Direction must be inbound or outbound'),
  body('status').optional().isIn(['pending', 'completed', 'scheduled']).withMessage('Status must be pending, completed, or scheduled'),
  body('scheduled_date').optional().isISO8601().withMessage('Scheduled date must be a valid date'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if communication exists
    const existing = await db.query(
      'SELECT id FROM customer_communications WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Communication record not found'
      });
    }

    // Build update query
    const updateFields = Object.keys(updates).filter(key => 
      ['type', 'subject', 'content', 'direction', 'status', 'scheduled_date'].includes(key)
    );

    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'No valid fields to update'
      });
    }

    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const query = `
      UPDATE customer_communications 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING id, customer_id, type, subject, content, direction, status, scheduled_date, created_at, updated_at
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

// DELETE /api/customer-communications/:id - Delete communication
router.delete('/:id', authenticateToken, validateIdParam, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM customer_communications WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Communication record not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Communication record deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customer-communications/summary/customer/:id - Get communication summary for customer
router.get('/summary/customer/:id', authenticateToken, validateIdParam, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get communication count by type
    const typeResult = await db.query(
      `SELECT type, COUNT(*) as count
       FROM customer_communications 
       WHERE customer_id = $1 
       GROUP BY type`,
      [id]
    );

    // Get recent communications
    const recentResult = await db.query(
      `SELECT id, type, subject, direction, status, created_at
       FROM customer_communications 
       WHERE customer_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [id]
    );

    // Get pending follow-ups
    const pendingResult = await db.query(
      `SELECT id, type, subject, scheduled_date
       FROM customer_communications 
       WHERE customer_id = $1 AND status = 'pending'
       ORDER BY scheduled_date ASC`,
      [id]
    );

    res.json({
      status: 'success',
      data: {
        type_breakdown: typeResult.rows,
        recent_communications: recentResult.rows,
        pending_follow_ups: pendingResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
