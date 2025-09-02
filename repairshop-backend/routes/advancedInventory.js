const express = require('express');
const router = express.Router();
const db = require('../db');
const { handleValidationErrors } = require('../middleware/validators');
const { body, param, query } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { createInventoryNotification } = require('../utils/notificationHelpers');

// GET /api/advanced-inventory - Get all inventory with advanced features
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { search, category, supplier_id, low_stock, barcode } = req.query;

    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`(i.name ILIKE $${paramIndex} OR i.description ILIKE $${paramIndex} OR i.part_number ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      whereConditions.push(`i.category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    if (supplier_id) {
      whereConditions.push(`i.supplier_id = $${paramIndex}`);
      queryParams.push(supplier_id);
      paramIndex++;
    }

    if (low_stock === 'true') {
      whereConditions.push(`i.quantity <= i.reorder_level`);
    }

    if (barcode) {
      whereConditions.push(`i.barcode = $${paramIndex}`);
      queryParams.push(barcode);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const result = await db.query(
      `SELECT 
        i.*,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        (i.quantity * i.unit_price) as total_value,
        CASE 
          WHEN i.quantity <= i.reorder_level THEN 'low_stock'
          WHEN i.quantity <= (i.reorder_level * 1.5) THEN 'medium_stock'
          ELSE 'good_stock'
        END as stock_status
       FROM inventory i
       LEFT JOIN suppliers s ON i.supplier_id = s.id
       ${whereClause}
       ORDER BY i.name ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const totalResult = await db.query(
      `SELECT COUNT(*) FROM inventory i LEFT JOIN suppliers s ON i.supplier_id = s.id ${whereClause}`,
      queryParams
    );

    // Get summary statistics
    const statsResult = await db.query(
      `SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        SUM(quantity * unit_price) as total_value,
        COUNT(CASE WHEN quantity <= reorder_level THEN 1 END) as low_stock_items,
        COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_items
       FROM inventory`
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

// GET /api/advanced-inventory/categories - Get all categories
router.get('/categories', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT 
        category,
        COUNT(*) as item_count,
        SUM(quantity) as total_quantity,
        SUM(quantity * unit_price) as total_value
       FROM inventory 
       WHERE category IS NOT NULL
       GROUP BY category
       ORDER BY item_count DESC`
    );

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/advanced-inventory/valuation - Get inventory valuation
router.get('/valuation', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        SUM(quantity * unit_price) as total_value,
        AVG(unit_price) as average_unit_price,
        COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_items,
        COUNT(CASE WHEN quantity <= reorder_level THEN 1 END) as low_stock_items,
        SUM(CASE WHEN quantity <= reorder_level THEN (reorder_level - quantity) * unit_price ELSE 0 END) as value_at_risk
       FROM inventory`
    );

    // Get value by category
    const categoryValue = await db.query(
      `SELECT 
        category,
        COUNT(*) as item_count,
        SUM(quantity * unit_price) as total_value
       FROM inventory 
       WHERE category IS NOT NULL
       GROUP BY category
       ORDER BY total_value DESC`
    );

    res.json({
      status: 'success',
      data: {
        summary: result.rows[0],
        by_category: categoryValue.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/advanced-inventory/search - Advanced search
router.get('/search', authenticateToken, [
  query('q').isLength({ min: 1 }).withMessage('Search query is required'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT 
        i.*,
        s.name as supplier_name,
        (i.quantity * i.unit_price) as total_value,
        CASE 
          WHEN i.quantity <= i.reorder_level THEN 'low_stock'
          WHEN i.quantity <= (i.reorder_level * 1.5) THEN 'medium_stock'
          ELSE 'good_stock'
        END as stock_status
       FROM inventory i
       LEFT JOIN suppliers s ON i.supplier_id = s.id
       WHERE 
        i.name ILIKE $1 OR 
        i.description ILIKE $1 OR 
        i.part_number ILIKE $1 OR 
        i.barcode ILIKE $1 OR
        i.category ILIKE $1
       ORDER BY 
        CASE WHEN i.name ILIKE $1 THEN 1 ELSE 2 END,
        i.name ASC
       LIMIT $2 OFFSET $3`,
      [`%${q}%`, limit, offset]
    );

    // Get total count
    const totalResult = await db.query(
      `SELECT COUNT(*) FROM inventory i
       LEFT JOIN suppliers s ON i.supplier_id = s.id
       WHERE 
        i.name ILIKE $1 OR 
        i.description ILIKE $1 OR 
        i.part_number ILIKE $1 OR 
        i.barcode ILIKE $1 OR
        i.category ILIKE $1`,
      [`%${q}%`]
    );

    res.json({
      status: 'success',
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

// GET /api/advanced-inventory/alerts/low-stock - Get low stock alerts
router.get('/alerts/low-stock', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT 
        i.*,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        (i.quantity * i.unit_price) as total_value,
        (i.reorder_level - i.quantity) as quantity_needed
       FROM inventory i
       LEFT JOIN suppliers s ON i.supplier_id = s.id
       WHERE i.quantity <= i.reorder_level
       ORDER BY (i.reorder_level - i.quantity) DESC`
    );

    res.json({
      status: 'success',
      data: result.rows,
      summary: {
        total_low_stock_items: result.rows.length,
        total_value_at_risk: result.rows.reduce((sum, item) => sum + parseFloat(item.total_value || 0), 0)
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/advanced-inventory - Create new inventory item with advanced features
router.post('/', authenticateToken, [
  body('name').isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('part_number').optional().isLength({ max: 50 }).withMessage('Part number must be less than 50 characters'),
  body('barcode').optional().isLength({ max: 50 }).withMessage('Barcode must be less than 50 characters'),
  body('category').optional().isLength({ max: 50 }).withMessage('Category must be less than 50 characters'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('reorder_level').isInt({ min: 0 }).withMessage('Reorder level must be a non-negative integer'),
  body('supplier_id').optional().isInt().withMessage('Supplier ID must be a valid integer'),
  body('location').optional().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  body('min_order_quantity').optional().isInt({ min: 1 }).withMessage('Minimum order quantity must be at least 1'),
  body('lead_time_days').optional().isInt({ min: 0 }).withMessage('Lead time must be a non-negative integer'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const {
      name,
      description,
      part_number,
      barcode,
      category,
      quantity,
      unit_price,
      reorder_level,
      supplier_id,
      location,
      min_order_quantity,
      lead_time_days
    } = req.body;

    // Check if barcode already exists
    if (barcode) {
      const barcodeCheck = await db.query(
        'SELECT id FROM inventory WHERE barcode = $1',
        [barcode]
      );
      if (barcodeCheck.rows.length > 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Barcode already exists'
        });
      }
    }

    // Check if supplier exists
    if (supplier_id) {
      const supplierCheck = await db.query(
        'SELECT id FROM suppliers WHERE id = $1',
        [supplier_id]
      );
      if (supplierCheck.rows.length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Supplier not found'
        });
      }
    }

    const result = await db.query(
      `INSERT INTO inventory 
       (name, description, part_number, barcode, category, quantity, unit_price, 
        reorder_level, supplier_id, location, min_order_quantity, lead_time_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [name, description, part_number, barcode, category, quantity, unit_price, 
       reorder_level, supplier_id, location, min_order_quantity, lead_time_days]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/advanced-inventory/:id - Get specific inventory item
router.get('/:id', authenticateToken, [
  param('id').isInt().withMessage('Invalid inventory ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        i.*,
        s.name as supplier_name,
        s.email as supplier_email,
        s.phone as supplier_phone,
        s.address as supplier_address,
        (i.quantity * i.unit_price) as total_value,
        CASE 
          WHEN i.quantity <= i.reorder_level THEN 'low_stock'
          WHEN i.quantity <= (i.reorder_level * 1.5) THEN 'medium_stock'
          ELSE 'good_stock'
        END as stock_status
       FROM inventory i
       LEFT JOIN suppliers s ON i.supplier_id = s.id
       WHERE i.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Inventory item not found'
      });
    }

    // Get stock movement history
    const movementResult = await db.query(
      `SELECT 
        sm.*,
        u.name as user_name,
        wo.description as work_order_description
       FROM stock_movements sm
       LEFT JOIN users u ON sm.user_id = u.id
       LEFT JOIN work_orders wo ON sm.work_order_id = wo.id
       WHERE sm.inventory_id = $1
       ORDER BY sm.created_at DESC
       LIMIT 20`,
      [id]
    );

    // Get related work orders
    const workOrdersResult = await db.query(
      `SELECT 
        wo.id,
        wo.description,
        wo.status,
        wo.created_at,
        woi.quantity,
        c.name as customer_name
       FROM work_order_inventory woi
       JOIN work_orders wo ON woi.work_order_id = wo.id
       JOIN customers c ON wo.customer_id = c.id
       WHERE woi.inventory_id = $1
       ORDER BY wo.created_at DESC
       LIMIT 10`,
      [id]
    );

    res.json({
      status: 'success',
      data: {
        ...result.rows[0],
        stock_movements: movementResult.rows,
        related_work_orders: workOrdersResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/advanced-inventory/:id - Update inventory item
router.patch('/:id', authenticateToken, [
  param('id').isInt().withMessage('Invalid inventory ID format'),
  body('name').optional().isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('part_number').optional().isLength({ max: 50 }).withMessage('Part number must be less than 50 characters'),
  body('barcode').optional().isLength({ max: 50 }).withMessage('Barcode must be less than 50 characters'),
  body('category').optional().isLength({ max: 50 }).withMessage('Category must be less than 50 characters'),
  body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('reorder_level').optional().isInt({ min: 0 }).withMessage('Reorder level must be a non-negative integer'),
  body('supplier_id').optional().isInt().withMessage('Supplier ID must be a valid integer'),
  body('location').optional().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  body('min_order_quantity').optional().isInt({ min: 1 }).withMessage('Minimum order quantity must be at least 1'),
  body('lead_time_days').optional().isInt({ min: 0 }).withMessage('Lead time must be a non-negative integer'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    // Check if inventory item exists
    const existingItem = await db.query(
      'SELECT * FROM inventory WHERE id = $1',
      [id]
    );

    if (existingItem.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Inventory item not found'
      });
    }

    // Check if barcode already exists (if updating barcode)
    if (updateFields.barcode && updateFields.barcode !== existingItem.rows[0].barcode) {
      const barcodeCheck = await db.query(
        'SELECT id FROM inventory WHERE barcode = $1 AND id != $2',
        [updateFields.barcode, id]
      );
      if (barcodeCheck.rows.length > 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Barcode already exists'
        });
      }
    }

    // Check if supplier exists (if updating supplier)
    if (updateFields.supplier_id) {
      const supplierCheck = await db.query(
        'SELECT id FROM suppliers WHERE id = $1',
        [updateFields.supplier_id]
      );
      if (supplierCheck.rows.length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Supplier not found'
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
      `UPDATE inventory 
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

// POST /api/advanced-inventory/:id/adjust-stock - Adjust stock quantity
router.post('/:id/adjust-stock', authenticateToken, [
  param('id').isInt().withMessage('Invalid inventory ID format'),
  body('quantity_change').isInt().withMessage('Quantity change must be an integer'),
  body('reason').isLength({ min: 1, max: 200 }).withMessage('Reason must be between 1 and 200 characters'),
  body('work_order_id').optional().isInt().withMessage('Work order ID must be a valid integer'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity_change, reason, work_order_id, notes } = req.body;

    // Check if inventory item exists
    const existingItem = await db.query(
      'SELECT * FROM inventory WHERE id = $1',
      [id]
    );

    if (existingItem.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Inventory item not found'
      });
    }

    const currentQuantity = existingItem.rows[0].quantity;
    const newQuantity = currentQuantity + quantity_change;

    if (newQuantity < 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Insufficient stock for this adjustment'
      });
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Update inventory quantity
      const updateResult = await db.query(
        'UPDATE inventory SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [newQuantity, id]
      );

      // Record stock movement
      await db.query(
        `INSERT INTO stock_movements 
         (inventory_id, quantity_change, reason, work_order_id, notes, user_id, previous_quantity, new_quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, quantity_change, reason, work_order_id, notes, req.user.id, currentQuantity, newQuantity]
      );

      await db.query('COMMIT');

      // Check for low stock and create notifications
      try {
        const item = updateResult.rows[0];
        
        if (newQuantity <= item.reorder_level && newQuantity > 0) {
          await createInventoryNotification(
            item.id,
            'low_stock',
            item.name,
            newQuantity
          );
        } else if (newQuantity === 0) {
          await createInventoryNotification(
            item.id,
            'out_of_stock',
            item.name
          );
        } else if (quantity_change > 0 && currentQuantity <= item.reorder_level) {
          // Stock was received and was previously low
          await createInventoryNotification(
            item.id,
            'stock_received',
            item.name
          );
        }
      } catch (notificationError) {
        console.error('Error creating inventory notification:', notificationError);
        // Don't fail the request if notification fails
      }

      res.json({
        status: 'success',
        data: {
          ...updateResult.rows[0],
          quantity_change,
          reason,
          previous_quantity: currentQuantity,
          new_quantity: newQuantity
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
