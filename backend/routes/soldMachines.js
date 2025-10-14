const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('../utils/notificationHelpers');
const { logCustomAction } = require('../utils/actionLogger');

// GET all assigned machines
router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT * FROM sold_machines_with_details 
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
    let countQuery = `SELECT COUNT(*) FROM sold_machines_with_details WHERE 1=1`;
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
      'SELECT * FROM sold_machines_with_details WHERE customer_id = $1 ORDER BY assigned_at DESC',
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
router.post('/', authenticateToken, async (req, res, next) => {
  const client = await db.connect();
  
  try {
    const { 
      serial_number,
      model_id,
      customer_id, 
      purchase_date, 
      warranty_expiry_date, 
      description,
      sale_price,
      receipt_number,
      machine_condition,
      purchased_at,
      sold_by_user_id,
      added_by_user_id,
      is_sale,
      sale_date
    } = req.body;
    
    // Validation
    if (!serial_number || !customer_id || !model_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Serial number, model ID, and customer ID are required'
      });
    }
    
    await client.query('BEGIN');
    
    // Check if serial number already exists in machine_serials
    let serialCheck = await client.query(
      'SELECT id FROM machine_serials WHERE serial_number = $1',
      [serial_number]
    );
    
    let serialId;
    if (serialCheck.rows.length === 0) {
      // Create new serial number entry with the provided model_id
      const newSerial = await client.query(
        'INSERT INTO machine_serials (serial_number, model_id) VALUES ($1, $2) RETURNING id',
        [serial_number, model_id]
      );
      serialId = newSerial.rows[0].id;
    } else {
      serialId = serialCheck.rows[0].id;
    }
    
    // Check if serial is already assigned
    const assignmentCheck = await client.query(
      'SELECT id FROM sold_machines WHERE serial_id = $1',
      [serialId]
    );
    
    if (assignmentCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        status: 'error',
        message: 'Serial number is already assigned'
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
    
    // Calculate warranty_active based on warranty_expiry_date
    const warrantyActive = warranty_expiry_date ? new Date(warranty_expiry_date) >= new Date() : false;
    
    // Create assignment with all fields
    const assignmentResult = await client.query(
      `INSERT INTO sold_machines (
        serial_id, 
        customer_id, 
        purchase_date, 
        warranty_expiry_date, 
        warranty_active,
        description,
        sale_price,
        receipt_number,
        machine_condition,
        purchased_at,
        sold_by_user_id,
        added_by_user_id,
        is_sale,
        sale_date
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        serialId, 
        customer_id, 
        purchase_date || null, 
        warranty_expiry_date || null, 
        warrantyActive,
        description || null,
        sale_price || null,
        receipt_number || null,
        machine_condition || 'new',
        purchased_at || null,
        sold_by_user_id || null,
        added_by_user_id || null,
        is_sale || false,
        sale_date || purchase_date || null
      ]
    );
    
    await client.query('COMMIT');
    
    // Create notifications for machine assignment/sale
    try {
      const assignedMachine = assignmentResult.rows[0];
      
      // Get machine and customer details for notification
      const detailsQuery = `
        SELECT 
          am.*,
          c.name as customer_name,
          mm.name as model_name,
          mm.manufacturer,
          u.name as seller_name
        FROM sold_machines am
        LEFT JOIN customers c ON am.customer_id = c.id
        LEFT JOIN machine_serials ms ON am.serial_id = ms.id
        LEFT JOIN machine_models mm ON ms.model_id = mm.id
        LEFT JOIN users u ON am.sold_by_user_id = u.id
        WHERE am.id = $1
      `;
      
      const detailsResult = await db.query(detailsQuery, [assignedMachine.id]);
      const details = detailsResult.rows[0];
      
      if (details) {
        // Log action
        await logCustomAction(req, details.is_sale ? 'sell' : 'assign', 'machine', assignedMachine.id, 
          `${details.model_name} - ${serial_number}`, {
          customer_id: customer_id,
          customer_name: details.customer_name,
          model_name: details.model_name,
          manufacturer: details.manufacturer,
          is_sale: details.is_sale,
          sale_price: details.sale_price,
          machine_condition: details.machine_condition
        });

        if (details.is_sale) {
          // Machine sale notification
          const title = 'Machine Sold';
          const message = `${details.model_name} (${details.manufacturer}) has been sold to ${details.customer_name} for ${details.sale_price ? `$${details.sale_price}` : 'undisclosed amount'}`;
          
          // Notify all users except the seller
          const usersQuery = 'SELECT id FROM users WHERE id != $1';
          const usersResult = await db.query(usersQuery, [req.user.id]);
          
          for (const user of usersResult.rows) {
            await createNotification(
              user.id,
              title,
              message,
              'machine',
              'assigned_machine',
              assignedMachine.id
            );
          }
        } else {
          // Machine assignment notification (for repair)
          const title = 'Machine Assigned';
          const message = `${details.model_name} (${details.manufacturer}) has been assigned to ${details.customer_name} for repair`;
          
          // Notify all users except the one who assigned it
          const usersQuery = 'SELECT id FROM users WHERE id != $1';
          const usersResult = await db.query(usersQuery, [req.user.id]);
          
          for (const user of usersResult.rows) {
            await createNotification(
              user.id,
              title,
              message,
              'machine',
              'assigned_machine',
              assignedMachine.id
            );
          }
        }
      }
    } catch (notificationError) {
      console.error('Error creating machine assignment notification:', notificationError);
      // Don't fail the request if notification fails
    }
    
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
    const { 
      purchase_date, 
      warranty_expiry_date, 
      warranty_active,
      description, 
      receipt_number,
      machine_condition,
      sale_price,
      purchased_at
    } = req.body;
    
    const result = await db.query(
      `UPDATE sold_machines 
       SET purchase_date = $1, 
           warranty_expiry_date = $2, 
           warranty_active = $3,
           description = $4, 
           receipt_number = $5,
           machine_condition = $6,
           sale_price = $7,
           purchased_at = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        purchase_date || null, 
        warranty_expiry_date || null, 
        warranty_active !== undefined ? warranty_active : true,
        description || null, 
        receipt_number || null,
        machine_condition || 'new',
        sale_price || null,
        purchased_at || null,
        id
      ]
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

// DELETE permanently delete a machine (includes transaction to delete assignment and serial)
router.delete('/:id', async (req, res, next) => {
  const client = await db.connect();
  
  try {
    const { id } = req.params;
    
    await client.query('BEGIN');
    
    // Get assignment details including serial_id
    const assignmentResult = await client.query(
      `SELECT am.serial_id 
       FROM sold_machines am
       WHERE am.id = $1`,
      [id]
    );
    
    if (assignmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        status: 'error',
        message: 'Machine assignment not found'
      });
    }
    
    // Check for existing work orders, repair tickets, etc.
    const dependenciesResult = await client.query(
      `SELECT 
        (SELECT COUNT(*) FROM repair_tickets WHERE machine_id = $1) as repair_tickets_count,
        (SELECT COUNT(*) FROM warranty_repair_tickets WHERE machine_id = $1) as warranty_repair_tickets_count,
        (SELECT COUNT(*) FROM work_orders WHERE machine_id = $1) as work_orders_count,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE machine_id = $1) as warranty_work_orders_count`,
      [id]
    );
    
    const dependencies = dependenciesResult.rows[0];
    const totalDependencies = parseInt(dependencies.repair_tickets_count) + 
                             parseInt(dependencies.warranty_repair_tickets_count) + 
                             parseInt(dependencies.work_orders_count) + 
                             parseInt(dependencies.warranty_work_orders_count);
    
    if (totalDependencies > 0) {
      await client.query('ROLLBACK');
      
      // Build detailed error message
      const dependencyDetails = [];
      if (parseInt(dependencies.repair_tickets_count) > 0) {
        dependencyDetails.push(`${dependencies.repair_tickets_count} repair ticket(s)`);
      }
      if (parseInt(dependencies.warranty_repair_tickets_count) > 0) {
        dependencyDetails.push(`${dependencies.warranty_repair_tickets_count} warranty repair ticket(s)`);
      }
      if (parseInt(dependencies.work_orders_count) > 0) {
        dependencyDetails.push(`${dependencies.work_orders_count} work order(s)`);
      }
      if (parseInt(dependencies.warranty_work_orders_count) > 0) {
        dependencyDetails.push(`${dependencies.warranty_work_orders_count} warranty work order(s)`);
      }
      
      return res.status(400).json({
        status: 'error',
        message: `Cannot delete machine. It has associated records: ${dependencyDetails.join(', ')}. Please delete or reassign these records first.`
      });
    }
    
    const { serial_id } = assignmentResult.rows[0];
    
    // Delete assignment
    await client.query('DELETE FROM sold_machines WHERE id = $1', [id]);
    
    // Delete machine serial
    await client.query('DELETE FROM machine_serials WHERE id = $1', [serial_id]);
    
    await client.query('COMMIT');
    
    res.json({
      status: 'success',
      message: 'Machine permanently deleted successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET unique purchased_at options
router.get('/purchased-at-options', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT purchased_at 
       FROM sold_machines 
       WHERE purchased_at IS NOT NULL AND purchased_at != ''
       ORDER BY purchased_at`
    );
    
    const options = result.rows.map(row => row.purchased_at);
    
    res.json({
      status: 'success',
      data: options
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
