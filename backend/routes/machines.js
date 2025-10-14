// routes/machines.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { createMachineNotification, createAssignedMachineNotification } = require('../utils/notificationHelpers');
const websocketService = require('../services/websocketService');
const { buildSmartSearchConditions } = require('../utils/searchUtils');

// GET machine models (grouped by name/catalogue_number) - NEW ENDPOINT
router.get('/models', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20, category, manufacturer } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const params = []
    let where = ''
    let paramIndex = 1;
    
    if (search) {
      const { condition, params: searchParams } = buildSmartSearchConditions(search, 'machines', paramIndex);
      if (condition) {
        where = `WHERE ${condition}`;
        params.push(...searchParams);
        paramIndex += searchParams.length;
      }
    }
    
    if (category) {
      params.push(category)
      if (where) {
        where += ` AND mc.name = $${paramIndex}`
      } else {
        where = `WHERE mc.name = $${paramIndex}`
      }
      paramIndex++;
    }
    
    if (manufacturer) {
      params.push(manufacturer)
      if (where) {
        where += ` AND mm.manufacturer = $${paramIndex}`
      } else {
        where = `WHERE mm.manufacturer = $${paramIndex}`
      }
      paramIndex++;
    }
    
    // Get total count of machine models
    const countQuery = `
      SELECT COUNT(*) 
      FROM machine_models mm
      LEFT JOIN machine_categories mc ON mm.category_id = mc.id
      ${where}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // Get machine models with aggregated data
    const query = `
      SELECT 
        mm.id,
        mm.name,
        mm.catalogue_number,
        mm.manufacturer,
        mm.description,
        mm.warranty_months,
        mc.name as category_name,
        COALESCE(serial_counts.total_serials, 0) as total_serials,
        COALESCE(serial_counts.total_assigned, 0) as total_assigned,
        COALESCE(serial_counts.unassigned_serials, 0) as unassigned_serials,
        COALESCE(warranty_counts.active_warranty, 0) as active_warranty,
        COALESCE(warranty_counts.expired_warranty, 0) as expired_warranty,
        mm.created_at,
        mm.updated_at
      FROM machine_models mm
      LEFT JOIN machine_categories mc ON mm.category_id = mc.id
      LEFT JOIN (
        SELECT 
          model_id,
          machines_with_serial + repair_machines_with_serial as total_serials,
          repair_machines_without_serial as total_assigned,
          unassigned_serials
        FROM (
          SELECT 
            ms.model_id,
            COUNT(ms.id) as machines_with_serial,
            COUNT(CASE WHEN am.id IS NULL THEN 1 END) as unassigned_serials
          FROM machine_serials ms
          LEFT JOIN sold_machines am ON ms.id = am.serial_id
          GROUP BY ms.model_id
        ) serial_data
        FULL OUTER JOIN (
          SELECT 
            (SELECT id FROM machine_models WHERE name = rm.model_name) as model_id,
            COUNT(CASE WHEN rm.serial_number IS NOT NULL THEN 1 END) as repair_machines_with_serial,
            COUNT(CASE WHEN rm.serial_number IS NULL THEN 1 END) as repair_machines_without_serial
          FROM machines rm
          GROUP BY rm.model_name
        ) repair_data ON serial_data.model_id = repair_data.model_id
      ) serial_counts ON mm.id = serial_counts.model_id
      LEFT JOIN (
        SELECT 
          model_id,
          sold_warranty_active + repair_warranty_active as active_warranty,
          sold_warranty_expired + repair_warranty_expired as expired_warranty
        FROM (
          SELECT 
            ms.model_id,
            COUNT(CASE WHEN am.warranty_active = true THEN 1 END) as sold_warranty_active,
            COUNT(CASE WHEN am.warranty_active = false AND am.warranty_expiry_date IS NOT NULL THEN 1 END) as sold_warranty_expired
          FROM machine_serials ms
          LEFT JOIN sold_machines am ON ms.id = am.serial_id
          GROUP BY ms.model_id
        ) sold_warranty
        FULL OUTER JOIN (
          SELECT 
            (SELECT id FROM machine_models WHERE name = rm.model_name) as model_id,
            COUNT(CASE WHEN rm.warranty_covered = true THEN 1 END) as repair_warranty_active,
            COUNT(CASE WHEN rm.warranty_covered = false AND rm.warranty_expiry_date IS NOT NULL THEN 1 END) as repair_warranty_expired
          FROM machines rm
          GROUP BY rm.model_name
        ) repair_warranty ON sold_warranty.model_id = repair_warranty.model_id
      ) warranty_counts ON mm.id = warranty_counts.model_id
      ${where}
      ORDER BY mm.name ASC, mm.catalogue_number ASC NULLS LAST
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
  } catch (err) {
    next(err);
  }
});

// GET unique manufacturers
router.get('/manufacturers', async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT DISTINCT manufacturer 
      FROM machine_models 
      WHERE manufacturer IS NOT NULL AND manufacturer != ''
    `;
    const params = [];
    
    if (search) {
      query += ` AND manufacturer ILIKE $1`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY manufacturer ASC`;
    
    const result = await db.query(query, params);
    const manufacturers = result.rows.map(row => row.manufacturer);
    
    res.json({
      status: 'success',
      data: manufacturers
    });
  } catch (err) {
    next(err);
  }
});

// GET unique bought_at locations
router.get('/bought-at-locations', async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT DISTINCT bought_at 
      FROM machines 
      WHERE bought_at IS NOT NULL AND bought_at != ''
    `;
    const params = [];
    
    if (search) {
      query += ` AND bought_at ILIKE $1`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY bought_at ASC`;
    
    const result = await db.query(query, params);
    const locations = result.rows.map(row => row.bought_at);
    
    res.json({
      status: 'success',
      data: locations
    });
  } catch (err) {
    next(err);
  }
});

// POST create new machine model
router.post('/models', async (req, res, next) => {
  try {
    const { name, catalogue_number, manufacturer, description, category_id, warranty_months } = req.body;
    
    // Validate required fields
    if (!name || !manufacturer) {
      return res.status(400).json({
        status: 'fail',
        message: 'Name and manufacturer are required'
      });
    }

    // Check if model already exists
    const existingQuery = `
      SELECT id FROM machine_models 
      WHERE name = $1 AND manufacturer = $2 
      AND (catalogue_number = $3 OR (catalogue_number IS NULL AND $3 IS NULL))
    `;
    const existingResult = await db.query(existingQuery, [name, manufacturer, catalogue_number]);
    
    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Machine model already exists'
      });
    }

    // Handle category_id - convert empty string to null
    const processedCategoryId = category_id === '' ? null : category_id;

    // Create new machine model
    const insertQuery = `
      INSERT INTO machine_models (name, catalogue_number, manufacturer, description, category_id, warranty_months)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await db.query(insertQuery, [name, catalogue_number, manufacturer, description, processedCategoryId, warranty_months || 12]);
    
    const newMachine = result.rows[0];

    // Create notification for new machine model
    try {
      await createMachineNotification(newMachine.id, 'created', req.user?.id);
      
      // Emit real-time WebSocket update
      await websocketService.emitMachineUpdate(newMachine.id, 'created', {
        createdBy: req.user?.id
      });
    } catch (notificationError) {
      console.error('Error creating machine notification:', notificationError);
      // Don't fail the request if notification fails
    }
    
    res.status(201).json({
      status: 'success',
      data: newMachine
    });
  } catch (err) {
    next(err);
  }
});

// GET machine model details with all serials
router.get('/models/:modelId', async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const { warranty_status } = req.query;
    
    // Use modelId directly as it's now the actual ID
    const params = [modelId];
    
    // Add warranty status filter
    let warrantyFilter = '';
    if (warranty_status) {
      if (warranty_status === 'active') {
        warrantyFilter = 'AND am.warranty_active = true';
      } else if (warranty_status === 'expired') {
        warrantyFilter = 'AND (am.warranty_active = false OR am.warranty_expiry_date < CURRENT_DATE)';
      }
    }

    // Get model info with sales metrics
    const modelQuery = `
      SELECT 
        mm.id,
        mm.name,
        mm.catalogue_number,
        mm.manufacturer,
        mm.category_id,
        mm.description,
        mm.warranty_months,
        mm.created_at,
        mm.updated_at,
        mc.name as category_name,
        COUNT(ms.id) as total_serials,
        COUNT(CASE WHEN am.id IS NOT NULL THEN 1 END) + COUNT(CASE WHEN rm.id IS NOT NULL THEN 1 END) as total_assigned,
        COUNT(CASE WHEN am.id IS NULL THEN 1 END) as unassigned_serials,
        COUNT(CASE WHEN am.warranty_active = true THEN 1 END) + COUNT(CASE WHEN rm.warranty_covered = true THEN 1 END) as active_warranty,
        COUNT(CASE WHEN am.warranty_active = false OR am.warranty_expiry_date < CURRENT_DATE THEN 1 END) + COUNT(CASE WHEN rm.warranty_covered = false THEN 1 END) as expired_warranty,
        -- Sales metrics
        COUNT(CASE WHEN am.is_sale = true THEN 1 END) as total_sales,
        COUNT(CASE WHEN am.is_sale = false THEN 1 END) as total_assignments,
        COUNT(CASE WHEN am.machine_condition = 'new' THEN 1 END) as new_machines_sold,
        COUNT(CASE WHEN am.machine_condition = 'used' THEN 1 END) as used_machines_sold,
        COALESCE(SUM(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as total_sales_revenue,
        COALESCE(AVG(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as avg_sale_price
      FROM machine_models mm
      LEFT JOIN machine_categories mc ON mm.category_id = mc.id
      LEFT JOIN machine_serials ms ON mm.id = ms.model_id
      LEFT JOIN sold_machines am ON ms.id = am.serial_id
      LEFT JOIN machines rm ON rm.model_name = mm.name
      WHERE mm.id = $1
      GROUP BY mm.id, mm.name, mm.catalogue_number, mm.manufacturer, mm.category_id, mm.description, mm.warranty_months, mm.created_at, mm.updated_at, mc.name
    `;
    
    const modelResult = await db.query(modelQuery, params);
    
    if (modelResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Machine model not found'
      });
    }

    // Get all serials for this model with sales data (both sold machines and repair machines)
    const serialsQuery = `
      SELECT 
        ms.id,
        ms.serial_number,
        am.id as assigned_machine_id,
        am.description,
        am.customer_id,
        ms.created_at,
        ms.updated_at,
        am.warranty_expiry_date,
        am.warranty_active,
        am.purchase_date,
        am.receipt_number,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.company_name,
        -- Sales fields
        am.sold_by_user_id,
        am.added_by_user_id,
        am.machine_condition,
        am.sale_date,
        am.sale_price,
        am.is_sale,
        -- Sales person information
        sales_user.name as sold_by_name,
        added_user.name as added_by_name,
        'sold' as machine_type
      FROM machine_serials ms
      LEFT JOIN sold_machines am ON ms.id = am.serial_id
      LEFT JOIN customers c ON c.id = am.customer_id
      LEFT JOIN users sales_user ON am.sold_by_user_id = sales_user.id
      LEFT JOIN users added_user ON am.added_by_user_id = added_user.id
      WHERE ms.model_id = $1 AND am.id IS NOT NULL
      
      UNION ALL
      
      SELECT 
        rm.id as id,
        rm.serial_number,
        rm.id as assigned_machine_id,
        rm.description,
        rm.customer_id,
        rm.created_at,
        rm.updated_at,
        rm.warranty_expiry_date,
        rm.warranty_covered as warranty_active,
        rm.purchase_date,
        rm.receipt_number,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.company_name,
        -- Sales fields (repair machines don't have these)
        null as sold_by_user_id,
        rm.received_by_user_id as added_by_user_id,
        rm.machine_condition,
        null as sale_date,
        rm.sale_price,
        false as is_sale,
        -- Sales person information
        null as sold_by_name,
        received_user.name as added_by_name,
        'repair' as machine_type
      FROM machines rm
      LEFT JOIN customers c ON c.id = rm.customer_id
      LEFT JOIN users received_user ON rm.received_by_user_id = received_user.id
      WHERE rm.model_name = (SELECT name FROM machine_models WHERE id = $1)
      
      ORDER BY serial_number ASC NULLS LAST
    `;
    
    const serialsResult = await db.query(serialsQuery, params);
    
    res.json({
      status: 'success',
      data: {
        model: modelResult.rows[0],
        serials: serialsResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT update machine model
router.put('/models/:modelId', async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const { name, catalogue_number, manufacturer, category_id, description, warranty_months } = req.body;
    
    // Validation
    if (!name || !manufacturer) {
      return res.status(400).json({
        status: 'error',
        message: 'Name and manufacturer are required'
      });
    }
    
    const result = await db.query(
      `UPDATE machine_models 
       SET name = $1, catalogue_number = $2, manufacturer = $3, category_id = $4, description = $5, warranty_months = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [name, catalogue_number || null, manufacturer, category_id || null, description || null, warranty_months || 12, modelId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Machine model not found'
      });
    }

    const updatedMachine = result.rows[0];

    // Create notification for machine model update
    try {
      await createMachineNotification(updatedMachine.id, 'updated', req.user?.id);
      
      // Emit real-time WebSocket update
      await websocketService.emitMachineUpdate(updatedMachine.id, 'updated', {
        updatedBy: req.user?.id
      });
    } catch (notificationError) {
      console.error('Error creating machine notification:', notificationError);
      // Don't fail the request if notification fails
    }
    
    res.json({
      status: 'success',
      data: updatedMachine,
      message: 'Machine model updated successfully'
    });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        status: 'error',
        message: 'A machine model with this name and catalogue number already exists'
      });
    }
    next(err);
  }
});

// DELETE machine model (and all its serials)
router.delete('/models/:modelId', async (req, res, next) => {
  try {
    const { modelId } = req.params;
    
    // Check if model exists
    const modelQuery = `
      SELECT id, name, manufacturer, catalogue_number
      FROM machine_models
      WHERE id = $1
    `;
    
    const modelResult = await db.query(modelQuery, [modelId]);
    
    if (modelResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Machine model not found'
      });
    }

    const model = modelResult.rows[0];

    // Check if any serials are assigned to customers
    const assignedQuery = `
      SELECT COUNT(*) as assigned_count
      FROM machine_serials ms
      JOIN sold_machines am ON ms.id = am.serial_id
      WHERE ms.model_id = $1
    `;
    
    const assignedResult = await db.query(assignedQuery, [modelId]);
    const assignedCount = parseInt(assignedResult.rows[0].assigned_count);
    
    if (assignedCount > 0) {
      return res.status(400).json({
        status: 'fail',
        message: `Cannot delete model: ${assignedCount} serial(s) are assigned to customers`
      });
    }

    // Create notification for machine model deletion (before deletion)
    try {
      await createMachineNotification(modelId, 'deleted', req.user?.id);
      
      // Emit real-time WebSocket update
      await websocketService.emitMachineUpdate(modelId, 'deleted', {
        deletedBy: req.user?.id
      });
    } catch (notificationError) {
      console.error('Error creating machine notification:', notificationError);
      // Don't fail the request if notification fails
    }

    // Delete all serials for this model first
    const deleteSerialsQuery = `
      DELETE FROM machine_serials
      WHERE model_id = $1
    `;
    
    await db.query(deleteSerialsQuery, [modelId]);

    // Delete the model
    const deleteModelQuery = `
      DELETE FROM machine_models
      WHERE id = $1
    `;
    
    await db.query(deleteModelQuery, [modelId]);
    
    res.json({
      status: 'success',
      message: 'Machine model deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// DELETE specific serial (completely delete from system)
router.delete('/serials/:serialId', async (req, res, next) => {
  try {
    const { serialId } = req.params;
    
    // First, check if this is an sold_machines ID or machine_serials ID
    // Check if serial exists and get its details - try sold_machines first
    const checkAssignedQuery = `
      SELECT am.id as assignment_id, am.customer_id, ms.id as serial_id, ms.serial_number
      FROM sold_machines am
      JOIN machine_serials ms ON am.serial_id = ms.id
      WHERE am.id = $1
    `;
    
    let checkResult = await db.query(checkAssignedQuery, [serialId]);
    let isAssigned = true;
    
    // If not found in sold_machines, check if it's a machine_serials ID
    if (checkResult.rows.length === 0) {
      const checkUnassignedQuery = `
        SELECT NULL as assignment_id, NULL as customer_id, ms.id as serial_id, ms.serial_number
        FROM machine_serials ms
        WHERE ms.id = $1
      `;
      
      checkResult = await db.query(checkUnassignedQuery, [serialId]);
      isAssigned = false;
      
      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          status: 'fail',
          message: 'Serial not found'
        });
      }
    }
    
    const serial = checkResult.rows[0];
    
    // Check if serial is referenced in work orders or repair tickets
    const referenceCheckQuery = `
      SELECT 
        (SELECT COUNT(*) FROM work_orders WHERE machine_id = $1) as work_orders_count,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE machine_id = $1) as warranty_work_orders_count,
        (SELECT COUNT(*) FROM repair_tickets WHERE machine_id = $1) as repair_tickets_count,
        (SELECT COUNT(*) FROM warranty_repair_tickets WHERE machine_id = $1) as warranty_repair_tickets_count
    `;
    
    const referenceResult = await db.query(referenceCheckQuery, [serial.serial_id]);
    const references = referenceResult.rows[0];
    
    const totalReferences = 
      parseInt(references.work_orders_count) + 
      parseInt(references.warranty_work_orders_count) + 
      parseInt(references.repair_tickets_count) + 
      parseInt(references.warranty_repair_tickets_count);
    
    if (totalReferences > 0) {
      return res.status(409).json({
        status: 'fail',
        message: `Cannot delete serial: it is referenced in ${totalReferences} work order(s) or repair ticket(s)`
      });
    }

    // If it's an assigned serial, delete from sold_machines first
    if (isAssigned) {
      const deleteAssignmentQuery = `
        DELETE FROM sold_machines
        WHERE id = $1
      `;
      await db.query(deleteAssignmentQuery, [serialId]);
    }
    
    // Delete from machine_serials
    const deleteSerialQuery = `
      DELETE FROM machine_serials
      WHERE id = $1
    `;
    
    await db.query(deleteSerialQuery, [serial.serial_id]);
    
    res.json({
      status: 'success',
      message: 'Serial deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// POST assign machine to customer (create new serial)
router.post('/assign', async (req, res, next) => {
  try {
    const { 
      model_id, 
      serial_number, 
      customer_id, 
      purchase_date, 
      description,
      receipt_number,
      sold_by_user_id,
      machine_condition,
      sale_date,
      sale_price,
      is_sale
    } = req.body;
    
    // Validate required fields
    if (!model_id || !serial_number || !customer_id) {
      return res.status(400).json({
        status: 'fail',
        message: 'Model ID, serial number, and customer are required'
      });
    }

    // Check if serial number already exists
    const existingSerialQuery = `
      SELECT id FROM machine_serials WHERE serial_number = $1
    `;
    const existingSerialResult = await db.query(existingSerialQuery, [serial_number]);
    
    if (existingSerialResult.rows.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Serial number already exists'
      });
    }

    // Check if customer exists
    const customerQuery = `
      SELECT id, name FROM customers WHERE id = $1
    `;
    const customerResult = await db.query(customerQuery, [customer_id]);
    
    if (customerResult.rows.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Customer not found'
      });
    }

    // Check if model exists
    const modelQuery = `
      SELECT id, name, manufacturer, warranty_months FROM machine_models WHERE id = $1
    `;
    const modelResult = await db.query(modelQuery, [model_id]);
    
    if (modelResult.rows.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Machine model not found'
      });
    }

    // Create new machine serial
    const insertSerialQuery = `
      INSERT INTO machine_serials (model_id, serial_number)
      VALUES ($1, $2)
      RETURNING *
    `;
    
    const serialResult = await db.query(insertSerialQuery, [model_id, serial_number]);
    const serialId = serialResult.rows[0].id;

    // Calculate warranty expiry date manually if purchase_date is provided
    let warrantyExpiryDate = null;
    let warrantyActive = false;
    if (purchase_date) {
      const warrantyQuery = `
        SELECT warranty_months FROM machine_models WHERE id = $1
      `;
      const warrantyResult = await db.query(warrantyQuery, [model_id]);
      const warrantyMonths = warrantyResult.rows[0]?.warranty_months || 12;
      
      // Calculate expiry date: purchase_date + warranty_months
      const expiryQuery = `
        SELECT ($1::date + INTERVAL '1 month' * $2)::date as expiry_date
      `;
      const expiryResult = await db.query(expiryQuery, [purchase_date, warrantyMonths]);
      warrantyExpiryDate = expiryResult.rows[0].expiry_date;
      
      // Set warranty_active based on expiry date
      warrantyActive = warrantyExpiryDate >= new Date().toISOString().split('T')[0];
    }

    // Assign serial to customer with calculated warranty expiry and sales fields
    const assignQuery = `
      INSERT INTO sold_machines (
        serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, 
        receipt_number, sold_by_user_id, added_by_user_id, machine_condition, 
        sale_date, sale_price, is_sale, description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const assignResult = await db.query(assignQuery, [
      serialId, 
      customer_id, 
      purchase_date || null, 
      warrantyExpiryDate, 
      warrantyActive, 
      receipt_number || null,
      sold_by_user_id || null,
      req.user?.id || null, // added_by_user_id
      machine_condition || 'new',
      sale_date || purchase_date || null,
      sale_price || null,
      is_sale !== undefined ? is_sale : true,
      description || null
    ]);
    
    const assignedMachine = assignResult.rows[0];

    // Create notification for machine assignment
    try {
      await createAssignedMachineNotification(assignedMachine.id, 'created', req.user?.id);
      
      // Emit real-time WebSocket update
      await websocketService.emitAssignedMachineUpdate(assignedMachine.id, 'created', {
        createdBy: req.user?.id
      });
    } catch (notificationError) {
      console.error('Error creating assigned machine notification:', notificationError);
      // Don't fail the request if notification fails
    }
    
    res.status(201).json({
      status: 'success',
      data: {
        serial: serialResult.rows[0],
        assignment: assignedMachine
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET all serials for a specific machine model
router.get('/models/:modelName/serials', async (req, res, next) => {
  try {
    const { modelName } = req.params;
    const { catalogue_number } = req.query;
    
    const params = [modelName];
    let where = 'WHERE m.name = $1';
    
    if (catalogue_number) {
      params.push(catalogue_number);
      where += ' AND COALESCE(m.catalogue_number, \'\') = $2';
    }
    
    const result = await db.query(
      `SELECT 
        m.id, 
        m.serial_number, 
        m.description, 
        m.customer_id, 
        m.created_at, 
        m.updated_at,
        m.warranty_expiry_date,
        m.warranty_active,
        m.purchase_date,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
       FROM machines m
       LEFT JOIN customers c ON c.id = m.customer_id
       ${where}
       ORDER BY m.serial_number ASC NULLS LAST`,
      params
    );
    
    res.json({
      data: result.rows,
      model: {
        name: modelName,
        catalogue_number: catalogue_number || null
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET machine models (optionally filter by search) - group by name/catalogue_number
router.get('/', async (req, res, next) => {
  try {
    const { search, all, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // If 'all' parameter is provided, return all individual machines for dropdown
    if (all === 'true') {
      const params = []
      let where = ''
    if (search) {
      const { condition, params: searchParams } = buildSmartSearchConditions(search, 'machines', 1);
      if (condition) {
        where = `WHERE ${condition}`;
        params.push(...searchParams);
      }
    }
      const result = await db.query(
        `SELECT m.id, m.name, m.serial_number, m.description, m.customer_id, c.name as customer_name
         FROM machines m
         LEFT JOIN customers c ON c.id = m.customer_id
         ${where}
         ORDER BY m.name ASC, m.serial_number ASC NULLS LAST`,
        params
      );
      return res.json({
        data: result.rows,
        pagination: {
          page: 1,
          limit: result.rows.length,
          total: result.rows.length,
          pages: 1
        }
      });
    }
    
    // Default behavior - return individual machines with pagination
    const params = []
    let where = ''
    if (search) {
      const { condition, params: searchParams } = buildSmartSearchConditions(search, 'machines', 1);
      if (condition) {
        where = `WHERE ${condition}`;
        params.push(...searchParams);
      }
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM machines m
      LEFT JOIN customers c ON c.id = m.customer_id
      ${where}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // Get machines with pagination
    const query = `
      SELECT m.id, m.name, m.model_name, m.catalogue_number, m.serial_number, m.description, 
             m.warranty_expiry_date, m.warranty_active, m.created_at, m.updated_at, m.customer_id,
             m.manufacturer, m.bought_at, m.category_id, m.receipt_number, m.purchase_date,
             c.name as customer_name, mc.name as category_name
       FROM machines m
       LEFT JOIN customers c ON c.id = m.customer_id
       LEFT JOIN machine_categories mc ON m.category_id = mc.id
       ${where}
       ORDER BY m.name ASC, m.serial_number ASC NULLS LAST
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
  } catch (err) {
    next(err);
  }
});

// GET all serials for a given model (by name/catalogue_number)
router.get('/model-serials', async (req, res, next) => {
  try {
    const { name, catalogue_number } = req.query;
    if (!name) return res.status(400).json({ status: 'fail', message: 'name is required' })
    
    let whereConditions = ['mm.name = $1'];
    let params = [name];
    let paramIndex = 2;
    
    if (catalogue_number) { 
      whereConditions.push(`COALESCE(mm.catalogue_number,'') = $${paramIndex}`);
      params.push(catalogue_number);
      paramIndex++;
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    const result = await db.query(
      `SELECT 
        ms.id, 
        ms.serial_number, 
        am.description, 
        am.customer_id, 
        am.assigned_at as created_at, 
        am.updated_at, 
        c.name as customer_name
       FROM machine_serials ms
       INNER JOIN machine_models mm ON ms.model_id = mm.id
       LEFT JOIN sold_machines am ON ms.id = am.serial_id
       LEFT JOIN customers c ON am.customer_id = c.id
       ${whereClause}
       ORDER BY ms.serial_number ASC NULLS LAST`
      , params
    )
    res.json({ status: 'success', data: result.rows })
  } catch (err) { next(err); }
});

// GET machine categories for dropdown
router.get('/categories', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        mc.id, 
        mc.name,
        COALESCE(model_counts.count, 0) as machine_models_count
      FROM machine_categories mc
      LEFT JOIN (
        SELECT category_id, COUNT(*) as count
        FROM machine_models
        GROUP BY category_id
      ) model_counts ON mc.id = model_counts.category_id
      ORDER BY mc.name ASC
    `);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// POST create new machine category
router.post('/categories', async (req, res, next) => {
  try {
    const { name } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({
        status: 'fail',
        message: 'Category name is required'
      });
    }

    // Check if category already exists
    const existingQuery = `
      SELECT id FROM machine_categories 
      WHERE name = $1
    `;
    const existingResult = await db.query(existingQuery, [name]);
    
    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Category already exists'
      });
    }

    // Create new category
    const insertQuery = `
      INSERT INTO machine_categories (name)
      VALUES ($1)
      RETURNING *
    `;
    const result = await db.query(insertQuery, [name]);
    
    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// PATCH update machine category
router.patch('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({
        status: 'fail',
        message: 'Category name is required'
      });
    }

    // Check if category exists
    const checkQuery = `
      SELECT id FROM machine_categories 
      WHERE id = $1
    `;
    const checkResult = await db.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Category not found'
      });
    }

    // Check if new name already exists (excluding current category)
    const existingQuery = `
      SELECT id FROM machine_categories 
      WHERE name = $1 AND id != $2
    `;
    const existingResult = await db.query(existingQuery, [name, id]);
    
    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Category name already exists'
      });
    }

    // Update category
    const updateQuery = `
      UPDATE machine_categories 
      SET name = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(updateQuery, [name, id]);
    
    res.json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// DELETE machine category
router.delete('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if category is being used by any machine models
    const usageQuery = `
      SELECT COUNT(*) as count
      FROM machine_models
      WHERE category_id = $1
    `;
    const usageResult = await db.query(usageQuery, [id]);
    const usageCount = parseInt(usageResult.rows[0].count);
    
    if (usageCount > 0) {
      return res.status(400).json({
        status: 'fail',
        message: `Cannot delete category: it is used by ${usageCount} machine model(s)`
      });
    }
    
    // Delete the category
    const deleteQuery = `
      DELETE FROM machine_categories
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(deleteQuery, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Category not found'
      });
    }
    
    res.json({
      status: 'success',
      message: 'Category deleted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// GET machines for a specific customer (both sold and repair machines)
router.get('/by-customer/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT 
        'sold' as machine_type,
        sm.id,
        mm.name as name,
        mm.name as model_name,
        mm.catalogue_number,
        ms.serial_number,
        sm.warranty_expiry_date,
        sm.warranty_active,
        sm.sale_date as created_at,
        sm.updated_at,
        mc.name as category_name,
        mm.manufacturer,
        sm.purchase_date,
        sm.description,
        -- Sales fields
        sm.sold_by_user_id,
        sm.added_by_user_id,
        sm.machine_condition,
        sm.sale_date,
        sm.sale_price,
        true as is_sale,
        -- Sales person information
        sales_user.name as sold_by_name,
        added_user.name as added_by_name,
        null as received_date,
        null as status,
        null as condition_on_receipt,
        null as received_by_user_id,
        null as received_by_name
       FROM sold_machines sm
       INNER JOIN machine_serials ms ON sm.serial_id = ms.id
       INNER JOIN machine_models mm ON ms.model_id = mm.id
       LEFT JOIN machine_categories mc ON mm.category_id = mc.id
       LEFT JOIN users sales_user ON sm.sold_by_user_id = sales_user.id
       LEFT JOIN users added_user ON sm.added_by_user_id = added_user.id
       WHERE sm.customer_id = $1
       
       UNION ALL
       
       SELECT 
        'repair' as machine_type,
        rm.id,
        rm.model_name as name,
        rm.model_name,
        mm.catalogue_number,
        rm.serial_number,
        rm.warranty_expiry_date,
        rm.warranty_covered as warranty_active,
        rm.received_date as created_at,
        rm.updated_at,
        mc.name as category_name,
        mm.manufacturer,
        rm.received_date as purchase_date,
        rm.description,
        -- Sales fields (null for repair machines)
        null as sold_by_user_id,
        null as added_by_user_id,
        rm.condition_on_receipt as machine_condition,
        null as sale_date,
        rm.sale_price,
        false as is_sale,
        null as sold_by_name,
        null as added_by_name,
        -- Repair fields
        rm.received_date,
        rm.repair_status as status,
        rm.condition_on_receipt,
        rm.received_by_user_id,
        received_user.name as received_by_name
       FROM machines rm
       LEFT JOIN machine_models mm ON rm.model_name = mm.name  -- Join with machine_models to get model data
       LEFT JOIN machine_categories mc ON mm.category_id = mc.id  -- Get category from machine_models
       LEFT JOIN users received_user ON rm.received_by_user_id = received_user.id
       WHERE rm.customer_id = $1
       
       ORDER BY name ASC, serial_number ASC NULLS LAST`,
      [req.params.id]
    )
    res.json({ status: 'success', data: result.rows })
  } catch (err) { next(err); }
});

// GET machine by id (both sold and repair machines)
router.get('/:id', async (req, res, next) => {
  try {
    // First try to find in sold_machines
    let result = await db.query(
      `SELECT 
        'sold' as machine_type,
        sm.id,
        sm.customer_id,
        mm.name as name,
        mm.name as model_name,
        mm.catalogue_number,
        ms.serial_number,
        sm.description,
        sm.warranty_expiry_date,
        sm.warranty_active,
        sm.updated_at,
        sm.sale_date as created_at,
        mm.manufacturer,
        sm.purchase_date,
        mm.category_id,
        sm.receipt_number,
        c.name as customer_name,
        mc.name as category_name,
        -- Sales fields
        sm.sold_by_user_id,
        sm.added_by_user_id,
        sm.machine_condition,
        sm.sale_date,
        sm.sale_price,
        true as is_sale,
        sm.purchased_at,
        -- Sales person information
        sales_user.name as sold_by_name,
        added_user.name as added_by_name,
        -- Repair machine fields (null for sold machines)
        null as received_date,
        null as repair_status,
        null as condition_on_receipt,
        null as received_by_user_id,
        null as received_by_name
       FROM sold_machines sm
       INNER JOIN machine_serials ms ON sm.serial_id = ms.id
       INNER JOIN machine_models mm ON ms.model_id = mm.id
       LEFT JOIN customers c ON c.id = sm.customer_id
       LEFT JOIN machine_categories mc ON mm.category_id = mc.id
       LEFT JOIN users sales_user ON sm.sold_by_user_id = sales_user.id
       LEFT JOIN users added_user ON sm.added_by_user_id = added_user.id
       WHERE sm.id = $1`,
      [req.params.id]
    );

    // If not found in sold_machines, try machines (repair machines)
    if (!result.rows.length) {
      result = await db.query(
         `SELECT 
          'repair' as machine_type,
          rm.id,
          rm.customer_id,
          rm.model_name as name,
          rm.model_name,
          mm.catalogue_number,
          rm.serial_number,
          rm.description,
          rm.warranty_expiry_date,
          rm.warranty_covered as warranty_active,
          rm.updated_at,
          rm.received_date as created_at,
          mm.manufacturer,
          rm.purchase_date,
          mm.category_id,
          rm.receipt_number,
          c.name as customer_name,
          mc.name as category_name,
          -- Sales fields (null for repair machines)
          null as sold_by_user_id,
          null as added_by_user_id,
          rm.machine_condition,
          null as sale_date,
          rm.sale_price,
          false as is_sale,
          rm.purchased_at,
          -- Sales person information (null for repair machines)
          null as sold_by_name,
          null as added_by_name,
          -- Repair machine fields
          rm.received_date,
          rm.repair_status,
          rm.condition_on_receipt,
          rm.received_by_user_id,
          received_user.name as received_by_name
         FROM machines rm
         LEFT JOIN machine_models mm ON rm.model_name = mm.name  -- Join with machine_models to get model data
         LEFT JOIN customers c ON c.id = rm.customer_id
         LEFT JOIN machine_categories mc ON mm.category_id = mc.id  -- Get category from machine_models
         LEFT JOIN users received_user ON rm.received_by_user_id = received_user.id
         WHERE rm.id = $1`,
        [req.params.id]
      );
    }

    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'Machine not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// CREATE machine
router.post('/', async (req, res, next) => {
  try {
    const { customer_id, model_name, catalogue_number, serial_number, description, manufacturer, bought_at, category_id, receipt_number, purchase_date, received_date, repair_status, condition_on_receipt, warranty_covered, received_by_user_id, purchased_at, warranty_expiry_date, sale_price, machine_condition } = req.body;
    
    // For repair machine creation, only model_name is required (manufacturer will be fetched from machine_models)
    if (!model_name) {
      return res.status(400).json({ status: 'fail', message: 'model_name is required' });
    }
    
    // Get machine model data if manufacturer is not provided
    let finalManufacturer = manufacturer;
    let finalCatalogueNumber = catalogue_number;
    let finalCategoryId = category_id;
    
    if (!finalManufacturer) {
      const modelQuery = await db.query(
        'SELECT manufacturer, catalogue_number, category_id FROM machine_models WHERE name = $1',
        [model_name]
      );
      
      if (modelQuery.rows.length === 0) {
        return res.status(400).json({ status: 'fail', message: 'Machine model not found. Please create the machine model first.' });
      }
      
      const modelData = modelQuery.rows[0];
      finalManufacturer = modelData.manufacturer;
      finalCatalogueNumber = finalCatalogueNumber || modelData.catalogue_number;
      finalCategoryId = finalCategoryId || modelData.category_id;
    }
    
    const result = await db.query(
      `INSERT INTO machines (customer_id, name, model_name, catalogue_number, serial_number, description, 
                           manufacturer, bought_at, category_id, receipt_number, purchase_date, received_date, 
                           repair_status, condition_on_receipt, warranty_covered, received_by_user_id, 
                           purchased_at, warranty_expiry_date, sale_price, machine_condition) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) 
       RETURNING id, customer_id, name, model_name, catalogue_number, serial_number, description, 
                warranty_expiry_date, warranty_active, updated_at, manufacturer, bought_at, category_id, 
                receipt_number, purchase_date, received_date, repair_status, condition_on_receipt, 
                warranty_covered, received_by_user_id, purchased_at, sale_price, machine_condition`,
      [customer_id || null, model_name, model_name, finalCatalogueNumber || null, serial_number || null, description || null, 
       finalManufacturer, bought_at || null, finalCategoryId || null, receipt_number || null, purchase_date || null,
       received_date || null, repair_status || null, condition_on_receipt || null, warranty_covered || null, 
       received_by_user_id || null, purchased_at || null, warranty_expiry_date || null, sale_price || null, machine_condition || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ status: 'fail', message: 'Invalid customer_id' });
    if (err.code === '23505') return res.status(400).json({ status: 'fail', message: 'Serial number must be unique per model (name + catalogue number)' });
    next(err);
  }
});

// PATCH update machine
router.patch('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { name, model_name, catalogue_number, serial_number, description, customer_id, manufacturer, bought_at, category_id, receipt_number, purchase_date } = req.body;
  try {
    const result = await db.query(
      `UPDATE machines SET
        name = COALESCE($1, name),
        model_name = COALESCE($2, model_name),
        catalogue_number = COALESCE($3, catalogue_number),
        serial_number = COALESCE($4, serial_number),
        description = COALESCE($5, description),
        customer_id = COALESCE($6, customer_id),
        manufacturer = COALESCE($7, manufacturer),
        bought_at = COALESCE($8, bought_at),
        category_id = COALESCE($9, category_id),
        receipt_number = COALESCE($10, receipt_number),
        purchase_date = COALESCE($11, purchase_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING id, customer_id, name, model_name, catalogue_number, serial_number, description, 
                warranty_expiry_date, warranty_active, updated_at, manufacturer, bought_at, category_id, 
                receipt_number, purchase_date`,
      [name, model_name, catalogue_number, serial_number, description, customer_id, manufacturer, bought_at, category_id, receipt_number, purchase_date, id]
    );
    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'Machine not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ status: 'fail', message: 'Serial number must be unique per model' });
    next(err);
  }
});

// DELETE machine model (all machines with same name and catalogue_number)
router.delete('/model', async (req, res, next) => {
  try {
    const { name, catalogue_number } = req.query;
    if (!name) {
      return res.status(400).json({ status: 'fail', message: 'name is required' });
    }

    // Check if any machines of this model are referenced in work orders or repair tickets
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM machines m
      LEFT JOIN work_orders wo ON m.id = wo.machine_id
      LEFT JOIN repair_tickets rt ON m.id = rt.machine_id
      WHERE m.name = $1 AND COALESCE(m.catalogue_number, '') = COALESCE($2, '')
      AND (wo.machine_id IS NOT NULL OR rt.machine_id IS NOT NULL)
    `;
    
    const checkResult = await db.query(checkQuery, [name, catalogue_number || null]);
    if (parseInt(checkResult.rows[0].count) > 0) {
      return res.status(409).json({ 
        status: 'fail', 
        message: 'Cannot delete: this machine model has associated work orders or repair tickets' 
      });
    }

    // Delete all machines with the same name and catalogue_number
    const deleteQuery = `
      DELETE FROM machines 
      WHERE name = $1 AND COALESCE(catalogue_number, '') = COALESCE($2, '')
      RETURNING id, name, catalogue_number
    `;
    
    const result = await db.query(deleteQuery, [name, catalogue_number || null]);
    
    if (!result.rows.length) {
      return res.status(404).json({ status: 'fail', message: 'Machine model not found' });
    }
    
    res.json({ 
      status: 'success', 
      message: `Deleted ${result.rows.length} machine(s)`, 
      deleted_count: result.rows.length,
      model_name: name,
      catalogue_number: catalogue_number
    });
  } catch (err) {
    next(err);
  }
});

// DELETE individual machine
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM machines WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'Machine not found' });
    res.json({ status: 'success', message: 'Deleted', id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ status: 'fail', message: 'Cannot delete: machine is referenced by other records' });
    next(err);
  }
});

module.exports = router;
