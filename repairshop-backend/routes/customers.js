const express = require('express');
const router = express.Router();
const db = require('../db');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { createCustomerNotification } = require('../utils/notificationHelpers');
const websocketService = require('../services/websocketService');
const { cacheConfigs, keyGenerators, cacheConditions, invalidateCache } = require('../middleware/cache');

// GET all customers (optional search)
router.get('/', 
  authenticateToken,
  cacheConfigs.short(keyGenerators.search, cacheConditions.success),
  async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = '';
    let params = [];
    
    if (search) {
      const like = `%${search}%`;
      whereClause = `WHERE c.name ILIKE $1 OR COALESCE(c.email,'') ILIKE $1 OR COALESCE(c.phone,'') ILIKE $1 OR COALESCE(c.company_name,'') ILIKE $1 OR COALESCE(c.city,'') ILIKE $1 OR COALESCE(c.vat_number,'') ILIKE $1`;
      params.push(like);
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM customers c
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // Get customers with pagination and sales metrics
    const query = `
      SELECT 
        c.id, c.name, c.phone, c.email, c.address, c.company_name, c.vat_number, 
        c.city, c.postal_code, c.street_address, c.phone2, c.fax, c.created_at, c.updated_at,
        -- Sales metrics
        COUNT(am.id) as total_machines,
        COUNT(CASE WHEN am.is_sale = true THEN 1 END) as machines_purchased,
        COUNT(CASE WHEN am.is_sale = false THEN 1 END) as machines_assigned,
        COALESCE(SUM(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as total_spent,
        COALESCE(AVG(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as avg_purchase_price,
        MAX(am.assigned_at) as last_purchase_date,
        -- Sales person info
        sales_user.name as primary_sales_person
      FROM customers c
      LEFT JOIN assigned_machines am ON c.id = am.customer_id
      LEFT JOIN users sales_user ON am.sold_by_user_id = sales_user.id
      ${whereClause}
      GROUP BY c.id, c.name, c.phone, c.email, c.address, c.company_name, c.vat_number, 
               c.city, c.postal_code, c.street_address, c.phone2, c.fax, c.created_at, c.updated_at,
               sales_user.name
      ORDER BY c.updated_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(parseInt(limit), offset);
    
    const result = await db.query(query, params);
    
    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) { next(err); }
});

// GET customer by id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, name, phone, email, address, company_name, vat_number, city, postal_code, street_address, phone2, fax, created_at, updated_at FROM customers WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'Customer not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) { next(err); }
});

// PATCH update customer
router.patch('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { 
    name, phone, email, address, company_name, vat_number, 
    city, postal_code, street_address, phone2, fax 
  } = req.body;
  try {
    const result = await db.query(
      `UPDATE customers SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        address = COALESCE($4, address),
        company_name = COALESCE($5, company_name),
        vat_number = COALESCE($6, vat_number),
        city = COALESCE($7, city),
        postal_code = COALESCE($8, postal_code),
        street_address = COALESCE($9, street_address),
        phone2 = COALESCE($10, phone2),
        fax = COALESCE($11, fax),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING id, name, phone, email, address, company_name, vat_number, city, postal_code, street_address, phone2, fax, created_at, updated_at`,
      [name, phone, email, address, company_name, vat_number, city, postal_code, street_address, phone2, fax, id]
    );
    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'Customer not found' });
    
    const customer = result.rows[0];

    // Create notification for customer update
    try {
      await createCustomerNotification(customer.id, 'updated', req.user?.id);
      
      // Emit real-time WebSocket update
      await websocketService.emitCustomerUpdate(customer.id, 'updated', {
        updatedBy: req.user?.id
      });
    } catch (notificationError) {
      console.error('Error creating customer update notification:', notificationError);
      // Don't fail the request if notification fails
    }

    res.json({ status: 'success', data: customer });
  } catch (err) { next(err); }
});

// POST create customer
router.post('/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').optional(),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('address').optional(),
    body('company_name').optional(),
    body('vat_number').optional(),
    body('city').optional(),
    body('postal_code').optional(),
    body('street_address').optional(),
    body('phone2').optional(),
    body('fax').optional()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'fail', 
        message: errors.array().map(err => `${err.param}: ${err.msg}`).join(', ')
      });
    }
    try {
      const { 
        name, phone, email, address, company_name, vat_number, 
        city, postal_code, street_address, phone2, fax 
      } = req.body;
      const result = await db.query(
        `INSERT INTO customers (
          name, phone, email, address, company_name, vat_number, 
          city, postal_code, street_address, phone2, fax
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
        RETURNING id, name, phone, email, address, company_name, vat_number, city, postal_code, street_address, phone2, fax, created_at, updated_at`,
        [name, phone, email, address, company_name, vat_number, city, postal_code, street_address, phone2, fax]
      );
      
      const customer = result.rows[0];

      // Create notification for new customer
      try {
        await createCustomerNotification(customer.id, 'created', req.user?.id);
        
        // Emit real-time WebSocket update
        await websocketService.emitCustomerUpdate(customer.id, 'created', {
          createdBy: req.user?.id
        });
      } catch (notificationError) {
        console.error('Error creating customer notification:', notificationError);
        // Don't fail the request if notification fails
      }

      res.status(201).json(customer);
    } catch (err) { 
      if (err.code === '23505') { // Unique constraint violation
        return res.status(400).json({ status: 'fail', message: 'Email already exists' });
      }
      next(err); 
    }
  }
);

// DELETE customer
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const customerId = req.params.id;
    
    // Get customer details before deletion for notification
    const customerQuery = await db.query('SELECT * FROM customers WHERE id = $1', [customerId]);
    if (!customerQuery.rows.length) {
      return res.status(404).json({ status: 'fail', message: 'Customer not found' });
    }
    
    const customer = customerQuery.rows[0];

    // Create notification for customer deletion (before deletion)
    try {
      await createCustomerNotification(customerId, 'deleted', req.user?.id);
      
      // Emit real-time WebSocket update
      await websocketService.emitCustomerUpdate(customerId, 'deleted', {
        deletedBy: req.user?.id
      });
    } catch (notificationError) {
      console.error('Error creating customer deletion notification:', notificationError);
      // Don't fail the request if notification fails
    }

    const result = await db.query('DELETE FROM customers WHERE id = $1 RETURNING id', [customerId]);
    res.json({ status: 'success', message: 'Deleted', id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ status: 'fail', message: 'Cannot delete: customer is referenced by other records' });
    next(err);
  }
});

module.exports = router;
