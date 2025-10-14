const express = require('express')
const router = express.Router()
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { body, validationResult } = require('express-validator')
const db = require('../db')
const { createTicketNotification, createWorkOrderNotification, createNotification, createNotificationForManagers } = require('../utils/notificationHelpers');
const { logCustomAction } = require('../utils/actionLogger');
const { buildSmartSearchConditions } = require('../utils/searchUtils');

// GET all repair tickets with pagination and filters
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const offset = (page - 1) * limit
    const search = req.query.search
    const status = req.query.status
    const priority = req.query.priority
    const customerId = req.query.customer_id
    const machineId = req.query.machine_id
    const technicianId = req.query.technician_id
    const submittedBy = req.query.submitted_by
    const year = req.query.year

    let whereConditions = []
    let queryParams = []

    if (search) {
      const { condition, params: searchParams } = buildSmartSearchConditions(search, 'repairTickets', queryParams.length + 1);
      if (condition) {
        whereConditions.push(`(${condition})`);
        queryParams.push(...searchParams);
      }
    }

    if (status) {
      whereConditions.push(`rt.status = $${queryParams.length + 1}`)
      queryParams.push(status)
    }

    if (priority) {
      whereConditions.push(`rt.priority = $${queryParams.length + 1}`)
      queryParams.push(priority)
    }

    if (customerId) {
      whereConditions.push(`rt.customer_id = $${queryParams.length + 1}`)
      queryParams.push(customerId)
    }

    if (machineId) {
      whereConditions.push(`rt.machine_id = $${queryParams.length + 1}`)
      queryParams.push(machineId)
    }

    if (technicianId) {
      if (technicianId === 'unassigned') {
        whereConditions.push(`(rt.converted_by_technician_id IS NULL OR rt.converted_by_technician_id = '')`)
      } else {
        whereConditions.push(`(rt.converted_by_technician_id = $${queryParams.length + 1} OR rt.submitted_by = $${queryParams.length + 1})`)
        queryParams.push(technicianId)
      }
    }

    if (submittedBy) {
      whereConditions.push(`rt.submitted_by = $${queryParams.length + 1}`)
      queryParams.push(submittedBy)
    }

    if (year) {
      whereConditions.push(`rt.year_created = $${queryParams.length + 1}`)
      queryParams.push(parseInt(year))
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Get total count using the new view
    const countQuery = `
      SELECT COUNT(*) 
      FROM repair_tickets_view rt
      ${whereClause}
    `
    const countResult = await db.query(countQuery, queryParams)
    const total = parseInt(countResult.rows[0].count)

    // Get tickets with pagination using the new view
    const query = `
      SELECT * FROM repair_tickets_view rt
      ${whereClause}
      ORDER BY rt.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    next(error)
  }
})

// GET available years (for year filter dropdown)
router.get('/filter/years', authenticateToken, async (req, res, next) => {
  try {
    const query = `
      SELECT DISTINCT year_created 
      FROM repair_tickets 
      WHERE year_created IS NOT NULL 
      ORDER BY year_created DESC
    `
    const result = await db.query(query)
    const years = result.rows.map(row => row.year_created)
    res.json({ data: years })
  } catch (error) {
    next(error)
  }
})

// GET repair ticket by ID
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    
    const query = `
      SELECT * FROM repair_tickets_view rt
      WHERE rt.id = $1
    `
    
    const result = await db.query(query, [id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Repair ticket not found' })
    }

    res.json({ data: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

// POST create new repair ticket
router.post('/', authenticateToken, [
  body('problem_description').notEmpty().withMessage('Problem description is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation error', errors: errors.array() })
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
      machine_model_type, // Added for new machine model type
      
      // Ticket fields
      problem_description,
      notes,
      additional_equipment,
      brought_by,
      priority
    } = req.body

    const submitted_by = req.user.id

    // Start database transaction
    const client = await db.connect()

    try {
      await client.query('BEGIN')

      let finalCustomerId = customer_id
      let finalMachineId = machine_id

      // Validate machine_id if provided
      if (finalMachineId) {
        const machineCheck = await client.query(
          'SELECT id FROM assigned_machines WHERE id = $1',
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
        // Serial number is optional for repair tickets - allow NULL values
        // Convert empty strings to null
        const finalSerialNumber = machine_serial_number && machine_serial_number.trim() !== '' ? machine_serial_number.trim() : null

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

        let serialId = null
        
        // Only check and create serial if we have one
        if (finalSerialNumber) {
          // Check if serial number already exists
          const existingSerialResult = await client.query(
            `SELECT id FROM machine_serials WHERE serial_number = $1`,
            [finalSerialNumber]
          )
          
          if (existingSerialResult.rows.length > 0) {
            await client.query('ROLLBACK')
            client.release()
            return res.status(400).json({
              status: 'fail',
              message: 'Serial number already exists'
            })
          }

          // Create machine serial
          const serialResult = await client.query(
            `INSERT INTO machine_serials (
              model_id, serial_number
            ) VALUES ($1, $2)
            RETURNING id`,
            [modelId, finalSerialNumber]
          )
          serialId = serialResult.rows[0].id
        }

        // Calculate warranty expiry date
        let warrantyExpiryDate = null
        if (machine_purchase_date) {
          const warrantyResult = await client.query(
            `SELECT calculate_warranty_expiry($1, $2) as expiry_date`,
            [machine_purchase_date, modelId]
          )
          warrantyExpiryDate = warrantyResult.rows[0].expiry_date
        }

        // Assign machine to customer
        const assignedMachineResult = await client.query(
          `INSERT INTO assigned_machines (
            serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, receipt_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id`,
          [
            serialId,
            finalCustomerId,
            machine_purchase_date || null,
            warrantyExpiryDate,
            true, // Default to warranty active
            machine_bought_at || null,
            machine_receipt_number || null
          ]
        )
        
        finalMachineId = assignedMachineResult.rows[0].id
      }

      if (!finalCustomerId || !finalMachineId) {
        await client.query('ROLLBACK')
        client.release()
        return res.status(400).json({
          status: 'fail',
          message: 'Failed to create customer or machine'
        })
      }

             // Create the repair ticket
       const ticketQuery = `
         INSERT INTO repair_tickets (
           customer_id, machine_id, description, problem_description, notes, 
           additional_equipment, submitted_by, brought_by, priority
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *
       `

       const ticketResult = await client.query(ticketQuery, [
         finalCustomerId,
         finalMachineId,
         problem_description, // Use problem_description as the description
         problem_description,
         notes || null,
         additional_equipment || null,
         submitted_by,
         brought_by || null,
         priority
       ])

      const ticket = ticketResult.rows[0]

      // Create notification for new repair ticket
      try {
        console.log('Creating notification for repair ticket:', ticket.id);
        await createTicketNotification(ticket.id, 'created', 'repair_ticket', submitted_by);
        console.log('Notification created successfully for repair ticket');
      } catch (notificationError) {
        console.error('Error creating notification for repair ticket:', notificationError);
        // Don't fail the request if notification fails
      }

      await client.query('COMMIT')

      // Get the full ticket with customer and machine info
      const fullTicketQuery = `
        SELECT * FROM repair_tickets_view rt
        WHERE rt.id = $1
      `
      
      const fullTicketResult = await db.query(fullTicketQuery, [ticket.id])
      const fullTicket = fullTicketResult.rows[0]

      // Log action
      await logCustomAction(req, 'create', 'repair_ticket', ticket.id, fullTicket.formatted_number || `RT-${ticket.id}`, {
        customer_name: fullTicket.customer_name,
        machine_serial: fullTicket.serial_number,
        priority: priority
      });

      res.status(201).json({
        status: 'success',
        data: fullTicket
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    next(error)
  }
})

// PUT update repair ticket
router.put('/:id', authenticateToken, [
  body('problem_description').optional().notEmpty().withMessage('Problem description cannot be empty'),
  body('notes').optional().isString(),
  body('additional_equipment').optional().isString(),
  body('brought_by').optional().isString(),
  body('status').optional().isIn(['intake', 'converted', 'cancelled']).withMessage('Invalid status')
], async (req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation error', errors: errors.array() })
    }

    const { id } = req.params
    const {
      problem_description,
      notes,
      additional_equipment,
      brought_by,
      status
    } = req.body

    // Check if ticket exists and get current data
    const existingQuery = 'SELECT * FROM repair_tickets WHERE id = $1'
    const existingResult = await db.query(existingQuery, [id])
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: 'Repair ticket not found' })
    }

    const currentTicket = existingResult.rows[0]

    // Build update query dynamically
    const updateFields = []
    const updateValues = []
    let paramCount = 0

    if (problem_description !== undefined) {
      paramCount++
      updateFields.push(`problem_description = $${paramCount}`)
      updateValues.push(problem_description)
    }

    if (notes !== undefined) {
      paramCount++
      updateFields.push(`notes = $${paramCount}`)
      updateValues.push(notes)
    }

    if (additional_equipment !== undefined) {
      paramCount++
      updateFields.push(`additional_equipment = $${paramCount}`)
      updateValues.push(additional_equipment)
    }

    if (brought_by !== undefined) {
      paramCount++
      updateFields.push(`brought_by = $${paramCount}`)
      updateValues.push(brought_by)
    }

    if (status !== undefined) {
      paramCount++
      updateFields.push(`status = $${paramCount}`)
      updateValues.push(status)
      
      // If converting to converted status, set converted_at
      if (status === 'converted' && currentTicket.status !== 'converted') {
        paramCount++
        updateFields.push(`converted_at = $${paramCount}`)
        updateValues.push(new Date())
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' })
    }

    paramCount++
    updateFields.push(`updated_at = $${paramCount}`)
    updateValues.push(new Date())
    updateValues.push(id)

    const query = `
      UPDATE repair_tickets 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount + 1}
      RETURNING *
    `

    const result = await db.query(query, updateValues)

    // Get the full updated ticket
    const fullTicketQuery = `
      SELECT * FROM repair_tickets_view rt
      WHERE rt.id = $1
    `
    
    const fullTicketResult = await db.query(fullTicketQuery, [id])
    const fullTicket = fullTicketResult.rows[0]

    // Log action
    await logCustomAction(req, 'update', 'repair_ticket', id, fullTicket.formatted_number || `RT-${id}`, {
      updated_fields: Object.keys(req.body),
      status_change: status && status !== currentTicket.status ? { from: currentTicket.status, to: status } : null
    });

    res.json({
      status: 'success',
      data: fullTicket
    })
  } catch (error) {
    next(error)
  }
})

// DELETE repair ticket
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params

    // Check if ticket exists and can be deleted
    const existingQuery = 'SELECT status FROM repair_tickets WHERE id = $1'
    const existingResult = await db.query(existingQuery, [id])
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ message: 'Repair ticket not found' })
    }

    const ticket = existingResult.rows[0]
    
    // Only allow deletion if ticket is in intake status
    if (ticket.status !== 'intake') {
      return res.status(400).json({ message: 'Cannot delete ticket that has been converted or cancelled' })
    }

    // Get full ticket details before deletion
    const fullTicketQuery = 'SELECT * FROM repair_tickets_view WHERE id = $1'
    const fullTicketResult = await db.query(fullTicketQuery, [id])
    const fullTicket = fullTicketResult.rows[0]

    // Log action before deletion
    await logCustomAction(req, 'delete', 'repair_ticket', id, fullTicket?.formatted_number || `RT-${id}`, {
      customer_name: fullTicket?.customer_name,
      machine_serial: fullTicket?.serial_number
    });

    const query = 'DELETE FROM repair_tickets WHERE id = $1 RETURNING *'
    const result = await db.query(query, [id])

    res.json({
      status: 'success',
      message: 'Repair ticket deleted successfully'
    })
  } catch (error) {
    next(error)
  }
})

// POST convert repair ticket to work order
router.post('/:id/convert', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const { description, priority, technician_id } = req.body

    // Start a transaction
    const client = await db.connect()
    
    try {
      await client.query('BEGIN')

      // Get the repair ticket directly from the table to avoid view issues
      const ticketQuery = `
        SELECT rt.*, c.name as customer_name, mm.manufacturer, mm.name as model_name
        FROM repair_tickets rt
        LEFT JOIN customers c ON rt.customer_id = c.id
        LEFT JOIN assigned_machines am ON rt.machine_id = am.id
        LEFT JOIN machine_serials ms ON am.serial_id = ms.id
        LEFT JOIN machine_models mm ON ms.model_id = mm.id
        WHERE rt.id = $1
      `
      const ticketResult = await client.query(ticketQuery, [id])
      
      if (ticketResult.rows.length === 0) {
        throw new Error('Repair ticket not found')
      }

      const ticket = ticketResult.rows[0]
      
      if (ticket.status !== 'intake') {
        throw new Error('Ticket cannot be converted - not in intake status')
      }

      // Determine who should be assigned to the work order
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

      // Create work order with WO- prefix but same number as ticket
      // Extract number and year from ticket's formatted_number (e.g., TK-73/25 -> 73/25)
      const numberAndYear = ticket.formatted_number.replace(/^[A-Z]+-/, ''); // Remove prefix
      const workOrderFormattedNumber = `WO-${numberAndYear}`; // Apply WO- prefix
      
      const workOrderQuery = `
        INSERT INTO work_orders (
          machine_id, customer_id, description, priority, 
          technician_id, owner_technician_id,
          ticket_number, converted_from_ticket_id, converted_by_user_id,
          formatted_number, year_created
        ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `
      
      const workOrderResult = await client.query(workOrderQuery, [
        ticket.machine_id,
        ticket.customer_id,
        description || ticket.problem_description,
        priority || ticket.priority || 'medium', // Use provided priority, or ticket priority, or default to medium
        assignedTechnicianId, // Assign based on role logic (used for both technician_id and owner_technician_id)
        ticket.ticket_number, // Use the same ticket number from the table
        ticket.id,
        req.user.id, // Track who converted it
        workOrderFormattedNumber, // Apply WO- prefix with same number
        ticket.year_created // Preserve the same year
      ])

      const workOrder = workOrderResult.rows[0]

      // Update the repair ticket
      const updateTicketQuery = `
        UPDATE repair_tickets 
        SET status = 'converted', 
            converted_at = NOW(),
            converted_to_work_order_id = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `
      
      await client.query(updateTicketQuery, [workOrder.id, id])

      await client.query('COMMIT')

      // Create notifications for ticket conversion and work order creation
      try {
        console.log('Creating notification for repair ticket conversion:', id);
        
        // Only notify about ticket conversion to everyone except the user who converted it
        await createTicketNotification(id, 'converted', 'repair_ticket', req.user.id);
        
        // For work order creation, only notify if there's an assigned technician different from converter
        if (workOrder.technician_id && workOrder.technician_id !== req.user.id) {
          // Notify the assigned technician about work order assignment (not creation)
          await createNotification(
            workOrder.technician_id,
            'Work Order Assigned',
            `You have been assigned to work order ${workOrder.formatted_number || `#${workOrder.id}`}`,
            'work_order',
            'work_order',
            workOrder.id
          );
        }
        
        // Notify all managers about work order creation (except the converter)
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
          await createNotificationForManagers(
            'Work Order Created',
            `New work order ${workOrder.formatted_number || `#${workOrder.id}`} has been created`,
            'work_order',
            'work_order',
            workOrder.id
          );
        }
        
        console.log('Notifications created successfully for repair ticket conversion');
      } catch (notificationError) {
        console.error('Error creating notifications for repair ticket conversion:', notificationError);
        // Don't fail the request if notification fails
      }

      // Log conversion action
      await logCustomAction(req, 'convert', 'repair_ticket', id, ticket.formatted_number || `RT-${id}`, {
        converted_to: 'work_order',
        work_order_id: workOrder.id,
        work_order_number: workOrder.formatted_number,
        technician_id: technician_id
      });

      res.json({
        status: 'success',
        data: {
          work_order: workOrder,
          message: 'Repair ticket converted to work order successfully'
        }
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    next(error)
  }
})

module.exports = router
