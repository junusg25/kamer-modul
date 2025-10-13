const express = require('express');
const router = express.Router();
const db = require('../db');
const { validateIdParam, handleValidationErrors } = require('../middleware/validators');
const { body } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createWorkOrderNotification } = require('../utils/notificationHelpers');
const { createUserAssignmentNotification } = require('../utils/notificationHelpers');
const websocketService = require('../services/websocketService');
const { logCustomAction } = require('../utils/actionLogger');

// Middleware to check warranty work order ownership
const checkWarrantyWorkOrderOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admins and managers can access all warranty work orders
    if (userRole === 'admin' || userRole === 'manager') {
      return next();
    }

    // Check if the warranty work order exists and get ownership info
    const result = await db.query(
      'SELECT owner_technician_id, technician_id FROM warranty_work_orders WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Warranty work order not found' });
    }

    const workOrder = result.rows[0];

    // Technicians can only access warranty work orders they own
    if (workOrder.owner_technician_id !== userId && workOrder.technician_id !== userId) {
      return res.status(403).json({ 
        message: 'Access denied. You can only view warranty work orders assigned to you.' 
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// GET warranty work orders that use a specific inventory item
router.get('/by-inventory/:inventoryId', authenticateToken, async (req, res, next) => {
  try {
    const { inventoryId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get warranty work orders that use this inventory item
    const result = await db.query(`
      SELECT DISTINCT
        wwo.id, 
        wwo.machine_id, 
        wwo.customer_id, 
        wwo.description, 
        wwo.status, 
        wwo.technician_id, 
        wwo.priority,
        wwo.created_at,
        wwo.updated_at,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        ms.serial_number,
        mm.name as machine_name,
        u.name as technician_name,
        wwoi.quantity as quantity_used
      FROM warranty_work_orders wwo
      INNER JOIN warranty_work_order_inventory wwoi ON wwo.id = wwoi.warranty_work_order_id
      LEFT JOIN customers c ON wwo.customer_id = c.id
      LEFT JOIN assigned_machines am ON wwo.machine_id = am.id
      LEFT JOIN machine_serials ms ON am.serial_id = ms.id
      LEFT JOIN machine_models mm ON ms.model_id = mm.id
      LEFT JOIN users u ON wwo.technician_id = u.id
      WHERE wwoi.inventory_id = $1
      ORDER BY wwo.created_at DESC
      LIMIT $2 OFFSET $3
    `, [inventoryId, limit, offset]);

    // Get total count
    const totalResult = await db.query(`
      SELECT COUNT(DISTINCT wwo.id) 
      FROM warranty_work_orders wwo
      INNER JOIN warranty_work_order_inventory wwoi ON wwo.id = wwoi.warranty_work_order_id
      WHERE wwoi.inventory_id = $1
    `, [inventoryId]);

    res.json({
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

// GET all warranty work orders (with pagination and search)
router.get('/', authenticateToken, async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { search, status, priority, technician_id, customer_id, machine_id, year } = req.query;
  
  try {
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (search) {
      // Create fuzzy search patterns for warranty work order numbers
      const searchLower = search.toLowerCase().trim()
      const searchPatterns = []
      
      // Original search pattern
      searchPatterns.push(`%${search}%`)
      
      // Fuzzy patterns for warranty work order numbers
      if (searchLower.match(/^(ww|warranty|work|order)?\s*(\d+)\s*(\/\d+)?\s*$/i)) {
        // Extract numbers from patterns like: ww01, ww 01, ww01/25, warranty 01, work 01, order 01, 01/25, 01, 1
        const numberMatch = searchLower.match(/(\d+)/)
        if (numberMatch) {
          const number = numberMatch[1]
          const paddedNumber = number.padStart(2, '0') // Convert "1" to "01"
          
          // Pattern 1: Exact formatted number (WW-01/25)
          searchPatterns.push(`%WW-${paddedNumber}/25%`)
          searchPatterns.push(`%WW-${paddedNumber}/24%`)
          searchPatterns.push(`%WW-${paddedNumber}/26%`)
          
          // Pattern 2: Without WW prefix (01/25)
          searchPatterns.push(`%${paddedNumber}/25%`)
          searchPatterns.push(`%${paddedNumber}/24%`)
          searchPatterns.push(`%${paddedNumber}/26%`)
          
          // Pattern 3: Just the number (01, 1)
          searchPatterns.push(`%${paddedNumber}%`)
          searchPatterns.push(`%${number}%`)
          
          // Pattern 4: With WW prefix variations (WW01, WW-01)
          searchPatterns.push(`%WW${paddedNumber}%`)
          searchPatterns.push(`%WW-${paddedNumber}%`)
          searchPatterns.push(`%ww${paddedNumber}%`)
          searchPatterns.push(`%ww-${paddedNumber}%`)
        }
      }
      
      // Remove duplicates and create the search condition
      const uniquePatterns = [...new Set(searchPatterns)]
      const searchConditions = []
      
      uniquePatterns.forEach((pattern) => {
        searchConditions.push(`(
          unaccent(wwo.description) ILIKE unaccent($${paramIndex}) OR 
          unaccent(c.name) ILIKE unaccent($${paramIndex}) OR 
          unaccent(mm.name) ILIKE unaccent($${paramIndex}) OR
          unaccent(wwo.formatted_number) ILIKE unaccent($${paramIndex}) OR
          wwo.ticket_number::text ILIKE $${paramIndex}
        )`)
        queryParams.push(pattern)
        paramIndex++
      })
      
      whereConditions.push(`(${searchConditions.join(' OR ')})`)
    }

    if (status) {
      whereConditions.push(`wwo.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (priority) {
      whereConditions.push(`wwo.priority = $${paramIndex}`);
      queryParams.push(priority);
      paramIndex++;
    }

    if (technician_id) {
      whereConditions.push(`wwo.technician_id = $${paramIndex}`);
      queryParams.push(technician_id);
      paramIndex++;
    }

    if (customer_id) {
      whereConditions.push(`wwo.customer_id = $${paramIndex}`);
      queryParams.push(customer_id);
      paramIndex++;
    }

    if (machine_id) {
      whereConditions.push(`wwo.machine_id = $${paramIndex}`);
      queryParams.push(machine_id);
      paramIndex++;
    }

    if (year) {
      whereConditions.push(`wwo.year_created = $${paramIndex}`);
      queryParams.push(parseInt(year));
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await db.query(`
      SELECT wwo.id, wwo.machine_id, wwo.customer_id, wwo.description, wwo.status, wwo.technician_id, wwo.priority, 
             wwo.ticket_number, wwo.formatted_number, wwo.created_at, wwo.updated_at, wwo.started_at, wwo.completed_at,
             wwo.labor_hours, wwo.labor_rate, wwo.troubleshooting_fee, wwo.quote_subtotal_parts, wwo.quote_total,
             wwo.converted_from_ticket_id,
             c.name as customer_name, c.email as customer_email,
             mm.name as machine_name, mm.catalogue_number as catalogue_number, ms.serial_number as serial_number,
             u.name as technician_name
      FROM warranty_work_orders wwo
      LEFT JOIN customers c ON wwo.customer_id = c.id
      LEFT JOIN assigned_machines am ON wwo.machine_id = am.id
      LEFT JOIN machine_serials ms ON am.serial_id = ms.id
      LEFT JOIN machine_models mm ON ms.model_id = mm.id
      LEFT JOIN users u ON wwo.technician_id = u.id
      ${whereClause}
      ORDER BY wwo.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset]);

    const totalResult = await db.query(`
      SELECT COUNT(*) 
      FROM warranty_work_orders wwo
      LEFT JOIN customers c ON wwo.customer_id = c.id
      LEFT JOIN assigned_machines am ON wwo.machine_id = am.id
      LEFT JOIN machine_serials ms ON am.serial_id = ms.id
      LEFT JOIN machine_models mm ON ms.model_id = mm.id
      ${whereClause}
    `, queryParams);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(totalResult.rows[0].count),
        pages: Math.ceil(parseInt(totalResult.rows[0].count) / limit)
      }
    });
  } catch (err) { next(err); }
});

// GET available years (for year filter dropdown)
router.get('/filter/years', authenticateToken, async (req, res, next) => {
  try {
    const query = `
      SELECT DISTINCT year_created 
      FROM warranty_work_orders 
      WHERE year_created IS NOT NULL 
      ORDER BY year_created DESC
    `;
    const result = await db.query(query);
    const years = result.rows.map(row => row.year_created);
    res.json({ data: years });
  } catch (error) {
    next(error);
  }
});

// GET single warranty work order by ID
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT wwo.id, wwo.machine_id, wwo.customer_id, wwo.description, wwo.status, wwo.technician_id, wwo.priority, 
                             wwo.ticket_number, wwo.formatted_number, wwo.updated_at, wwo.created_at, wwo.started_at, wwo.completed_at, 
               wwo.labor_hours, wwo.labor_rate, wwo.quote_subtotal_parts, 
              wwo.quote_total, wwo.troubleshooting_fee, wwo.converted_from_ticket_id, wwo.owner_technician_id,
              c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
              mm.name as machine_name, ms.serial_number as serial_number,
              u.name as technician_name,
              owner.name as owner_technician_name
       FROM warranty_work_orders wwo
       LEFT JOIN customers c ON wwo.customer_id = c.id
       LEFT JOIN assigned_machines am ON wwo.machine_id = am.id
       LEFT JOIN machine_serials ms ON am.serial_id = ms.id
       LEFT JOIN machine_models mm ON ms.model_id = mm.id
       LEFT JOIN users u ON wwo.technician_id = u.id
       LEFT JOIN users owner ON wwo.owner_technician_id = owner.id
       WHERE wwo.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'Warranty work order not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/warrantyWorkOrders/:id/priority
router.patch('/:id/priority', [
  validateIdParam,
  body('priority').isIn(['low', 'medium', 'high']).withMessage('Priority must be low/medium/high'),
  handleValidationErrors
], async (req, res) => {
  const { id } = req.params;
  const { priority } = req.body;

  try {
    const result = await db.query(
      `UPDATE warranty_work_orders 
       SET priority = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [priority, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Warranty work order not found" });
    }

    const workOrder = result.rows[0];

    try {
      await createWorkOrderNotification(workOrder.id, 'priority_changed', 'warranty_work_order', req.user.id);
    } catch {}
    res.json(workOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update priority" });
  }
});

// POST create new warranty work order - DISABLED: Warranty work orders can only be created by converting warranty repair tickets
router.post('/', authenticateToken, async (req, res, next) => {
  return res.status(403).json({
    status: 'fail',
    message: 'Direct warranty work order creation is disabled. Warranty work orders can only be created by converting warranty repair tickets.'
  });
});

// PATCH update warranty work order
router.patch('/:id', authenticateToken, checkWarrantyWorkOrderOwnership, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { description, status, technician_id, priority, labor_hours, labor_rate, troubleshooting_fee, quote_subtotal_parts, quote_total } = req.body;

    // Get current warranty work order to check status changes
    const currentWorkOrder = await db.query(
      'SELECT status, started_at, completed_at, technician_id FROM warranty_work_orders WHERE id = $1',
      [id]
    );

    if (currentWorkOrder.rows.length === 0) {
      return res.status(404).json({ error: "Warranty work order not found" });
    }

    const currentStatus = currentWorkOrder.rows[0].status;
    const currentStartedAt = currentWorkOrder.rows[0].started_at;
    const currentCompletedAt = currentWorkOrder.rows[0].completed_at;
    const currentTechnicianId = currentWorkOrder.rows[0].technician_id;

    const fields = [];
    const values = [];
    let idx = 1;

    if (description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(description);
    }
    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
      
      // Automatically set started_at when status changes to 'in_progress'
      if (status === 'in_progress' && currentStatus !== 'in_progress' && !currentStartedAt) {
        fields.push(`started_at = CURRENT_TIMESTAMP`);
      }
      
      // Revert started_at to NULL when status changes from 'in_progress' back to 'pending'
      if (status === 'pending' && currentStatus === 'in_progress') {
        fields.push(`started_at = NULL`);
      }
      
      // Automatically set completed_at when status changes to 'completed'
      if (status === 'completed' && currentStatus !== 'completed' && !currentCompletedAt) {
        fields.push(`completed_at = CURRENT_TIMESTAMP`);
      }
    }
    if (technician_id !== undefined) {
      fields.push(`technician_id = $${idx++}`);
      values.push(technician_id);
    }
    if (priority !== undefined) {
      fields.push(`priority = $${idx++}`);
      values.push(priority);
    }

    if (labor_hours !== undefined) { fields.push(`labor_hours = $${idx++}`); values.push(labor_hours === '' ? null : Number(labor_hours)); }
    if (labor_rate !== undefined) { fields.push(`labor_rate = $${idx++}`); values.push(labor_rate === '' ? null : Number(labor_rate)); }
    if (troubleshooting_fee !== undefined) { fields.push(`troubleshooting_fee = $${idx++}`); values.push(troubleshooting_fee === '' ? null : Number(troubleshooting_fee)); }
    if (quote_subtotal_parts !== undefined) { fields.push(`quote_subtotal_parts = $${idx++}`); values.push(quote_subtotal_parts === '' ? null : Number(quote_subtotal_parts)); }
    if (quote_total !== undefined) { fields.push(`quote_total = $${idx++}`); values.push(quote_total === '' ? null : Number(quote_total)); }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE warranty_work_orders 
      SET ${fields.join(', ')} 
      WHERE id = $${idx} 
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Warranty work order not found" });
    }

    const workOrder = result.rows[0];

    // Log action
    await logCustomAction(req, 'update', 'warranty_work_order', id, workOrder.formatted_number || `WWO-${id}`, {
      updated_fields: Object.keys(req.body),
      status_change: status !== undefined && status !== currentStatus ? { from: currentStatus, to: status } : null,
      technician_assigned: technician_id !== undefined && technician_id !== currentTechnicianId
    });

    // Create notifications for relevant changes
    try {
      const notifications = [];

      // Notify on status change
      if (status !== undefined && status !== currentStatus) {
        notifications.push(
          createWorkOrderNotification(
            workOrder.id, 
            'status_changed', 
            'warranty_work_order',
            req.user.id,
            { oldStatus: currentStatus, newStatus: status }
          )
        );
        
        // Emit real-time WebSocket update
        await websocketService.emitWorkOrderUpdate(workOrder.id, 'status_changed', {
          oldStatus: currentStatus,
          newStatus: status,
          updatedBy: req.user.id
        });
      }

      // Notify on technician assignment
      if (technician_id !== undefined && technician_id !== currentTechnicianId) {
        if (technician_id) {
          notifications.push(
            createWorkOrderNotification(
              workOrder.id, 
              'assigned', 
              'warranty_work_order',
              req.user.id
            )
          );
          
          // Emit real-time WebSocket update for assignment
          await websocketService.emitWorkOrderUpdate(workOrder.id, 'assigned', {
            technicianId: technician_id,
            assignedBy: req.user.id
          });
        }
      }

      // Notify on general updates
      if (description !== undefined || priority !== undefined) {
        notifications.push(
          createWorkOrderNotification(
            workOrder.id, 
            'updated', 
            'warranty_work_order',
            req.user.id
          )
        );
        
        // Emit real-time WebSocket update for general changes
        await websocketService.emitWorkOrderUpdate(workOrder.id, 'updated', {
          updatedFields: {
            description: description !== undefined,
            priority: priority !== undefined
          },
          updatedBy: req.user.id
        });
      }

      // Wait for all notifications to be created
      await Promise.all(notifications);
    } catch (notificationError) {
      console.error('Error creating notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.json(workOrder);
  } catch (err) {
    next(err);
  }
});

// DELETE warranty work order
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Start a transaction to ensure data consistency
    await db.query('BEGIN');

    // First, get the warranty work order details to check if it was converted from a ticket
    const workOrderResult = await db.query(
      'SELECT id, converted_from_ticket_id, formatted_number, owner_technician_id, technician_id FROM warranty_work_orders WHERE id = $1',
      [id]
    );

    if (!workOrderResult.rows.length) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: "Warranty work order not found" });
    }

    const workOrder = workOrderResult.rows[0];

    // Check ownership: admins and managers can delete any warranty work order, technicians can only delete their own
    if (userRole !== 'admin' && userRole !== 'manager') {
      if (workOrder.owner_technician_id !== userId && workOrder.technician_id !== userId) {
        await db.query('ROLLBACK');
        return res.status(403).json({ 
          error: 'Access denied. You can only delete warranty work orders assigned to you.' 
        });
      }
    }

    // Log action before deletion
    await logCustomAction(req, 'delete', 'warranty_work_order', id, workOrder.formatted_number || `WWO-${id}`, {
      was_converted_from_ticket: !!workOrder.converted_from_ticket_id
    });

    // Delete the warranty work order
    const result = await db.query(
      'DELETE FROM warranty_work_orders WHERE id = $1 RETURNING *',
      [id]
    );

    if (!result.rows.length) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: "Warranty work order not found" });
    }

    // If this warranty work order was converted from a repair ticket, reset the conversion information
    if (workOrder.converted_from_ticket_id) {
      const ticketId = workOrder.converted_from_ticket_id;
      const formattedNumber = workOrder.formatted_number || `#${workOrder.id}`;
      
      await db.query(
        'UPDATE warranty_repair_tickets SET status = $1, converted_to_warranty_work_order_id = NULL, converted_at = NULL WHERE id = $2',
        ['intake', ticketId]
      );
      
      console.log(`Repair ticket #${ticketId} has been reset to intake status after warranty work order ${formattedNumber} was deleted. The ticket can now be converted to a new work order.`);
    }

    // Commit the transaction
    await db.query('COMMIT');

    res.json({ 
      message: "Warranty work order deleted successfully",
      ticket_reset: workOrder.converted_from_ticket_id ? true : false
    });
  } catch (err) {
    await db.query('ROLLBACK');
    next(err);
  }
});

// GET warranty work order notes
router.get('/:id/notes', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT id, content, created_at, updated_at
       FROM warranty_work_order_notes
       WHERE warranty_work_order_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// POST add note to warranty work order
router.post('/:id/notes', authenticateToken, checkWarrantyWorkOrderOwnership, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ error: "Note content is required" });
    }

    const result = await db.query(
      `INSERT INTO warranty_work_order_notes (warranty_work_order_id, content)
       VALUES ($1, $2)
       RETURNING id, content, created_at, updated_at`,
      [id, note.trim()]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// GET warranty work order inventory
router.get('/:id/inventory', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT wwoi.id, wwoi.inventory_id, wwoi.quantity, wwoi.created_at,
              i.name as inventory_name, i.description as inventory_description, i.unit_price,
              (wwoi.quantity * i.unit_price) AS total_price
       FROM warranty_work_order_inventory wwoi
       LEFT JOIN inventory i ON wwoi.inventory_id = i.id
       WHERE wwoi.warranty_work_order_id = $1
       ORDER BY wwoi.created_at DESC`,
      [id]
    );

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// POST add inventory to warranty work order
router.post('/:id/inventory', authenticateToken, checkWarrantyWorkOrderOwnership, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { inventory_id, quantity } = req.body;

    if (!inventory_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: "Valid inventory_id and quantity are required" });
    }

    // Check if inventory item exists
    const inventoryResult = await db.query(
      'SELECT id, unit_price FROM inventory WHERE id = $1',
      [inventory_id]
    );

    if (!inventoryResult.rows.length) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    const result = await db.query(
      `INSERT INTO warranty_work_order_inventory (warranty_work_order_id, inventory_id, quantity)
       VALUES ($1, $2, $3)
       RETURNING id, inventory_id, quantity, created_at`,
      [id, inventory_id, quantity]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// DELETE inventory from warranty work order
router.delete('/:id/inventory/:inventoryId', authenticateToken, checkWarrantyWorkOrderOwnership, async (req, res, next) => {
  try {
    const { id, inventoryId } = req.params;
    
    const result = await db.query(
      `DELETE FROM warranty_work_order_inventory 
       WHERE warranty_work_order_id = $1 AND id = $2
       RETURNING *`,
      [id, inventoryId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Inventory item not found in this warranty work order" });
    }

    res.json({ message: "Inventory item removed successfully" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
