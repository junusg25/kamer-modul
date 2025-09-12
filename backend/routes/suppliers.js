const express = require('express');
const router = express.Router();
const db = require('../db');
const { handleValidationErrors } = require('../middleware/validators');
const { body, param } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

// GET /api/suppliers - Get all suppliers
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { search, category } = req.query;

    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(s.name ILIKE $${paramIndex} OR s.email ILIKE $${paramIndex} OR s.phone ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      whereConditions.push(`s.category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const result = await db.query(
      `SELECT 
        s.*,
        COUNT(i.id) as inventory_items,
        SUM(i.quantity * i.unit_price) as total_inventory_value
       FROM suppliers s
       LEFT JOIN inventory i ON s.id = i.supplier_id
       ${whereClause}
       GROUP BY s.id
       ORDER BY s.name ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const totalResult = await db.query(
      `SELECT COUNT(*) FROM suppliers s ${whereClause}`,
      queryParams
    );

    // Get summary statistics
    const statsResult = await db.query(
      `SELECT 
        COUNT(*) as total_suppliers,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_suppliers,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_suppliers
       FROM suppliers`
    );

    res.json({
      status: 'success',
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(totalResult.rows[0].count),
        pages: Math.ceil(parseInt(totalResult.rows[0].count) / limit)
      },
      summary: statsResult.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/categories - Get all supplier categories
router.get('/categories', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT 
        category,
        COUNT(*) as supplier_count,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_suppliers
       FROM suppliers 
       WHERE category IS NOT NULL
       GROUP BY category
       ORDER BY supplier_count DESC`
    );

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/suppliers - Create new supplier
router.post('/', authenticateToken, [
  body('name').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('phone').optional().isLength({ max: 20 }).withMessage('Phone must be less than 20 characters'),
  body('address').optional().isLength({ max: 500 }).withMessage('Address must be less than 500 characters'),
  body('category').optional().isLength({ max: 50 }).withMessage('Category must be less than 50 characters'),
  body('contact_person').optional().isLength({ max: 100 }).withMessage('Contact person must be less than 100 characters'),
  body('website').optional().isLength({ max: 200 }).withMessage('Website must be less than 200 characters'),
  body('payment_terms').optional().isLength({ max: 100 }).withMessage('Payment terms must be less than 100 characters'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      address,
      category,
      contact_person,
      website,
      payment_terms,
      status = 'active',
      notes
    } = req.body;

    // Check if supplier with same name already exists
    const existingSupplier = await db.query(
      'SELECT id FROM suppliers WHERE name = $1',
      [name]
    );

    if (existingSupplier.rows.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Supplier with this name already exists'
      });
    }

    const result = await db.query(
      `INSERT INTO suppliers 
       (name, email, phone, address, category, contact_person, website, payment_terms, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [name, email, phone, address, category, contact_person, website, payment_terms, status, notes]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/:id - Get specific supplier
router.get('/:id', authenticateToken, [
  param('id').isInt().withMessage('Invalid supplier ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        s.*,
        COUNT(i.id) as inventory_items,
        SUM(i.quantity * i.unit_price) as total_inventory_value,
        AVG(i.unit_price) as average_item_price
       FROM suppliers s
       LEFT JOIN inventory i ON s.id = i.supplier_id
       WHERE s.id = $1
       GROUP BY s.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Supplier not found'
      });
    }

    // Get supplier's inventory items
    const inventoryResult = await db.query(
      `SELECT 
        i.*,
        (i.quantity * i.unit_price) as total_value,
        CASE 
          WHEN i.quantity <= i.reorder_level THEN 'low_stock'
          WHEN i.quantity <= (i.reorder_level * 1.5) THEN 'medium_stock'
          ELSE 'good_stock'
        END as stock_status
       FROM inventory i
       WHERE i.supplier_id = $1
       ORDER BY i.name ASC`,
      [id]
    );

    // Get recent stock movements for this supplier's items
    const movementsResult = await db.query(
      `SELECT 
        sm.*,
        i.name as inventory_name,
        u.name as user_name
       FROM stock_movements sm
       JOIN inventory i ON sm.inventory_id = i.id
       LEFT JOIN users u ON sm.user_id = u.id
       WHERE i.supplier_id = $1
       ORDER BY sm.created_at DESC
       LIMIT 20`,
      [id]
    );

    res.json({
      status: 'success',
      data: {
        ...result.rows[0],
        inventory_items: inventoryResult.rows,
        recent_movements: movementsResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/suppliers/:id - Update supplier
router.patch('/:id', authenticateToken, [
  param('id').isInt().withMessage('Invalid supplier ID format'),
  body('name').optional().isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('phone').optional().isLength({ max: 20 }).withMessage('Phone must be less than 20 characters'),
  body('address').optional().isLength({ max: 500 }).withMessage('Address must be less than 500 characters'),
  body('category').optional().isLength({ max: 50 }).withMessage('Category must be less than 50 characters'),
  body('contact_person').optional().isLength({ max: 100 }).withMessage('Contact person must be less than 100 characters'),
  body('website').optional().isLength({ max: 200 }).withMessage('Website must be less than 200 characters'),
  body('payment_terms').optional().isLength({ max: 100 }).withMessage('Payment terms must be less than 100 characters'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
  body('notes').optional().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    // Check if supplier exists
    const existingSupplier = await db.query(
      'SELECT * FROM suppliers WHERE id = $1',
      [id]
    );

    if (existingSupplier.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Supplier not found'
      });
    }

    // Check if name already exists (if updating name)
    if (updateFields.name && updateFields.name !== existingSupplier.rows[0].name) {
      const nameCheck = await db.query(
        'SELECT id FROM suppliers WHERE name = $1 AND id != $2',
        [updateFields.name, id]
      );
      if (nameCheck.rows.length > 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Supplier with this name already exists'
        });
      }
    }

    // Build update query dynamically
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] !== undefined) {
        setClause.push(`${key} = $${paramIndex}`);
        values.push(updateFields[key]);
        paramIndex++;
      }
    });

    if (setClause.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'No valid fields to update'
      });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE suppliers 
       SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    res.json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/suppliers/:id - Delete supplier
router.delete('/:id', authenticateToken, [
  param('id').isInt().withMessage('Invalid supplier ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if supplier exists
    const existingSupplier = await db.query(
      'SELECT * FROM suppliers WHERE id = $1',
      [id]
    );

    if (existingSupplier.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Supplier not found'
      });
    }

    // Check if supplier has associated inventory items
    const inventoryCheck = await db.query(
      'SELECT COUNT(*) FROM inventory WHERE supplier_id = $1',
      [id]
    );

    if (parseInt(inventoryCheck.rows[0].count) > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot delete supplier with associated inventory items'
      });
    }

    await db.query('DELETE FROM suppliers WHERE id = $1', [id]);

    res.json({
      status: 'success',
      message: 'Supplier deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/suppliers/:id/inventory - Get supplier's inventory
router.get('/:id/inventory', authenticateToken, [
  param('id').isInt().withMessage('Invalid supplier ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Check if supplier exists
    const supplierCheck = await db.query(
      'SELECT id, name FROM suppliers WHERE id = $1',
      [id]
    );

    if (supplierCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Supplier not found'
      });
    }

    const result = await db.query(
      `SELECT 
        i.*,
        (i.quantity * i.unit_price) as total_value,
        CASE 
          WHEN i.quantity <= i.reorder_level THEN 'low_stock'
          WHEN i.quantity <= (i.reorder_level * 1.5) THEN 'medium_stock'
          ELSE 'good_stock'
        END as stock_status
       FROM inventory i
       WHERE i.supplier_id = $1
       ORDER BY i.name ASC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    // Get total count
    const totalResult = await db.query(
      'SELECT COUNT(*) FROM inventory WHERE supplier_id = $1',
      [id]
    );

    // Get summary statistics
    const statsResult = await db.query(
      `SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        SUM(quantity * unit_price) as total_value,
        COUNT(CASE WHEN quantity <= reorder_level THEN 1 END) as low_stock_items
       FROM inventory 
       WHERE supplier_id = $1`,
      [id]
    );

    res.json({
      status: 'success',
      data: result.rows,
      supplier: supplierCheck.rows[0],
      pagination: {
        page,
        limit,
        total: parseInt(totalResult.rows[0].count),
        pages: Math.ceil(parseInt(totalResult.rows[0].count) / limit)
      },
      summary: statsResult.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
