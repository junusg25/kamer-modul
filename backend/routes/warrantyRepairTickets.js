const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { createTicketNotification, createWorkOrderNotification, createNotification, createNotificationForManagers } = require('../utils/notificationHelpers');
const { logCustomAction } = require('../utils/actionLogger');
const { buildSmartSearchConditions } = require('../utils/searchUtils');

// GET all warranty repair tickets
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { status, priority, customer_id, machine_id, technician_id, submitted_by, search, year, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (search) {
      const { condition, params: searchParams } = buildSmartSearchConditions(search, 'warrantyRepairTickets', paramCount + 1);
      if (condition) {
        whereConditions.push(`(${condition})`);
        params.push(...searchParams);
        paramCount += searchParams.length;
      }
    }

    if (status) {
      paramCount++;
      whereConditions.push(`wrt.status = $${paramCount}`);
      params.push(status);
    }

    if (priority) {
      paramCount++;
      whereConditions.push(`wrt.priority = $${paramCount}`);
      params.push(priority);
    }

    if (customer_id) {
      paramCount++;
      whereConditions.push(`wrt.customer_id = $${paramCount}`);
      params.push(customer_id);
    }

    if (machine_id) {
      paramCount++;
      whereConditions.push(`wrt.machine_id = $${paramCount}`);
      params.push(machine_id);
    }

    if (technician_id) {
      if (technician_id === 'unassigned') {
        whereConditions.push(`(wrt.converted_by_technician_id IS NULL OR wrt.converted_by_technician_id = '')`);
      } else {
        paramCount++;
        whereConditions.push(`(wrt.converted_by_technician_id = $${paramCount} OR wrt.submitted_by = $${paramCount})`);
        params.push(technician_id);
      }
    }

    if (submitted_by) {
      paramCount++;
      whereConditions.push(`wrt.submitted_by = $${paramCount}`);
      params.push(submitted_by);
    }

    if (year) {
      paramCount++;
      whereConditions.push(`wrt.year_created = $${paramCount}`);
      params.push(parseInt(year));
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM warranty_repair_tickets_view wrt
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get paginated results
    paramCount++;
    const query = `
      SELECT * FROM warranty_repair_tickets_view wrt
      ${whereClause}
      ORDER BY wrt.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      status: 'success',
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET available years (for year filter dropdown)
router.get('/filter/years', authenticateToken, async (req, res, next) => {
  try {
    const query = `
      SELECT DISTINCT year_created 
      FROM warranty_repair_tickets 
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

// GET warranty repair ticket by ID
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT * FROM warranty_repair_tickets_view wrt
      WHERE wrt.id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Warranty repair ticket not found' 
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

// POST create new warranty repair ticket
router.post('/', [
  authenticateToken,
  body('problem_description').notEmpty().withMessage('Problem description is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'fail', 
        message: errors.array().map(err => `${err.param}: ${err.msg}`).join(', ')
      });
    }

    const {
      // Customer fields (for new customer)
      customer_name,
      customer_email,
      customer_phone,
      customer_phone2,
      customer_fax,
      customer_company_name,
      customer_vat_number,
      customer_city,
      customer_postal_code,
      customer_street_address,
      customer_id, // for existing customer
      
      // Machine fields (for new machine)
      machine_manufacturer,
      machine_model_name,
      machine_catalogue_number,
      machine_serial_number,
      machine_description,
      machine_category_id,
      machine_bought_at,
      machine_receipt_number,
      machine_purchase_date,
      machine_id, // for existing machine
      machine_model_type, // Added for new machine model selection
      
      // Ticket fields
      problem_description,
      notes,
      additional_equipment,
      brought_by,
      priority
    } = req.body;

    const submitted_by = req.user.id; // Use the authenticated user

    // Start database transaction
    const client = await db.connect()

    try {
      await client.query('BEGIN')

      let finalCustomerId = customer_id
      let finalMachineId = machine_id

      // Handle customer creation if needed
      if (!finalCustomerId) {
        if (!customer_name || !customer_email) {
          await client.query('ROLLBACK')
          client.release()
          return res.status(400).json({
            status: 'fail',
            message: 'customer_name and customer_email are required when creating new customer'
          })
        }

        const customerResult = await client.query(
          `INSERT INTO customers (
            name, email, phone, phone2, fax, company_name, vat_number, 
            city, postal_code, street_address
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id`,
          [
            customer_name, 
            customer_email, 
            customer_phone || null, 
            customer_phone2 || null, 
            customer_fax || null, 
            customer_company_name || null, 
            customer_vat_number || null,
            customer_city || null, 
            customer_postal_code || null, 
            customer_street_address || null
          ]
        )
        finalCustomerId = customerResult.rows[0].id
      }

      // Handle machine creation if needed
      if (!finalMachineId) {
        // Serial number is optional for warranty repair machines

        // Convert empty strings to null for integer fields
        const categoryId = machine_category_id && machine_category_id !== '' ? parseInt(machine_category_id) : null
        
        // Handle machine model (existing or new)
        let modelId = null
        
        // Check if we have machine_model_type and machine_model_name
        if (machine_model_name && machine_manufacturer) {
          if (machine_model_type === 'existing') {
            // User wants to use existing model - find it by name and manufacturer
            const existingModelResult = await client.query(
              `SELECT id FROM machine_models 
               WHERE name = $1 AND manufacturer = $2`,
              [machine_model_name, machine_manufacturer]
            )
            
            if (existingModelResult.rows.length === 0) {
              await client.query('ROLLBACK')
              client.release()
              return res.status(400).json({
                status: 'fail',
                message: 'Selected machine model not found. Please create a new model or select a different existing model.'
              })
            }
            
            modelId = existingModelResult.rows[0].id
          } else {
            // User wants to create new model - check if it already exists
            const existingModelResult = await client.query(
              `SELECT id FROM machine_models 
               WHERE name = $1 AND manufacturer = $2`,
              [machine_model_name, machine_manufacturer]
            )
            
            if (existingModelResult.rows.length > 0) {
              // Model already exists, use it
              modelId = existingModelResult.rows[0].id
            } else {
              // Create new machine model
              const modelResult = await client.query(
                `INSERT INTO machine_models (
                  name, catalogue_number, manufacturer, category_id, description, warranty_months
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id`,
                [
                  machine_model_name,
                  machine_catalogue_number || null,
                  machine_manufacturer,
                  categoryId,
                  machine_description || null,
                  12 // Default warranty months
                ]
              )
              modelId = modelResult.rows[0].id
            }
          }
        }

        if (!modelId) {
          await client.query('ROLLBACK')
          client.release()
          return res.status(400).json({
            status: 'fail',
            message: 'machine_model_name and machine_manufacturer are required when creating new machine'
          })
        }

        // For warranty repair tickets, create repair machines in the machines table
        // (same logic as regular repair tickets but with warranty_covered = true)
        
        // Get machine model data if manufacturer is not provided
        let finalManufacturer = machine_manufacturer
        let finalCatalogueNumber = machine_catalogue_number
        let finalCategoryId = categoryId
        
        if (!finalManufacturer) {
          const modelQuery = await client.query(
            'SELECT manufacturer, catalogue_number, category_id FROM machine_models WHERE name = $1',
            [machine_model_name]
          )
          
          if (modelQuery.rows.length === 0) {
            await client.query('ROLLBACK')
            client.release()
            return res.status(400).json({
              status: 'fail',
              message: 'Machine model not found. Please create the machine model first.'
            })
          }
          
          const modelData = modelQuery.rows[0]
          finalManufacturer = modelData.manufacturer
          finalCatalogueNumber = finalCatalogueNumber || modelData.catalogue_number
          finalCategoryId = finalCategoryId || modelData.category_id
        }

        // Create repair machine in machines table
        const repairMachineResult = await client.query(
          `INSERT INTO machines (customer_id, name, model_name, catalogue_number, serial_number, description, 
                               manufacturer, bought_at, category_id, receipt_number, purchase_date, received_date, 
                               repair_status, condition_on_receipt, warranty_covered, received_by_user_id, 
                               purchased_at, warranty_expiry_date, sale_price, machine_condition) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) 
           RETURNING id`,
          [
            finalCustomerId,
            machine_model_name, // name field
            machine_model_name, // model_name field
            finalCatalogueNumber || null,
            machine_serial_number || null, // Optional serial number
            machine_description || null,
            finalManufacturer,
            machine_bought_at || null,
            finalCategoryId || null,
            machine_receipt_number || null,
            machine_purchase_date || null,
            new Date().toISOString().split('T')[0], // received_date (today)
            'in_repair', // repair_status
            'unknown', // condition_on_receipt
            true, // warranty_covered (true for warranty repair tickets)
            submitted_by, // received_by_user_id
            machine_bought_at || null, // purchased_at
            null, // warranty_expiry_date (will be calculated later if needed)
            null, // sale_price
            'unknown' // machine_condition
          ]
        )
        
        finalMachineId = repairMachineResult.rows[0].id
      } else {
        // Validate that the existing machine_id exists in either sold_machines or machines tables
        const machineCheck = await client.query(
          `SELECT id FROM sold_machines WHERE id = $1
           UNION ALL
           SELECT id FROM machines WHERE id = $1`,
          [finalMachineId]
        )
        
        if (machineCheck.rows.length === 0) {
          await client.query('ROLLBACK')
          client.release()
          return res.status(400).json({
            status: 'fail',
            message: 'Invalid machine_id provided'
          })
        }
      }

      if (!finalCustomerId || !finalMachineId) {
        await client.query('ROLLBACK')
        client.release()
        return res.status(400).json({
          status: 'fail',
          message: 'Failed to create customer or machine'
        })
      }

      const query = `
        INSERT INTO warranty_repair_tickets (
          customer_id, machine_id, problem_description, notes, 
          additional_equipment, submitted_by, brought_by, priority
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await client.query(query, [
        finalCustomerId, 
        finalMachineId, 
        problem_description,
        notes || null,
        additional_equipment || null,
        submitted_by,
        brought_by || null,
        priority
      ]);

      await client.query('COMMIT')

      // Get the full ticket with customer and machine info
      const fullTicketQuery = `
        SELECT * FROM warranty_repair_tickets_view wrt
        WHERE wrt.id = $1
      `;
      
      const fullTicketResult = await db.query(fullTicketQuery, [result.rows[0].id]);

      // Create notification for new warranty repair ticket
      try {
        console.log('Creating notification for warranty repair ticket:', result.rows[0].id);
        await createTicketNotification(result.rows[0].id, 'created', 'warranty_repair_ticket', submitted_by);
        console.log('Notification created successfully for warranty repair ticket');
      } catch (notificationError) {
        console.error('Error creating notification for warranty repair ticket:', notificationError);
        // Don't fail the request if notification fails
      }

      const fullTicket = fullTicketResult.rows[0]

      // Log action
      await logCustomAction(req, 'create', 'warranty_repair_ticket', result.rows[0].id, fullTicket.formatted_number || `WRT-${result.rows[0].id}`, {
        customer_name: fullTicket.customer_name,
        machine_serial: fullTicket.serial_number,
        priority: priority
      });

      res.status(201).json({
        status: 'success',
        data: fullTicket
      });
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (err) {
    next(err);
  }
});

// PUT update warranty repair ticket
router.put('/:id', [
  authenticateToken,
  body('problem_description').optional().notEmpty().withMessage('Problem description cannot be empty'),
  body('notes').optional().isString(),
  body('additional_equipment').optional().isString(),
  body('brought_by').optional().isString(),
  body('status').optional().isIn(['intake', 'converted', 'cancelled']).withMessage('Invalid status')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'fail', 
        message: errors.array().map(err => `${err.param}: ${err.msg}`).join(', ')
      });
    }

    const { id } = req.params;
    const {
      problem_description,
      notes,
      additional_equipment,
      brought_by,
      status
    } = req.body;

    // Check if ticket exists and get current data
    const existingQuery = 'SELECT * FROM warranty_repair_tickets WHERE id = $1';
    const existingResult = await db.query(existingQuery, [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Warranty repair ticket not found' 
      });
    }

    const currentTicket = existingResult.rows[0];

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    if (problem_description !== undefined) {
      paramCount++;
      updateFields.push(`problem_description = $${paramCount}`);
      updateValues.push(problem_description);
    }

    if (notes !== undefined) {
      paramCount++;
      updateFields.push(`notes = $${paramCount}`);
      updateValues.push(notes);
    }

    if (additional_equipment !== undefined) {
      paramCount++;
      updateFields.push(`additional_equipment = $${paramCount}`);
      updateValues.push(additional_equipment);
    }

    if (brought_by !== undefined) {
      paramCount++;
      updateFields.push(`brought_by = $${paramCount}`);
      updateValues.push(brought_by);
    }

    if (status !== undefined) {
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      updateValues.push(status);
      
      // If converting to converted status, set converted_at
      if (status === 'converted' && currentTicket.status !== 'converted') {
        paramCount++;
        updateFields.push(`converted_at = $${paramCount}`);
        updateValues.push(new Date());
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'No fields to update' 
      });
    }

    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());
    updateValues.push(id);

    const query = `
      UPDATE warranty_repair_tickets 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await db.query(query, updateValues);

    // Get the full updated ticket
    const fullTicketQuery = `
      SELECT * FROM warranty_repair_tickets_view wrt
      WHERE wrt.id = $1
    `;
    
    const fullTicketResult = await db.query(fullTicketQuery, [id]);

    res.json({
      status: 'success',
      data: fullTicketResult.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// PATCH update warranty repair ticket
router.patch('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { problem_description, notes, additional_equipment, brought_by } = req.body;

    // Check if ticket exists
    const existingQuery = 'SELECT status FROM warranty_repair_tickets WHERE id = $1';
    const existingResult = await db.query(existingQuery, [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Warranty repair ticket not found' 
      });
    }

    const ticket = existingResult.rows[0];
    
    // Only allow updates if ticket is in intake status
    if (ticket.status !== 'intake') {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'Cannot update ticket that has been converted or cancelled' 
      });
    }

    // Build update query dynamically
    const updates = [];
    const updateValues = [];
    let paramCount = 0;

    if (problem_description !== undefined) {
      paramCount++;
      updates.push(`problem_description = $${paramCount}`);
      updateValues.push(problem_description);
    }

    if (notes !== undefined) {
      paramCount++;
      updates.push(`notes = $${paramCount}`);
      updateValues.push(notes);
    }

    if (additional_equipment !== undefined) {
      paramCount++;
      updates.push(`additional_equipment = $${paramCount}`);
      updateValues.push(additional_equipment);
    }

    if (brought_by !== undefined) {
      paramCount++;
      updates.push(`brought_by = $${paramCount}`);
      updateValues.push(brought_by);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'No valid fields to update' 
      });
    }

    paramCount++;
    updateValues.push(id);

    const query = `
      UPDATE warranty_repair_tickets 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, updateValues);

    // Get the full updated ticket
    const fullTicketQuery = `
      SELECT * FROM warranty_repair_tickets_view wrt
      WHERE wrt.id = $1
    `;
    
    const fullTicketResult = await db.query(fullTicketQuery, [id]);

    res.json({
      status: 'success',
      data: fullTicketResult.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// DELETE warranty repair ticket
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if ticket exists and can be deleted
    const existingQuery = 'SELECT status FROM warranty_repair_tickets WHERE id = $1';
    const existingResult = await db.query(existingQuery, [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Warranty repair ticket not found' 
      });
    }

    const ticket = existingResult.rows[0];
    
    // Only allow deletion if ticket is in intake status
    if (ticket.status !== 'intake') {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'Cannot delete ticket that has been converted or cancelled' 
      });
    }

    // Get full ticket details before deletion
    const fullTicketQuery = 'SELECT * FROM warranty_repair_tickets_view WHERE id = $1';
    const fullTicketResult = await db.query(fullTicketQuery, [id]);
    const fullTicket = fullTicketResult.rows[0];

    // Log action before deletion
    await logCustomAction(req, 'delete', 'warranty_repair_ticket', id, fullTicket?.formatted_number || `WRT-${id}`, {
      customer_name: fullTicket?.customer_name,
      machine_serial: fullTicket?.serial_number
    });

    const query = 'DELETE FROM warranty_repair_tickets WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);

    res.json({
      status: 'success',
      message: 'Warranty repair ticket deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// POST convert warranty repair ticket to warranty work order
router.post('/:id/convert', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { description, priority = 'medium', technician_id } = req.body;

    // Start a transaction
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');

      // Get the warranty repair ticket directly from the table to avoid view issues
      const ticketQuery = `
        SELECT wrt.*, c.name as customer_name, 
               COALESCE(mm_sm.manufacturer, rm.manufacturer) as manufacturer,
               COALESCE(mm_sm.name, rm.model_name) as model_name
        FROM warranty_repair_tickets wrt
        LEFT JOIN customers c ON wrt.customer_id = c.id
        LEFT JOIN sold_machines sm ON wrt.machine_id = sm.id
        LEFT JOIN machine_serials ms ON sm.serial_id = ms.id
        LEFT JOIN machine_models mm_sm ON ms.model_id = mm_sm.id
        LEFT JOIN machines rm ON wrt.machine_id = rm.id
        WHERE wrt.id = $1
      `;
      const ticketResult = await client.query(ticketQuery, [id]);
      
      if (ticketResult.rows.length === 0) {
        throw new Error('Warranty repair ticket not found');
      }

      const ticket = ticketResult.rows[0];
      
      if (ticket.status !== 'intake') {
        throw new Error('Ticket cannot be converted - not in intake status');
      }

      // Determine who should be assigned to the warranty work order
      let assignedTechnicianId;
      
      if (req.user.role === 'admin' || req.user.role === 'manager') {
        // Admins and managers can specify a technician or leave unassigned
        if (technician_id) {
          // Validate that the specified technician exists and is a technician
          const techCheck = await client.query(
            'SELECT id, name FROM users WHERE id = $1 AND role = $2',
            [technician_id, 'technician']
          );
          
          if (techCheck.rows.length === 0) {
            throw new Error('Invalid technician_id or user is not a technician');
          }
          
          assignedTechnicianId = technician_id;
        } else {
          // Leave unassigned if no technician specified
          assignedTechnicianId = null;
        }
      } else {
        // Technicians are automatically assigned to their own conversions
        assignedTechnicianId = req.user.id;
      }

      // Create warranty work order with WW- prefix but same number as ticket
      // Extract number and year from ticket's formatted_number (e.g., WT-73/25 -> 73/25)
      const numberAndYear = ticket.formatted_number.replace(/^[A-Z]+-/, ''); // Remove prefix
      const workOrderFormattedNumber = `WW-${numberAndYear}`; // Apply WW- prefix
      
      const workOrderQuery = `
        INSERT INTO warranty_work_orders (
          machine_id, customer_id, description, priority, 
          technician_id, owner_technician_id,
          ticket_number, converted_from_ticket_id,
          formatted_number, year_created
        ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const workOrderResult = await client.query(workOrderQuery, [
        ticket.machine_id,
        ticket.customer_id,
        description || ticket.problem_description,
        priority,
        assignedTechnicianId, // Assign based on role logic (used for both technician_id and owner_technician_id)
        ticket.ticket_number,
        ticket.id,
        workOrderFormattedNumber, // Apply WW- prefix with same number
        ticket.year_created // Preserve the same year
      ]);

      const workOrder = workOrderResult.rows[0];

      // Update the warranty repair ticket
      const updateTicketQuery = `
        UPDATE warranty_repair_tickets 
        SET status = 'converted', 
            converted_to_warranty_work_order_id = $1,
            converted_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      await client.query(updateTicketQuery, [workOrder.id, id]);

      await client.query('COMMIT');

      // Create notifications for ticket conversion and warranty work order creation
      try {
        console.log('Creating notifications for warranty repair ticket conversion:', id);
        
        // Only notify about ticket conversion to everyone except the user who converted it
        await createTicketNotification(id, 'converted', 'warranty_repair_ticket', req.user.id);
        
        // For work order creation, only notify if there's an assigned technician different from converter
        if (workOrder.technician_id && workOrder.technician_id !== req.user.id) {
          // Notify the assigned technician about work order assignment (not creation)
          await createNotification(
            workOrder.technician_id,
            'Warranty Work Order Assigned',
            `You have been assigned to warranty work order ${workOrder.formatted_number || `#${workOrder.id}`}`,
            'warranty_work_order',
            'warranty_work_order',
            workOrder.id
          );
        }
        
        // Notify all managers about warranty work order creation (except the converter)
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
          await createNotificationForManagers(
            'Warranty Work Order Created',
            `New warranty work order ${workOrder.formatted_number || `#${workOrder.id}`} has been created`,
            'warranty_work_order',
            'warranty_work_order',
            workOrder.id
          );
        }
        
        console.log('Notifications created successfully for warranty repair ticket conversion');
      } catch (notificationError) {
        console.error('Error creating notifications for warranty repair ticket conversion:', notificationError);
        // Don't fail the request if notification fails
      }

      res.json({
        status: 'success',
        data: {
          warranty_work_order: workOrder,
          message: 'Warranty repair ticket converted to warranty work order successfully'
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (err) {
    next(err);
  }
});

// GET machine categories
router.get('/machine-categories', authenticateToken, async (req, res, next) => {
  try {
    const query = 'SELECT * FROM machine_categories ORDER BY name';
    const result = await db.query(query);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET warranty periods
router.get('/warranty-periods', authenticateToken, async (req, res, next) => {
  try {
    const query = 'SELECT * FROM warranty_periods ORDER BY manufacturer, model_name';
    const result = await db.query(query);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
