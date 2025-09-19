const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validators');
const { createNotification } = require('../utils/notificationHelpers');

// Validation rules
const rentalMachineValidation = [
  body('model_id').isInt({ min: 1 }).withMessage('Valid model ID is required'),
  body('serial_number').isLength({ min: 1, max: 255 }).withMessage('Serial number is required and must be less than 255 characters'),
  body('rental_status').optional().isIn(['available', 'rented', 'reserved', 'maintenance', 'retired']).withMessage('Invalid rental status'),
  body('condition').optional().isIn(['excellent', 'good', 'fair', 'poor']).withMessage('Invalid condition'),
  body('location').optional().isString().withMessage('Location must be a string'),
  body('notes').optional().isString().withMessage('Notes must be a string')
];

// GET /api/rental-machines - Get all rental machines with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      condition = '',
      model_id = '',
      manufacturer = ''
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    // Build WHERE conditions
    if (search) {
      paramCount++;
      whereConditions.push(`(
        rm.serial_number ILIKE $${paramCount} OR 
        mm.name ILIKE $${paramCount} OR
        mm.manufacturer ILIKE $${paramCount} OR
        mm.catalogue_number ILIKE $${paramCount}
      )`);
      queryParams.push(`%${search}%`);
    }

    if (status && status !== 'all') {
      paramCount++;
      whereConditions.push(`rm.rental_status = $${paramCount}`);
      queryParams.push(status);
    }

    if (condition && condition !== 'all') {
      paramCount++;
      whereConditions.push(`rm.condition = $${paramCount}`);
      queryParams.push(condition);
    }

    if (model_id && model_id !== 'all') {
      paramCount++;
      whereConditions.push(`rm.model_id = $${paramCount}`);
      queryParams.push(model_id);
    }

    if (manufacturer && manufacturer !== 'all') {
      paramCount++;
      whereConditions.push(`mm.manufacturer ILIKE $${paramCount}`);
      queryParams.push(`%${manufacturer}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM rental_machines rm
      JOIN machine_models mm ON rm.model_id = mm.id
      ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get rental machines with pagination
    paramCount++;
    const limitParam = `$${paramCount}`;
    paramCount++;
    const offsetParam = `$${paramCount}`;
    queryParams.push(limit, offset);

    const machinesQuery = `
      SELECT 
        rm.*,
        mm.name as model_name,
        mm.manufacturer,
        mm.catalogue_number,
        mm.description as model_description,
        mm.warranty_months,
        mc.name as category_name,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM machine_rentals mr WHERE mr.rental_machine_id = rm.id) as rental_count
      FROM rental_machines rm
      JOIN machine_models mm ON rm.model_id = mm.id
      LEFT JOIN machine_categories mc ON mm.category_id = mc.id
      LEFT JOIN users u ON rm.created_by = u.id
      ${whereClause}
      ORDER BY rm.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;

    const machinesResult = await db.query(machinesQuery, queryParams);

    res.json({
      machines: machinesResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching rental machines:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-machines/available/list - Get all rental machines with rental info
router.get('/available/list', authenticateToken, async (req, res) => {
  try {
    const { model_id } = req.query;

    let whereClause = "WHERE 1=1";
    let queryParams = [];

    if (model_id) {
      whereClause += " AND rm.model_id = $1";
      queryParams.push(model_id);
    }

    const query = `
      SELECT 
        rm.*,
        mm.name as model_name,
        mm.manufacturer,
        mm.catalogue_number,
        mm.description as model_description,
        mc.name as category_name,
        mr.rental_end_date,
        mr.planned_return_date,
        mr.rental_status as current_rental_status,
        c.name as current_customer_name
      FROM rental_machines rm
      JOIN machine_models mm ON rm.model_id = mm.id
      LEFT JOIN machine_categories mc ON mm.category_id = mc.id
      LEFT JOIN machine_rentals mr ON rm.id = mr.rental_machine_id 
        AND mr.rental_status IN ('active', 'reserved')
        AND mr.id = (
          SELECT id FROM machine_rentals mr2 
          WHERE mr2.rental_machine_id = rm.id 
            AND mr2.rental_status IN ('active', 'reserved')
          ORDER BY mr2.created_at DESC 
          LIMIT 1
        )
      LEFT JOIN customers c ON mr.customer_id = c.id
      ${whereClause}
      ORDER BY mm.manufacturer, mm.name, rm.serial_number
    `;

    const result = await db.query(query, queryParams);
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching rental machines:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-machines/:id - Get single rental machine
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        rm.*,
        mm.name as model_name,
        mm.manufacturer,
        mm.catalogue_number,
        mm.description as model_description,
        mm.warranty_months,
        mc.name as category_name,
        u.name as created_by_name
      FROM rental_machines rm
      JOIN machine_models mm ON rm.model_id = mm.id
      LEFT JOIN machine_categories mc ON mm.category_id = mc.id
      LEFT JOIN users u ON rm.created_by = u.id
      WHERE rm.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Rental machine not found' });
    }

    // Get rental history for this machine
    const rentalHistoryQuery = `
      SELECT 
        mr.*,
        c.name as customer_name,
        c.company_name as customer_company
      FROM machine_rentals mr
      JOIN customers c ON mr.customer_id = c.id
      WHERE mr.rental_machine_id = $1
      ORDER BY mr.created_at DESC
    `;

    const rentalHistory = await db.query(rentalHistoryQuery, [id]);

    res.json({
      ...result.rows[0],
      rental_history: rentalHistory.rows
    });

  } catch (error) {
    console.error('Error fetching rental machine:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/rental-machines - Create new rental machine
router.post('/', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), rentalMachineValidation, handleValidationErrors, async (req, res) => {
  try {
    const {
      model_id,
      serial_number,
      rental_status = 'available',
      condition = 'good',
      location,
      notes
    } = req.body;

    // Check if model exists
    const modelCheck = await db.query(
      'SELECT id FROM machine_models WHERE id = $1',
      [model_id]
    );

    if (modelCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Machine model not found' });
    }

    // Check if serial number already exists for this model
    const serialCheck = await db.query(
      'SELECT id FROM rental_machines WHERE model_id = $1 AND serial_number = $2',
      [model_id, serial_number]
    );

    if (serialCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Serial number already exists for this model' });
    }

    // Create rental machine
    const insertQuery = `
      INSERT INTO rental_machines (
        model_id, serial_number, rental_status, condition, location, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      model_id, serial_number, rental_status, condition, location, notes, req.user.id
    ]);

    // Create notification
    await createNotification(
      req.user.id,
      'New Rental Machine Added',
      `Rental machine ${serial_number} added to fleet`,
      'rental',
      'rental_machine',
      result.rows[0].id
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error('Error creating rental machine:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/rental-machines/:id - Update rental machine
router.put('/:id', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), rentalMachineValidation, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      model_id,
      serial_number,
      rental_status,
      condition,
      location,
      notes
    } = req.body;

    // Check if rental machine exists
    const existingMachine = await db.query(
      'SELECT * FROM rental_machines WHERE id = $1',
      [id]
    );

    if (existingMachine.rows.length === 0) {
      return res.status(404).json({ message: 'Rental machine not found' });
    }

    // Check if serial number already exists for this model (excluding current machine)
    if (serial_number !== existingMachine.rows[0].serial_number) {
      const serialCheck = await db.query(
        'SELECT id FROM rental_machines WHERE model_id = $1 AND serial_number = $2 AND id != $3',
        [model_id, serial_number, id]
      );

      if (serialCheck.rows.length > 0) {
        return res.status(400).json({ message: 'Serial number already exists for this model' });
      }
    }

    // Update rental machine
    const updateQuery = `
      UPDATE rental_machines SET
        model_id = $1,
        serial_number = $2,
        rental_status = $3,
        condition = $4,
        location = $5,
        notes = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;

    const result = await db.query(updateQuery, [
      model_id, serial_number, rental_status, condition, location, notes, id
    ]);

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error updating rental machine:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/rental-machines/:id - Delete rental machine
router.delete('/:id', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Check if rental machine exists
    const existingMachine = await client.query(
      'SELECT id FROM rental_machines WHERE id = $1',
      [id]
    );

    if (existingMachine.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Rental machine not found' });
    }

    // Check for active rentals
    const activeRentals = await client.query(
      'SELECT COUNT(*) as count FROM machine_rentals WHERE rental_machine_id = $1 AND rental_status = $2',
      [id, 'active']
    );

    if (parseInt(activeRentals.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        message: 'Cannot delete rental machine with active rentals. Please return all active rentals first.' 
      });
    }

    // Delete rental machine (this will cascade delete related rentals due to foreign key)
    await client.query('DELETE FROM rental_machines WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({ message: 'Rental machine deleted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting rental machine:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/rental-machines/stats - Get rental machine statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_machines,
        COUNT(CASE WHEN rental_status = 'available' THEN 1 END) as available_machines,
        COUNT(CASE WHEN rental_status = 'rented' THEN 1 END) as rented_machines,
        COUNT(CASE WHEN rental_status = 'reserved' THEN 1 END) as reserved_machines,
        COUNT(CASE WHEN rental_status = 'maintenance' THEN 1 END) as maintenance_machines,
        COUNT(CASE WHEN rental_status = 'retired' THEN 1 END) as retired_machines,
        COUNT(CASE WHEN condition = 'excellent' THEN 1 END) as excellent_condition,
        COUNT(CASE WHEN condition = 'good' THEN 1 END) as good_condition,
        COUNT(CASE WHEN condition = 'fair' THEN 1 END) as fair_condition,
        COUNT(CASE WHEN condition = 'poor' THEN 1 END) as poor_condition
      FROM rental_machines
    `;

    const result = await db.query(statsQuery);
    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error fetching rental machine stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
