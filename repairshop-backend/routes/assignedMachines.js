const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all assigned machines
router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT * FROM assigned_machines_with_details 
      WHERE 1=1
    `;
    const params = [];
    
    if (search) {
      query += ` AND (model_name ILIKE $${params.length + 1} OR serial_number ILIKE $${params.length + 1} OR customer_name ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY assigned_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) FROM assigned_machines_with_details WHERE 1=1`;
    const countParams = [];
    
    if (search) {
      countQuery += ` AND (model_name ILIKE $${countParams.length + 1} OR serial_number ILIKE $${countParams.length + 1} OR customer_name ILIKE $${countParams.length + 1})`;
      countParams.push(`%${search}%`);
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      status: 'success',
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET assigned machines for a specific customer
router.get('/customer/:customerId', async (req, res, next) => {
  try {
    const { customerId } = req.params;
    
    const result = await db.query(
      'SELECT * FROM assigned_machines_with_details WHERE customer_id = $1 ORDER BY assigned_at DESC',
      [customerId]
    );
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// POST assign a serial number to a customer (includes transaction to update serial status)
router.post('/', async (req, res, next) => {
  const client = await db.connect();
  
  try {
    const { serial_id, customer_id, purchase_date, warranty_expiry_date, description } = req.body;
    
    // Validation
    if (!serial_id || !customer_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Serial ID and customer ID are required'
      });
    }
    
    await client.query('BEGIN');
    
    // Check if serial exists and is available
    const serialCheck = await client.query(
      'SELECT id, status FROM machine_serials WHERE id = $1',
      [serial_id]
    );
    
    if (serialCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Serial number not found'
      });
    }
    
    if (serialCheck.rows[0].status !== 'available') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'Serial number is not available for assignment'
      });
    }
    
    // Check if customer exists
    const customerCheck = await client.query(
      'SELECT id FROM customers WHERE id = $1',
      [customer_id]
    );
    
    if (customerCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found'
      });
    }
    
    // Create assignment
    const assignmentResult = await client.query(
      `INSERT INTO assigned_machines (serial_id, customer_id, purchase_date, warranty_expiry_date, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [serial_id, customer_id, purchase_date || null, warranty_expiry_date || null, description || null]
    );
    
    // Update serial status to assigned
    await client.query(
      'UPDATE machine_serials SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['assigned', serial_id]
    );
    
    await client.query('COMMIT');
    
    res.status(201).json({
      status: 'success',
      data: assignmentResult.rows[0],
      message: 'Machine assigned successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PUT update assignment
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { purchase_date, warranty_expiry_date, description } = req.body;
    
    const result = await db.query(
      `UPDATE assigned_machines 
       SET purchase_date = $1, warranty_expiry_date = $2, description = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [purchase_date || null, warranty_expiry_date || null, description || null, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Assignment not found'
      });
    }
    
    res.json({
      status: 'success',
      data: result.rows[0],
      message: 'Assignment updated successfully'
    });
  } catch (err) {
    next(err);
  }
});

// DELETE unassign a machine (includes transaction to update serial status)
router.delete('/:id', async (req, res, next) => {
  const client = await db.connect();
  
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    // Get assignment details
    const assignmentResult = await client.query(
      'SELECT serial_id FROM assigned_machines WHERE id = $1',
      [id]
    );
    
    if (assignmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Assignment not found'
      });
    }
    
    const serialId = assignmentResult.rows[0].serial_id;
    
    // Delete assignment
    await client.query('DELETE FROM assigned_machines WHERE id = $1', [id]);
    
    // Update serial status to available
    await client.query(
      'UPDATE machine_serials SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['available', serialId]
    );
    
    await client.query('COMMIT');
    
    res.json({
      status: 'success',
      message: 'Machine unassigned successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
