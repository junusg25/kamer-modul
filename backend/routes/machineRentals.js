const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validators');
const { createNotification } = require('../utils/notificationHelpers');
const { logCustomAction } = require('../utils/actionLogger');

// Validation rules
const rentalValidation = [
  body('rental_machine_id').isInt({ min: 1 }).withMessage('Valid rental machine ID is required'),
  body('customer_id').isInt({ min: 1 }).withMessage('Valid customer ID is required'),
  body('rental_start_date').isISO8601().withMessage('Valid start date is required'),
  body('rental_end_date').optional().isISO8601().withMessage('Valid end date is required'),
  body('planned_return_date').optional().isISO8601().withMessage('Valid planned return date is required'),
  body('rental_status').optional().isIn(['active', 'reserved', 'returned', 'overdue', 'cancelled']).withMessage('Invalid rental status'),
  body('price_per_day').optional().isFloat({ min: 0 }).withMessage('Price per day must be a positive number'),
  body('price_per_week').optional().isFloat({ min: 0 }).withMessage('Price per week must be a positive number'),
  body('price_per_month').optional().isFloat({ min: 0 }).withMessage('Price per month must be a positive number'),
  body('billing_period').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid billing period'),
  body('total_amount').optional().isFloat({ min: 0 }).withMessage('Total amount must be a positive number'),
  body('maintenance_reminder_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Valid maintenance reminder date is required'),
  body('rental_notes').optional().isString().withMessage('Rental notes must be a string')
];

// GET /api/machine-rentals - Get all machine rentals with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      customer_id = '',
      rental_machine_id = '',
      start_date = '',
      end_date = ''
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    // Build WHERE conditions
    if (search) {
      paramCount++;
      whereConditions.push(`(
        c.name ILIKE $${paramCount} OR 
        c.company_name ILIKE $${paramCount} OR
        rm.serial_number ILIKE $${paramCount} OR
        mm.name ILIKE $${paramCount} OR
        mm.manufacturer ILIKE $${paramCount}
      )`);
      queryParams.push(`%${search}%`);
    }

    if (status && status !== 'all') {
      paramCount++;
      whereConditions.push(`mr.rental_status = $${paramCount}`);
      queryParams.push(status);
    }

    if (customer_id && customer_id !== 'all') {
      paramCount++;
      whereConditions.push(`mr.customer_id = $${paramCount}`);
      queryParams.push(customer_id);
    }

    if (rental_machine_id && rental_machine_id !== 'all') {
      paramCount++;
      whereConditions.push(`mr.rental_machine_id = $${paramCount}`);
      queryParams.push(rental_machine_id);
    }

    if (start_date) {
      paramCount++;
      whereConditions.push(`mr.rental_start_date >= $${paramCount}`);
      queryParams.push(start_date);
    }

    if (end_date) {
      paramCount++;
      whereConditions.push(`mr.rental_end_date <= $${paramCount}`);
      queryParams.push(end_date);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM machine_rentals mr
      JOIN customers c ON mr.customer_id = c.id
      JOIN rental_machines rm ON mr.rental_machine_id = rm.id
      JOIN machine_models mm ON rm.model_id = mm.id
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get rentals with pagination
    paramCount++;
    const limitParam = `$${paramCount}`;
    paramCount++;
    const offsetParam = `$${paramCount}`;
    queryParams.push(limit, offset);

    const rentalsQuery = `
      SELECT 
        mr.*,
        c.name as customer_name,
        c.company_name as customer_company,
        c.email as customer_email,
        c.phone as customer_phone,
        rm.serial_number as machine_serial,
        rm.condition as machine_condition,
        mm.name as machine_model_name,
        mm.manufacturer as machine_manufacturer,
        mm.catalogue_number as machine_catalogue_number,
        u.name as created_by_name
      FROM machine_rentals mr
      JOIN customers c ON mr.customer_id = c.id
      JOIN rental_machines rm ON mr.rental_machine_id = rm.id
      JOIN machine_models mm ON rm.model_id = mm.id
      LEFT JOIN users u ON mr.created_by = u.id
      ${whereClause}
      ORDER BY mr.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const rentalsResult = await db.query(rentalsQuery, queryParams);

    res.json({
      rentals: rentalsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching machine rentals:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/machine-rentals/:id - Get single machine rental
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        mr.*,
        c.name as customer_name,
        c.company_name as customer_company,
        c.email as customer_email,
        c.phone as customer_phone,
        c.street_address as customer_address,
        c.city as customer_city,
        c.postal_code as customer_postal_code,
        rm.serial_number as machine_serial,
        rm.condition as machine_condition,
        rm.location as machine_location,
        rm.notes as machine_notes,
        mm.name as machine_model_name,
        mm.manufacturer as machine_manufacturer,
        mm.catalogue_number as machine_catalogue_number,
        mm.description as machine_model_description,
        u.name as created_by_name
      FROM machine_rentals mr
      JOIN customers c ON mr.customer_id = c.id
      JOIN rental_machines rm ON mr.rental_machine_id = rm.id
      JOIN machine_models mm ON rm.model_id = mm.id
      LEFT JOIN users u ON mr.created_by = u.id
      WHERE mr.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Machine rental not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error fetching machine rental:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/machine-rentals - Create new machine rental
router.post('/', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), rentalValidation, handleValidationErrors, async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');

    const {
      rental_machine_id,
      customer_id,
      rental_start_date,
      rental_end_date,
      planned_return_date,
      rental_status = 'active',
      price_per_day,
      price_per_week,
      price_per_month,
      billing_period = 'monthly',
      total_amount,
      maintenance_reminder_date,
      rental_notes
    } = req.body;

    // Check if rental machine exists and get current rental info
    const machineCheck = await client.query(`
      SELECT 
        rm.id, 
        rm.rental_status,
        mr.rental_end_date,
        mr.planned_return_date,
        mr.rental_status as current_rental_status
      FROM rental_machines rm
      LEFT JOIN machine_rentals mr ON rm.id = mr.rental_machine_id 
        AND mr.rental_status IN ('active', 'reserved')
      WHERE rm.id = $1
    `, [rental_machine_id]);

    if (machineCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Rental machine not found' });
    }

    const machine = machineCheck.rows[0];
    const isCurrentlyRented = machine.current_rental_status === 'active' || machine.current_rental_status === 'reserved';
    
    // If machine is currently rented, validate start date
    if (isCurrentlyRented) {
      const returnDate = machine.rental_end_date || machine.planned_return_date;
      if (returnDate && new Date(rental_start_date) < new Date(returnDate)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: `Start date must be on or after the return date (${returnDate})` 
        });
      }
    }

    // Check if customer exists
    const customerCheck = await client.query(
      'SELECT id FROM customers WHERE id = $1',
      [customer_id]
    );

    if (customerCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Create rental
    const insertQuery = `
      INSERT INTO machine_rentals (
        rental_machine_id, customer_id, rental_start_date, rental_end_date,
        planned_return_date, rental_status, price_per_day, price_per_week,
        price_per_month, billing_period, total_amount, maintenance_reminder_date,
        rental_notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      rental_machine_id, customer_id, rental_start_date, rental_end_date,
      planned_return_date, rental_status, price_per_day, price_per_week,
      price_per_month, billing_period, total_amount, maintenance_reminder_date,
      rental_notes, req.user.id
    ]);

    // Update rental machine status to 'rented'
    // Update rental machine status based on rental status
    const newMachineStatus = rental_status === 'reserved' ? 'reserved' : 'rented';
    await client.query(
      'UPDATE rental_machines SET rental_status = $1 WHERE id = $2',
      [newMachineStatus, rental_machine_id]
    );

    await client.query('COMMIT');

    // Get customer name for notification
    const customerResult = await client.query(
      'SELECT name FROM customers WHERE id = $1',
      [customer_id]
    );
    const customerName = customerResult.rows[0]?.name || `Customer ID ${customer_id}`;

    // Create notification
    await createNotification(
      req.user.id,
      'New Machine Rental Created',
      `Machine rental created for ${customerName}`,
      'rental',
      'machine_rental',
      result.rows[0].id
    );

    const rental = result.rows[0];

    // Log action
    await logCustomAction(req, 'create', 'machine_rental', rental.id, `Rental for ${customerName}`, {
      customer_id: customer_id,
      customer_name: customerName,
      rental_status: rental_status,
      billing_period: billing_period,
      total_amount: total_amount
    });

    res.status(201).json(rental);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating machine rental:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/machine-rentals/:id - Update machine rental
router.put('/:id', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), rentalValidation, handleValidationErrors, async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      rental_machine_id,
      customer_id,
      rental_start_date,
      rental_end_date,
      planned_return_date,
      rental_status,
      price_per_day,
      price_per_week,
      price_per_month,
      billing_period,
      total_amount,
      maintenance_reminder_date,
      rental_notes
    } = req.body;

    // Check if rental exists
    const existingRental = await client.query(
      'SELECT * FROM machine_rentals WHERE id = $1',
      [id]
    );

    if (existingRental.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Machine rental not found' });
    }

    // Update rental
    const updateQuery = `
      UPDATE machine_rentals SET
        rental_machine_id = $1,
        customer_id = $2,
        rental_start_date = $3,
        rental_end_date = $4,
        planned_return_date = $5,
        rental_status = $6,
        price_per_day = $7,
        price_per_week = $8,
        price_per_month = $9,
        billing_period = $10,
        total_amount = $11,
        maintenance_reminder_date = $12,
        rental_notes = $13,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING *
    `;

    const result = await client.query(updateQuery, [
      rental_machine_id, customer_id, rental_start_date, rental_end_date,
      planned_return_date, rental_status, price_per_day, price_per_week,
      price_per_month, billing_period, total_amount, maintenance_reminder_date,
      rental_notes, id
    ]);

    // Get the old rental status to check if we need to activate reserved rentals
    const oldRentalStatus = existingRental.rows[0].rental_status;

    // Update rental machine status if needed
    if (rental_status === 'returned' || rental_status === 'cancelled') {
      // Check if there are any reserved rentals for this machine that should become active
      const reservedRentals = await client.query(
        `SELECT id, customer_id, rental_start_date 
         FROM machine_rentals 
         WHERE rental_machine_id = $1 
           AND rental_status = 'reserved' 
           AND rental_start_date <= CURRENT_DATE
         ORDER BY rental_start_date ASC
         LIMIT 1`,
        [rental_machine_id]
      );

      if (reservedRentals.rows.length > 0) {
        // Activate the next reserved rental
        const nextRental = reservedRentals.rows[0];
        await client.query(
          'UPDATE machine_rentals SET rental_status = $1 WHERE id = $2',
          ['active', nextRental.id]
        );

        // Update rental machine status to rented
        await client.query(
          'UPDATE rental_machines SET rental_status = $1 WHERE id = $2',
          ['rented', rental_machine_id]
        );

        // Create notification for the customer
        const customerResult = await client.query(
          'SELECT name FROM customers WHERE id = $1',
          [nextRental.customer_id]
        );
        const customerName = customerResult.rows[0]?.name || `Customer ID ${nextRental.customer_id}`;

        await createNotification(
          req.user.id,
          'Rental Activated',
          `Your reserved rental for machine has been automatically activated`,
          'rental',
          'machine_rental',
          nextRental.id
        );
      } else {
        // No reserved rentals to activate, set machine to available
        await client.query(
          'UPDATE rental_machines SET rental_status = $1 WHERE id = $2',
          ['available', rental_machine_id]
        );
      }
    } else if (rental_status === 'active') {
      await client.query(
        'UPDATE rental_machines SET rental_status = $1 WHERE id = $2',
        ['rented', rental_machine_id]
      );
    } else if (rental_status === 'reserved') {
      // If changing to reserved, only update machine status if it was previously active
      if (oldRentalStatus === 'active') {
        await client.query(
          'UPDATE rental_machines SET rental_status = $1 WHERE id = $2',
          ['reserved', rental_machine_id]
        );
      }
    }

    await client.query('COMMIT');

    const rental = result.rows[0];

    // Log action
    await logCustomAction(req, 'update', 'machine_rental', id, `Rental #${id}`, {
      rental_status: rental_status,
      status_change: rental_status !== oldRentalStatus ? { from: oldRentalStatus, to: rental_status } : null
    });

    res.json(rental);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating machine rental:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/machine-rentals/:id - Delete machine rental
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Check if rental exists
    const existingRental = await client.query(
      'SELECT rental_machine_id FROM machine_rentals WHERE id = $1',
      [id]
    );

    if (existingRental.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Machine rental not found' });
    }

    const rentalMachineId = existingRental.rows[0].rental_machine_id;

    // Get full rental details before deletion
    const rentalDetails = await client.query(
      `SELECT mr.*, c.name as customer_name 
       FROM machine_rentals mr
       LEFT JOIN customers c ON mr.customer_id = c.id
       WHERE mr.id = $1`,
      [id]
    );
    const rental = rentalDetails.rows[0];

    // Log action before deletion
    await logCustomAction(req, 'delete', 'machine_rental', id, `Rental #${id}`, {
      customer_name: rental.customer_name,
      rental_status: rental.rental_status
    });

    // Delete rental
    await client.query('DELETE FROM machine_rentals WHERE id = $1', [id]);

    // Check if there are any reserved rentals for this machine that should become active
    const reservedRentals = await client.query(
      `SELECT id, customer_id, rental_start_date 
       FROM machine_rentals 
       WHERE rental_machine_id = $1 
         AND rental_status = 'reserved' 
         AND rental_start_date <= CURRENT_DATE
       ORDER BY rental_start_date ASC
       LIMIT 1`,
      [rentalMachineId]
    );

    if (reservedRentals.rows.length > 0) {
      // Activate the next reserved rental
      const nextRental = reservedRentals.rows[0];
      await client.query(
        'UPDATE machine_rentals SET rental_status = $1 WHERE id = $2',
        ['active', nextRental.id]
      );

      // Update rental machine status to rented
      await client.query(
        'UPDATE rental_machines SET rental_status = $1 WHERE id = $2',
        ['rented', rentalMachineId]
      );

      // Create notification for the customer
      const customerResult = await client.query(
        'SELECT name FROM customers WHERE id = $1',
        [nextRental.customer_id]
      );
      const customerName = customerResult.rows[0]?.name || `Customer ID ${nextRental.customer_id}`;

      await createNotification(
        req.user.id,
        'Rental Activated',
        `Your reserved rental for machine has been automatically activated`,
        'rental',
        'machine_rental',
        nextRental.id
      );
    } else {
      // No reserved rentals to activate, set machine to available
      await client.query(
        'UPDATE rental_machines SET rental_status = $1 WHERE id = $2',
        ['available', rentalMachineId]
      );
    }

    await client.query('COMMIT');

    res.json({ message: 'Machine rental deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting machine rental:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/machine-rentals/stats - Get rental statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_rentals,
        COUNT(CASE WHEN rental_status = 'active' THEN 1 END) as active_rentals,
        COUNT(CASE WHEN rental_status = 'returned' THEN 1 END) as returned_rentals,
        COUNT(CASE WHEN rental_status = 'overdue' THEN 1 END) as overdue_rentals,
        COUNT(CASE WHEN rental_status = 'cancelled' THEN 1 END) as cancelled_rentals,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as average_rental_value
      FROM machine_rentals
    `;

    const result = await db.query(statsQuery);
    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error fetching rental stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/machine-rentals/overdue - Get overdue rentals
router.get('/overdue/list', authenticateToken, async (req, res) => {
  try {
    const overdueQuery = `
      SELECT 
        mr.*,
        c.name as customer_name,
        c.company_name as customer_company,
        c.phone as customer_phone,
        rm.serial_number as machine_serial,
        mm.name as machine_model_name,
        mm.manufacturer as machine_manufacturer
      FROM machine_rentals mr
      JOIN customers c ON mr.customer_id = c.id
      JOIN rental_machines rm ON mr.rental_machine_id = rm.id
      JOIN machine_models mm ON rm.model_id = mm.id
      WHERE mr.rental_status = 'active' 
        AND mr.planned_return_date < CURRENT_DATE
      ORDER BY mr.planned_return_date ASC
    `;

    const result = await db.query(overdueQuery);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching overdue rentals:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
