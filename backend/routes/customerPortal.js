const express = require('express');
const router = express.Router();
const db = require('../db');
const { handleValidationErrors } = require('../middleware/validators');
const { body, param } = require('express-validator');

// GET /api/customer-portal/status/:customer_id - Get customer's work order status
router.get('/status/:customer_id', [
  param('customer_id').isInt().withMessage('Invalid customer ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { customer_id } = req.params;

    // Verify customer exists
    const customerCheck = await db.query(
      'SELECT id, name, email, phone FROM customers WHERE id = $1',
      [customer_id]
    );

    if (customerCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Customer not found'
      });
    }

    // Get customer's work orders with status
    const workOrdersResult = await db.query(
      `SELECT 
        wo.id,
        wo.description,
        wo.status,
        wo.priority,
        wo.created_at,
        m.name as machine_name,
        m.serial_number,
        u.name as technician_name
       FROM work_orders wo
       LEFT JOIN machines m ON wo.machine_id = m.id
       LEFT JOIN users u ON wo.technician_id = u.id
       WHERE wo.customer_id = $1
       ORDER BY wo.created_at DESC`,
      [customer_id]
    );

    // Get customer preferences
    const preferencesResult = await db.query(
      'SELECT * FROM customer_preferences WHERE customer_id = $1',
      [customer_id]
    );

    // Get recent communications
    const communicationsResult = await db.query(
      `SELECT 
        cc.id,
        cc.type,
        cc.subject,
        cc.content,
        cc.direction,
        cc.status,
        cc.created_at
       FROM customer_communications cc
       WHERE cc.customer_id = $1
       ORDER BY cc.created_at DESC
       LIMIT 5`,
      [customer_id]
    );

    res.json({
      status: 'success',
      data: {
        customer: customerCheck.rows[0],
        work_orders: workOrdersResult.rows,
        preferences: preferencesResult.rows[0] || null,
        recent_communications: communicationsResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customer-portal/work-orders/:customer_id - Get detailed work orders
router.get('/work-orders/:customer_id', [
  param('customer_id').isInt().withMessage('Invalid customer ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { customer_id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { status, priority } = req.query;

    // Verify customer exists
    const customerCheck = await db.query(
      'SELECT id, name FROM customers WHERE id = $1',
      [customer_id]
    );

    if (customerCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Customer not found'
      });
    }

    let whereConditions = ['wo.customer_id = $1'];
    let queryParams = [customer_id];
    let paramIndex = 2;

    if (status) {
      whereConditions.push(`wo.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (priority) {
      whereConditions.push(`wo.priority = $${paramIndex}`);
      queryParams.push(priority);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const result = await db.query(
      `SELECT 
        wo.id,
        wo.description,
        wo.status,
        wo.priority,
        wo.created_at,
        m.name as machine_name,
        m.serial_number,
        m.description as machine_description,
        u.name as technician_name,
        u.email as technician_email
       FROM work_orders wo
       LEFT JOIN machines m ON wo.machine_id = m.id
       LEFT JOIN users u ON wo.technician_id = u.id
       ${whereClause}
       ORDER BY wo.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const totalResult = await db.query(
      `SELECT COUNT(*) FROM work_orders wo ${whereClause}`,
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

// GET /api/customer-portal/work-order/:id - Get specific work order details
router.get('/work-order/:id', [
  param('id').isInt().withMessage('Invalid work order ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        wo.*,
        m.name as machine_name,
        m.serial_number,
        m.description as machine_description,
        u.name as technician_name,
        u.email as technician_email,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
       FROM work_orders wo
       LEFT JOIN machines m ON wo.machine_id = m.id
       LEFT JOIN users u ON wo.technician_id = u.id
       LEFT JOIN customers c ON wo.customer_id = c.id
       WHERE wo.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Work order not found'
      });
    }

    // Get work order notes
    const notesResult = await db.query(
      'SELECT * FROM work_order_notes WHERE work_order_id = $1 ORDER BY created_at DESC',
      [id]
    );

    // Get work order attachments
    const attachmentsResult = await db.query(
      'SELECT id, filename, original_name, description, created_at FROM work_order_attachments WHERE work_order_id = $1 ORDER BY created_at DESC',
      [id]
    );

    // Get time entries
    const timeEntriesResult = await db.query(
      `SELECT 
        wote.*,
        u.name as technician_name
       FROM work_order_time_entries wote
       LEFT JOIN users u ON wote.technician_id = u.id
       WHERE wote.work_order_id = $1
       ORDER BY wote.start_time DESC`,
      [id]
    );

    res.json({
      status: 'success',
      data: {
        work_order: result.rows[0],
        notes: notesResult.rows,
        attachments: attachmentsResult.rows,
        time_entries: timeEntriesResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/customer-portal/contact - Customer sends message to repair shop
router.post('/contact', [
  body('customer_id').isInt().withMessage('Customer ID must be a valid integer'),
  body('subject').isLength({ min: 1, max: 200 }).withMessage('Subject must be between 1 and 200 characters'),
  body('message').isLength({ min: 1, max: 2000 }).withMessage('Message must be between 1 and 2000 characters'),
  body('contact_method').optional().isIn(['email', 'phone', 'portal']).withMessage('Contact method must be email, phone, or portal'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const {
      customer_id,
      subject,
      message,
      contact_method = 'portal'
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

    // Create communication record
    const result = await db.query(
      `INSERT INTO customer_communications 
       (customer_id, type, subject, content, direction, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, customer_id, type, subject, content, direction, status, created_at`,
      [customer_id, 'note', subject, message, 'inbound', 'pending']
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0],
      message: 'Your message has been sent successfully. We will respond within 24 hours.'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customer-portal/communications/:customer_id - Get customer communications
router.get('/communications/:customer_id', [
  param('customer_id').isInt().withMessage('Invalid customer ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { customer_id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Verify customer exists
    const customerCheck = await db.query(
      'SELECT id, name FROM customers WHERE id = $1',
      [customer_id]
    );

    if (customerCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Customer not found'
      });
    }

    const result = await db.query(
      `SELECT 
        cc.id,
        cc.type,
        cc.subject,
        cc.content,
        cc.direction,
        cc.status,
        cc.created_at,
        u.name as staff_name
       FROM customer_communications cc
       LEFT JOIN users u ON cc.created_by = u.id
       WHERE cc.customer_id = $1
       ORDER BY cc.created_at DESC
       LIMIT $2 OFFSET $3`,
      [customer_id, limit, offset]
    );

    // Get total count
    const totalResult = await db.query(
      'SELECT COUNT(*) FROM customer_communications WHERE customer_id = $1',
      [customer_id]
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

// GET /api/customer-portal/machines/:customer_id - Get customer's machines
router.get('/machines/:customer_id', [
  param('customer_id').isInt().withMessage('Invalid customer ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { customer_id } = req.params;

    // Verify customer exists
    const customerCheck = await db.query(
      'SELECT id, name FROM customers WHERE id = $1',
      [customer_id]
    );

    if (customerCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Customer not found'
      });
    }

    const result = await db.query(
      `SELECT 
        m.*,
        COUNT(wo.id) as work_order_count,
        MAX(wo.created_at) as last_service_date
       FROM machines m
       LEFT JOIN work_orders wo ON m.id = wo.machine_id
       WHERE m.customer_id = $1
       GROUP BY m.id
       ORDER BY m.created_at DESC`,
      [customer_id]
    );

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customer-portal/dashboard/:customer_id - Get customer dashboard summary
router.get('/dashboard/:customer_id', [
  param('customer_id').isInt().withMessage('Invalid customer ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { customer_id } = req.params;

    // Verify customer exists
    const customerCheck = await db.query(
      'SELECT id, name FROM customers WHERE id = $1',
      [customer_id]
    );

    if (customerCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Customer not found'
      });
    }

    // Get work order statistics
    const workOrderStats = await db.query(
      `SELECT 
        status,
        COUNT(*) as count
       FROM work_orders 
       WHERE customer_id = $1
       GROUP BY status`,
      [customer_id]
    );

    // Get recent activity
    const recentActivity = await db.query(
      `SELECT 
        'work_order' as type,
        wo.id,
        wo.description,
        wo.status,
        wo.created_at,
        m.name as machine_name
       FROM work_orders wo
       LEFT JOIN machines m ON wo.machine_id = m.id
       WHERE wo.customer_id = $1
       
       UNION ALL
       
       SELECT 
        'communication' as type,
        cc.id,
        cc.subject as description,
        cc.status,
        cc.created_at,
        NULL as machine_name
       FROM customer_communications cc
       WHERE cc.customer_id = $1
       
       ORDER BY created_at DESC
       LIMIT 10`,
      [customer_id]
    );

    // Get upcoming services (work orders with estimated completion dates)
    const upcomingServices = await db.query(
      `SELECT 
        wo.id,
        wo.description,
        wo.status,
        wo.priority,
        wo.created_at,
        m.name as machine_name
       FROM work_orders wo
       LEFT JOIN machines m ON wo.machine_id = m.id
       WHERE wo.customer_id = $1 
       AND wo.status IN ('pending', 'in_progress')
       ORDER BY wo.priority DESC, wo.created_at ASC
       LIMIT 5`,
      [customer_id]
    );

    res.json({
      status: 'success',
      data: {
        work_order_stats: workOrderStats.rows,
        recent_activity: recentActivity.rows,
        upcoming_services: upcomingServices.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/customer-portal/request-update/:work_order_id - Request status update
router.post('/request-update/:work_order_id', [
  param('work_order_id').isInt().withMessage('Invalid work order ID format'),
  body('customer_id').isInt().withMessage('Customer ID must be a valid integer'),
  body('message').optional().isLength({ max: 1000 }).withMessage('Message must be less than 1000 characters'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { work_order_id } = req.params;
    const { customer_id, message = 'Please provide an update on this work order.' } = req.body;

    // Verify work order belongs to customer
    const workOrderCheck = await db.query(
      'SELECT id, customer_id, description, formatted_number FROM work_orders WHERE id = $1 AND customer_id = $2',
      [work_order_id, customer_id]
    );

    if (workOrderCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Work order not found or does not belong to this customer'
      });
    }

    const workOrder = workOrderCheck.rows[0];
    const workOrderNumber = workOrder.formatted_number || `#${work_order_id}`;

    // Create communication record for status update request
    const result = await db.query(
      `INSERT INTO customer_communications 
       (customer_id, type, subject, content, direction, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, customer_id, type, subject, content, direction, status, created_at`,
      [
        customer_id,
        'follow_up',
        `Status Update Request - Work Order ${workOrderNumber}`,
        `Customer requested update for work order: ${workOrder.description}\n\nCustomer message: ${message}`,
        'inbound',
        'pending'
      ]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0],
      message: 'Your status update request has been sent. We will respond shortly.'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
