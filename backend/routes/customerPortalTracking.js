const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateCustomer } = require('./customerPortalAuth');

// Track item by number (guest tracking - no auth required)
router.post('/track', async (req, res, next) => {
  try {
    const { tracking_number, email } = req.body;

    // Validation
    if (!tracking_number || !email) {
      return res.status(400).json({
        status: 'fail',
        message: 'Tracking number and email are required'
      });
    }

    // Determine type based on prefix
    let type = null;
    let query = null;
    let relatedQuery = null;

    if (tracking_number.startsWith('TK-')) {
      type = 'repair_ticket';
      // Get repair ticket
      query = `
        SELECT 
          rt.id, rt.formatted_number as tracking_number, rt.ticket_number,
          rt.status, rt.priority, rt.problem_description,
          rt.created_at, rt.updated_at,
          rt.converted_to_work_order_id,
          c.name as customer_name, c.email as customer_email, c.phone as customer_phone
        FROM repair_tickets rt
        JOIN customers c ON rt.customer_id = c.id
        WHERE rt.formatted_number = $1 
          AND LOWER(c.email) = LOWER($2)
      `;
      // Get related work order if converted
      relatedQuery = `
        SELECT 
          wo.id, wo.formatted_number as tracking_number,
          wo.status, wo.priority, wo.completed_at,
          wo.total_cost, wo.labor_hours, wo.description,
          u.name as technician_name
        FROM work_orders wo
        LEFT JOIN users u ON wo.owner_technician_id = u.id
        WHERE wo.id = $1
      `;
    } else if (tracking_number.startsWith('WT-')) {
      type = 'warranty_ticket';
      query = `
        SELECT 
          wrt.id, wrt.formatted_number as tracking_number, wrt.ticket_number,
          wrt.status, wrt.priority, wrt.problem_description,
          wrt.created_at, wrt.updated_at,
          wrt.converted_to_warranty_work_order_id,
          c.name as customer_name, c.email as customer_email, c.phone as customer_phone
        FROM warranty_repair_tickets wrt
        JOIN customers c ON wrt.customer_id = c.id
        WHERE wrt.formatted_number = $1 
          AND LOWER(c.email) = LOWER($2)
      `;
      relatedQuery = `
        SELECT 
          wwo.id, wwo.formatted_number as tracking_number,
          wwo.status, wwo.priority, wwo.completed_at,
          wwo.labor_hours, wwo.description,
          u.name as technician_name
        FROM warranty_work_orders wwo
        LEFT JOIN users u ON wwo.owner_technician_id = u.id
        WHERE wwo.id = $1
      `;
    } else if (tracking_number.startsWith('WO-')) {
      type = 'work_order';
      query = `
        SELECT 
          wo.id, wo.formatted_number as tracking_number, wo.ticket_number,
          wo.status, wo.priority, wo.completed_at, wo.description,
          wo.total_cost, wo.labor_hours, wo.created_at, wo.updated_at,
          c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
          u.name as technician_name
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.id
        LEFT JOIN users u ON wo.owner_technician_id = u.id
        WHERE wo.formatted_number = $1 
          AND LOWER(c.email) = LOWER($2)
      `;
      // Get original ticket
      relatedQuery = `
        SELECT 
          rt.id, rt.formatted_number as tracking_number,
          rt.status, rt.priority, rt.problem_description,
          rt.created_at
        FROM repair_tickets rt
        WHERE rt.ticket_number = $1
      `;
    } else if (tracking_number.startsWith('WW-')) {
      type = 'warranty_work_order';
      query = `
        SELECT 
          wwo.id, wwo.formatted_number as tracking_number, wwo.ticket_number,
          wwo.status, wwo.priority, wwo.completed_at, wwo.description,
          wwo.labor_hours, wwo.created_at, wwo.updated_at,
          c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
          u.name as technician_name
        FROM warranty_work_orders wwo
        JOIN customers c ON wwo.customer_id = c.id
        LEFT JOIN users u ON wwo.owner_technician_id = u.id
        WHERE wwo.formatted_number = $1 
          AND LOWER(c.email) = LOWER($2)
      `;
      relatedQuery = `
        SELECT 
          wrt.id, wrt.formatted_number as tracking_number,
          wrt.status, wrt.priority, wrt.problem_description,
          wrt.created_at
        FROM warranty_repair_tickets wrt
        WHERE wrt.ticket_number = $1
      `;
    } else if (tracking_number.startsWith('QT-')) {
      type = 'quote';
      query = `
        SELECT 
          q.id, q.formatted_number as tracking_number,
          q.status, q.title, q.total_amount, q.valid_until,
          q.created_at, q.accepted_at, q.rejected_at,
          c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
          u.name as created_by_name
        FROM quotes q
        JOIN customers c ON q.customer_id = c.id
        LEFT JOIN users u ON q.created_by = u.id
        WHERE q.formatted_number = $1 
          AND LOWER(c.email) = LOWER($2)
      `;
    } else {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid tracking number format'
      });
    }

    // Execute main query
    const result = await db.query(query, [tracking_number, email]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'No item found with this tracking number and email combination'
      });
    }

    const item = result.rows[0];
    let relatedItem = null;

    // Get related item if applicable
    if (type === 'repair_ticket' && item.converted_to_work_order_id) {
      const relatedResult = await db.query(relatedQuery, [item.converted_to_work_order_id]);
      if (relatedResult.rows.length > 0) {
        relatedItem = { ...relatedResult.rows[0], type: 'work_order' };
      }
    } else if (type === 'warranty_ticket' && item.converted_to_warranty_work_order_id) {
      const relatedResult = await db.query(relatedQuery, [item.converted_to_warranty_work_order_id]);
      if (relatedResult.rows.length > 0) {
        relatedItem = { ...relatedResult.rows[0], type: 'warranty_work_order' };
      }
    } else if ((type === 'work_order' || type === 'warranty_work_order') && item.ticket_number) {
      const relatedResult = await db.query(relatedQuery, [item.ticket_number]);
      if (relatedResult.rows.length > 0) {
        relatedItem = { 
          ...relatedResult.rows[0], 
          type: type === 'work_order' ? 'repair_ticket' : 'warranty_ticket' 
        };
      }
    }

    // Log tracking activity (guest)
    await db.query(
      `INSERT INTO customer_portal_activity 
       (action, entity_type, entity_id, tracking_number, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'guest_track',
        type,
        item.id,
        tracking_number,
        req.ip,
        req.get('user-agent')
      ]
    );

    res.json({
      status: 'success',
      data: {
        type,
        item,
        related: relatedItem
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get all items for authenticated customer
router.get('/my-items', authenticateCustomer, async (req, res, next) => {
  try {
    const customerId = req.customerUser.customerId;

    // Get all repair tickets
    const repairTickets = await db.query(
      `SELECT 
        id, formatted_number, ticket_number, status, priority,
        problem_description, created_at, converted_to_work_order_id
       FROM repair_tickets
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customerId]
    );

    // Get all warranty repair tickets
    const warrantyTickets = await db.query(
      `SELECT 
        id, formatted_number, ticket_number, status, priority,
        problem_description, created_at, converted_to_warranty_work_order_id
       FROM warranty_repair_tickets
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customerId]
    );

    // Get all work orders
    const workOrders = await db.query(
      `SELECT 
        wo.id, wo.formatted_number, wo.ticket_number, wo.status, wo.priority,
        wo.total_cost, wo.completed_at, wo.created_at,
        u.name as technician_name
       FROM work_orders wo
       LEFT JOIN users u ON wo.owner_technician_id = u.id
       WHERE wo.customer_id = $1
       ORDER BY wo.created_at DESC`,
      [customerId]
    );

    // Get all warranty work orders
    const warrantyWorkOrders = await db.query(
      `SELECT 
        wwo.id, wwo.formatted_number, wwo.ticket_number, wwo.status, wwo.priority,
        wwo.completed_at, wwo.created_at,
        u.name as technician_name
       FROM warranty_work_orders wwo
       LEFT JOIN users u ON wwo.owner_technician_id = u.id
       WHERE wwo.customer_id = $1
       ORDER BY wwo.created_at DESC`,
      [customerId]
    );

    // Get all quotes
    const quotes = await db.query(
      `SELECT 
        q.id, q.formatted_number, q.status, q.title, q.total_amount,
        q.valid_until, q.created_at, q.accepted_at,
        u.name as created_by_name
       FROM quotes q
       LEFT JOIN users u ON q.created_by = u.id
       WHERE q.customer_id = $1
       ORDER BY q.created_at DESC`,
      [customerId]
    );

    // Log activity
    await db.query(
      `INSERT INTO customer_portal_activity 
       (customer_id, portal_user_id, action, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        customerId,
        req.customerUser.id,
        'view_dashboard',
        req.ip,
        req.get('user-agent')
      ]
    );

    res.json({
      status: 'success',
      data: {
        repair_tickets: repairTickets.rows.map(item => ({ ...item, type: 'repair_ticket' })),
        warranty_tickets: warrantyTickets.rows.map(item => ({ ...item, type: 'warranty_ticket' })),
        work_orders: workOrders.rows.map(item => ({ ...item, type: 'work_order' })),
        warranty_work_orders: warrantyWorkOrders.rows.map(item => ({ ...item, type: 'warranty_work_order' })),
        quotes: quotes.rows.map(item => ({ ...item, type: 'quote' }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single item detail for authenticated customer by ID and type
router.get('/my-items/:type/:id', authenticateCustomer, async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const customerId = req.customerUser.customerId;

    let query = null;

    if (type === 'repair_ticket') {
      query = `
        SELECT 
          rt.*, 
          c.name as customer_name, c.email as customer_email,
          c.company_name, c.phone, c.street_address, c.city,
          u.name as submitted_by_name
        FROM repair_tickets rt
        JOIN customers c ON rt.customer_id = c.id
        LEFT JOIN users u ON rt.submitted_by = u.id
        WHERE rt.id = $1 AND rt.customer_id = $2
      `;
    } else if (type === 'warranty_ticket') {
      query = `
        SELECT 
          wrt.*, 
          c.name as customer_name, c.email as customer_email,
          c.company_name, c.phone, c.street_address, c.city,
          u.name as submitted_by_name
        FROM warranty_repair_tickets wrt
        JOIN customers c ON wrt.customer_id = c.id
        LEFT JOIN users u ON wrt.submitted_by = u.id
        WHERE wrt.id = $1 AND wrt.customer_id = $2
      `;
    } else if (type === 'work_order') {
      query = `
        SELECT 
          wo.*, 
          c.name as customer_name, c.email as customer_email,
          c.company_name, c.phone, c.street_address, c.city,
          u.name as technician_name
        FROM work_orders wo
        JOIN customers c ON wo.customer_id = c.id
        LEFT JOIN users u ON wo.owner_technician_id = u.id
        WHERE wo.id = $1 AND wo.customer_id = $2
      `;
    } else if (type === 'warranty_work_order') {
      query = `
        SELECT 
          wwo.*, 
          c.name as customer_name, c.email as customer_email,
          c.company_name, c.phone, c.street_address, c.city,
          u.name as technician_name
        FROM warranty_work_orders wwo
        JOIN customers c ON wwo.customer_id = c.id
        LEFT JOIN users u ON wwo.owner_technician_id = u.id
        WHERE wwo.id = $1 AND wwo.customer_id = $2
      `;
    } else if (type === 'quote') {
      query = `
        SELECT 
          q.*, 
          c.name as customer_name, c.email as customer_email,
          c.company_name, c.phone, c.street_address, c.city,
          u.name as created_by_name
        FROM quotes q
        JOIN customers c ON q.customer_id = c.id
        LEFT JOIN users u ON q.created_by = u.id
        WHERE q.id = $1 AND q.customer_id = $2
      `;
    } else {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid item type'
      });
    }

    const result = await db.query(query, [id, customerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Item not found'
      });
    }

    // Log activity
    await db.query(
      `INSERT INTO customer_portal_activity 
       (customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        customerId,
        req.customerUser.id,
        'view_item',
        type,
        result.rows[0].id,
        result.rows[0].formatted_number,
        req.ip,
        req.get('user-agent')
      ]
    );

    const item = result.rows[0];
    let additionalData = {};

    // Get additional data based on type
    if (type === 'work_order') {
      // Get parts/inventory used
      const inventoryResult = await db.query(
        `SELECT 
          woi.id, woi.quantity, i.unit_price,
          i.name as item_name, i.description, i.sku
         FROM work_order_inventory woi
         JOIN inventory i ON woi.inventory_id = i.id
         WHERE woi.work_order_id = $1
         ORDER BY i.name`,
        [item.id]
      );
      additionalData.inventory = inventoryResult.rows;

      // Get notes
      const notesResult = await db.query(
        `SELECT 
          won.id, won.content as note_text, won.created_at
         FROM work_order_notes won
         WHERE won.work_order_id = $1
         ORDER BY won.created_at DESC`,
        [item.id]
      );
      additionalData.notes = notesResult.rows;

      // Get machine details
      const machineResult = await db.query(
        `SELECT 
          am.id, am.serial_id, am.warranty_expiry_date, am.warranty_active,
          ms.serial_number, mm.name as model_name, mm.manufacturer, mm.catalogue_number
         FROM assigned_machines am
         JOIN machine_serials ms ON am.serial_id = ms.id
         JOIN machine_models mm ON ms.model_id = mm.id
         WHERE am.id = $1`,
        [item.machine_id]
      );
      additionalData.machine = machineResult.rows[0] || null;
    } else if (type === 'warranty_work_order') {
      // Get parts/inventory used
      const inventoryResult = await db.query(
        `SELECT 
          wwoi.id, wwoi.quantity, i.unit_price,
          i.name as item_name, i.description, i.sku
         FROM warranty_work_order_inventory wwoi
         JOIN inventory i ON wwoi.inventory_id = i.id
         WHERE wwoi.warranty_work_order_id = $1
         ORDER BY i.name`,
        [item.id]
      );
      additionalData.inventory = inventoryResult.rows;

      // Get notes
      const notesResult = await db.query(
        `SELECT 
          wwon.id, wwon.content as note_text, wwon.created_at
         FROM warranty_work_order_notes wwon
         WHERE wwon.warranty_work_order_id = $1
         ORDER BY wwon.created_at DESC`,
        [item.id]
      );
      additionalData.notes = notesResult.rows;

      // Get machine details
      const machineResult = await db.query(
        `SELECT 
          am.id, am.serial_id, am.warranty_expiry_date, am.warranty_active,
          ms.serial_number, mm.name as model_name, mm.manufacturer, mm.catalogue_number
         FROM assigned_machines am
         JOIN machine_serials ms ON am.serial_id = ms.id
         JOIN machine_models mm ON ms.model_id = mm.id
         WHERE am.id = $1`,
        [item.machine_id]
      );
      additionalData.machine = machineResult.rows[0] || null;
    } else if (type === 'quote') {
      // Get quote items
      const itemsResult = await db.query(
        `SELECT 
          qi.id, qi.item_type, qi.item_name, qi.description,
          qi.quantity, qi.unit_price, qi.total_price, qi.category
         FROM quote_items qi
         WHERE qi.quote_id = $1
         ORDER BY qi.position, qi.id`,
        [item.id]
      );
      additionalData.items = itemsResult.rows;
    } else if (type === 'repair_ticket' || type === 'warranty_ticket') {
      // Get machine details
      const machineResult = await db.query(
        `SELECT 
          am.id, am.serial_id, am.warranty_expiry_date, am.warranty_active,
          ms.serial_number, mm.name as model_name, mm.manufacturer, mm.catalogue_number
         FROM assigned_machines am
         JOIN machine_serials ms ON am.serial_id = ms.id
         JOIN machine_models mm ON ms.model_id = mm.id
         WHERE am.id = $1`,
        [item.machine_id]
      );
      additionalData.machine = machineResult.rows[0] || null;
    }

    res.json({
      status: 'success',
      data: {
        type,
        item,
        ...additionalData
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get all machines for authenticated customer
router.get('/my-machines', authenticateCustomer, async (req, res, next) => {
  try {
    const customerId = req.customerUser.customerId;

    const query = `
      SELECT 
        am.id,
        am.serial_id,
        am.customer_id,
        am.purchase_date,
        am.warranty_expiry_date,
        am.warranty_active,
        am.sale_price,
        am.sale_date,
        am.machine_condition,
        am.receipt_number,
        am.is_sale,
        ms.serial_number,
        mm.id as model_id,
        mm.name as model_name,
        mm.manufacturer,
        mm.catalogue_number,
        mm.warranty_months,
        mc.name as category_name,
        -- Count related work orders
        (SELECT COUNT(*) FROM work_orders wo WHERE wo.machine_id = am.id) as work_order_count,
        (SELECT COUNT(*) FROM warranty_work_orders wwo WHERE wwo.machine_id = am.id) as warranty_work_order_count,
        -- Latest work order
        (SELECT wo.formatted_number FROM work_orders wo WHERE wo.machine_id = am.id ORDER BY wo.created_at DESC LIMIT 1) as latest_work_order,
        (SELECT wo.status FROM work_orders wo WHERE wo.machine_id = am.id ORDER BY wo.created_at DESC LIMIT 1) as latest_work_order_status
      FROM assigned_machines am
      JOIN machine_serials ms ON am.serial_id = ms.id
      JOIN machine_models mm ON ms.model_id = mm.id
      LEFT JOIN machine_categories mc ON mm.category_id = mc.id
      WHERE am.customer_id = $1
      ORDER BY am.purchase_date DESC NULLS LAST, am.assigned_at DESC
    `;

    const result = await db.query(query, [customerId]);

    // Log activity
    await db.query(
      `INSERT INTO customer_portal_activity 
       (customer_id, portal_user_id, action, entity_type, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        customerId,
        req.customerUser.id,
        'view_machines',
        'machines',
        req.ip,
        req.get('user-agent')
      ]
    );

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// Get single machine detail for authenticated customer
router.get('/my-machines/:id', authenticateCustomer, async (req, res, next) => {
  try {
    const { id } = req.params;
    const customerId = req.customerUser.customerId;

    // Get machine details
    const machineQuery = `
      SELECT 
        am.id,
        am.serial_id,
        am.customer_id,
        am.purchase_date,
        am.warranty_expiry_date,
        am.warranty_active,
        am.sale_price,
        am.sale_date,
        am.machine_condition,
        am.receipt_number,
        am.is_sale,
        am.assigned_at,
        am.updated_at,
        ms.serial_number,
        mm.id as model_id,
        mm.name as model_name,
        mm.manufacturer,
        mm.catalogue_number,
        mm.description as model_description,
        mm.warranty_months,
        mc.name as category_name,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.company_name,
        sold_by.name as sold_by_name,
        added_by.name as added_by_name
      FROM assigned_machines am
      JOIN machine_serials ms ON am.serial_id = ms.id
      JOIN machine_models mm ON ms.model_id = mm.id
      JOIN customers c ON am.customer_id = c.id
      LEFT JOIN machine_categories mc ON mm.category_id = mc.id
      LEFT JOIN users sold_by ON am.sold_by_user_id = sold_by.id
      LEFT JOIN users added_by ON am.added_by_user_id = added_by.id
      WHERE am.id = $1 AND am.customer_id = $2
    `;

    const machineResult = await db.query(machineQuery, [id, customerId]);

    if (machineResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Machine not found'
      });
    }

    const machine = machineResult.rows[0];

    // Get work orders for this machine
    const workOrdersQuery = `
      SELECT 
        wo.id,
        wo.formatted_number,
        wo.description,
        wo.status,
        wo.priority,
        wo.total_cost,
        wo.labor_hours,
        wo.labor_rate,
        wo.created_at,
        wo.started_at,
        wo.completed_at,
        u.name as technician_name
      FROM work_orders wo
      LEFT JOIN users u ON wo.owner_technician_id = u.id
      WHERE wo.machine_id = $1
      ORDER BY wo.created_at DESC
    `;

    const workOrdersResult = await db.query(workOrdersQuery, [id]);

    // Get warranty work orders for this machine
    const warrantyWorkOrdersQuery = `
      SELECT 
        wwo.id,
        wwo.formatted_number,
        wwo.description,
        wwo.status,
        wwo.priority,
        wwo.labor_hours,
        wwo.created_at,
        wwo.started_at,
        wwo.completed_at,
        u.name as technician_name
      FROM warranty_work_orders wwo
      LEFT JOIN users u ON wwo.owner_technician_id = u.id
      WHERE wwo.machine_id = $1
      ORDER BY wwo.created_at DESC
    `;

    const warrantyWorkOrdersResult = await db.query(warrantyWorkOrdersQuery, [id]);

    // Calculate total maintenance cost (from completed work orders only)
    const totalMaintenanceCost = workOrdersResult.rows
      .filter(wo => wo.status === 'completed' && wo.total_cost)
      .reduce((sum, wo) => sum + parseFloat(wo.total_cost), 0);

    // Log activity
    await db.query(
      `INSERT INTO customer_portal_activity 
       (customer_id, portal_user_id, action, entity_type, entity_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        customerId,
        req.customerUser.id,
        'view_machine_detail',
        'machine',
        id,
        req.ip,
        req.get('user-agent')
      ]
    );

    res.json({
      status: 'success',
      data: {
        machine,
        work_orders: workOrdersResult.rows,
        warranty_work_orders: warrantyWorkOrdersResult.rows,
        stats: {
          total_work_orders: workOrdersResult.rows.length,
          total_warranty_work_orders: warrantyWorkOrdersResult.rows.length,
          total_maintenance_cost: totalMaintenanceCost,
          total_cost: (machine.sale_price || 0) + totalMaintenanceCost
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

