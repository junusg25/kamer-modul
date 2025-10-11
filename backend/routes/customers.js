const express = require('express');
const router = express.Router();
const db = require('../db');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { createCustomerNotification } = require('../utils/notificationHelpers');
const websocketService = require('../services/websocketService');
const { cacheConfigs, keyGenerators, cacheConditions, invalidateCache } = require('../middleware/cache');
const { logCustomAction } = require('../utils/actionLogger');

// GET all customers (optional search)
router.get('/', 
  authenticateToken,
  cacheConfigs.short(keyGenerators.search, cacheConditions.success),
  async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20, status, owner_assigned, owner_name, customer_type } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    if (search) {
      const like = `%${search}%`;
      whereConditions.push(`(c.name ILIKE $${paramIndex} OR COALESCE(c.email,'') ILIKE $${paramIndex} OR COALESCE(c.phone,'') ILIKE $${paramIndex} OR COALESCE(c.company_name,'') ILIKE $${paramIndex} OR COALESCE(c.city,'') ILIKE $${paramIndex} OR COALESCE(c.vat_number,'') ILIKE $${paramIndex})`);
      params.push(like);
      paramIndex++;
    }
    
    if (status) {
      whereConditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    if (owner_assigned !== undefined) {
      if (owner_assigned === 'true') {
        whereConditions.push(`c.owner_id IS NOT NULL`);
      } else if (owner_assigned === 'false') {
        whereConditions.push(`c.owner_id IS NULL`);
      }
    }
    
    if (owner_name) {
      whereConditions.push(`u.name = $${paramIndex}`);
      params.push(owner_name);
      paramIndex++;
    }
    
    if (customer_type) {
      whereConditions.push(`c.customer_type = $${paramIndex}`);
      params.push(customer_type);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM customers c
      LEFT JOIN users u ON c.owner_id = u.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // Get customers with pagination and sales metrics
    const query = `
      SELECT 
        c.id, c.name, c.phone, c.email, c.company_name, c.vat_number, 
        c.city, c.postal_code, c.street_address, c.phone2, c.fax, c.owner_id, c.assigned_at, c.ownership_notes, c.status, c.created_at, c.updated_at,
        c.customer_type, c.contact_person,
        u.name as owner_name,
        -- Sales metrics
        COUNT(am.id) as total_machines,
        COUNT(CASE WHEN am.is_sale = true THEN 1 END) as machines_purchased,
        COUNT(CASE WHEN am.is_sale = false THEN 1 END) as machines_assigned,
        COALESCE(SUM(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as total_spent,
        COALESCE(AVG(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as avg_purchase_price,
        MAX(am.assigned_at) as last_purchase_date,
        -- Sales person info (get the most recent sales person)
        (SELECT u2.name FROM users u2 
         JOIN assigned_machines am2 ON u2.id = am2.sold_by_user_id 
         WHERE am2.customer_id = c.id AND am2.is_sale = true 
         ORDER BY am2.assigned_at DESC LIMIT 1) as primary_sales_person
      FROM customers c
      LEFT JOIN users u ON c.owner_id = u.id
      LEFT JOIN assigned_machines am ON c.id = am.customer_id
      ${whereClause}
      GROUP BY c.id, c.name, c.phone, c.email, c.company_name, c.vat_number, 
               c.city, c.postal_code, c.street_address, c.phone2, c.fax, c.owner_id, c.assigned_at, c.ownership_notes, c.status, c.created_at, c.updated_at, u.name
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
    const result = await db.query(`
      SELECT 
        c.id, c.name, c.phone, c.email, c.company_name, c.vat_number, 
        c.city, c.postal_code, c.street_address, c.phone2, c.fax, c.owner_id, c.assigned_at, c.ownership_notes, c.status, c.created_at, c.updated_at,
        c.customer_type, c.contact_person,
        u.name as owner_name
      FROM customers c
      LEFT JOIN users u ON c.owner_id = u.id
      WHERE c.id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'Customer not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) { next(err); }
});

// PATCH update customer
router.patch('/:id', authenticateToken, async (req, res, next) => {
  const { id } = req.params;
  const { 
    name, phone, email, company_name, vat_number, 
    city, postal_code, street_address, phone2, fax, status,
    customer_type, contact_person, owner_id, ownership_notes
  } = req.body;
  try {
    const result = await db.query(
      `UPDATE customers SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        email = COALESCE($3, email),
        company_name = COALESCE($4, company_name),
        vat_number = COALESCE($5, vat_number),
        city = COALESCE($6, city),
        postal_code = COALESCE($7, postal_code),
        street_address = COALESCE($8, street_address),
        phone2 = COALESCE($9, phone2),
        fax = COALESCE($10, fax),
        status = COALESCE($11, status),
        customer_type = COALESCE($12, customer_type),
        contact_person = COALESCE($13, contact_person),
        owner_id = COALESCE($14, owner_id),
        ownership_notes = COALESCE($15, ownership_notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $16
      RETURNING id, name, phone, email, company_name, vat_number, city, postal_code, street_address, phone2, fax, status, customer_type, contact_person, owner_id, ownership_notes, created_at, updated_at`,
      [name, phone, email, company_name, vat_number, city, postal_code, street_address, phone2, fax, status, customer_type, contact_person, owner_id, ownership_notes, id]
    );
    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'Customer not found' });
    
    const customer = result.rows[0];

    // Log action
    await logCustomAction(req, 'update', 'customer', customerId, customer.name, {
      updated_fields: Object.keys(req.body)
    });

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
    body('company_name').optional(),
    body('vat_number').optional(),
    body('city').optional(),
    body('postal_code').optional(),
    body('street_address').optional(),
    body('phone2').optional(),
    body('fax').optional(),
    body('owner_id').optional().isInt().withMessage('Owner ID must be an integer'),
    body('ownership_notes').optional(),
    body('status').optional().isIn(['active', 'inactive', 'pending']).withMessage('Status must be active, inactive, or pending'),
    body('customer_type').optional().isIn(['private', 'company']).withMessage('Customer type must be private or company'),
    body('contact_person').optional()
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
      console.log('Received customer creation request:', req.body);
      const { 
        name, phone, email, company_name, vat_number, 
        city, postal_code, street_address, phone2, fax, owner_id, ownership_notes, status,
        customer_type, contact_person
      } = req.body;
      console.log('Extracted fields - customer_type:', customer_type, 'contact_person:', contact_person);
      const result = await db.query(
        `INSERT INTO customers (
          name, phone, email, company_name, vat_number, 
          city, postal_code, street_address, phone2, fax, owner_id, ownership_notes, status,
          customer_type, contact_person
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
        RETURNING id, name, phone, email, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, ownership_notes, status, customer_type, contact_person, created_at, updated_at`,
        [name, phone, email, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, ownership_notes, status || 'active', customer_type || 'private', contact_person]
      );
      
      const customer = result.rows[0];

      // Log action
      await logCustomAction(req, 'create', 'customer', customer.id, customer.name, {
        customer_type: customer.customer_type,
        company_name: customer.company_name
      });

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

    // Check if customer has assigned machines
    const machinesQuery = await db.query(
      'SELECT COUNT(*) as machine_count FROM assigned_machines WHERE customer_id = $1',
      [customerId]
    );
    const machineCount = parseInt(machinesQuery.rows[0].machine_count);
    
    if (machineCount > 0) {
      return res.status(409).json({ 
        status: 'fail', 
        message: `Cannot delete customer: ${customer.name} has ${machineCount} machine(s) assigned. Please reassign or remove the machines first.`,
        machine_count: machineCount
      });
    }

    // Check if customer has any related records that would prevent deletion
    const repairTicketsQuery = await db.query(
      'SELECT COUNT(*) as ticket_count FROM repair_tickets WHERE customer_id = $1',
      [customerId]
    );
    const repairTicketCount = parseInt(repairTicketsQuery.rows[0].ticket_count);
    
    const warrantyTicketsQuery = await db.query(
      'SELECT COUNT(*) as ticket_count FROM warranty_repair_tickets WHERE customer_id = $1',
      [customerId]
    );
    const warrantyTicketCount = parseInt(warrantyTicketsQuery.rows[0].ticket_count);
    
    if (repairTicketCount > 0 || warrantyTicketCount > 0) {
      const totalTickets = repairTicketCount + warrantyTicketCount;
      return res.status(409).json({ 
        status: 'fail', 
        message: `Cannot delete customer: ${customer.name} has ${totalTickets} repair ticket(s) associated. Please resolve or delete the tickets first.`,
        ticket_count: totalTickets
      });
    }

    // Log action before deletion
    await logCustomAction(req, 'delete', 'customer', customerId, customer.name, {
      customer_type: customer.customer_type,
      company_name: customer.company_name
    });

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
