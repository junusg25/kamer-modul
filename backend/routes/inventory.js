const express = require('express');
const router = express.Router();
const db = require('../db');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { createInventoryNotification } = require('../utils/notificationHelpers');
const { logCustomAction } = require('../utils/actionLogger');

// GET all inventory items (with pagination and optional search/filters)
router.get('/', async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const { search, category, supplier, stock_status } = req.query;
  
  try {
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    // Search filter
    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR COALESCE(description,'') ILIKE $${paramIndex} OR COALESCE(sku,'') ILIKE $${paramIndex} OR COALESCE(supplier,'') ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Category filter
    if (category) {
      whereConditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    
    // Supplier filter
    if (supplier) {
      whereConditions.push(`supplier = $${paramIndex}`);
      params.push(supplier);
      paramIndex++;
    }
    
    // Stock status filter
    if (stock_status) {
      if (stock_status === 'out_of_stock') {
        whereConditions.push(`quantity <= 0`);
      } else if (stock_status === 'low_stock') {
        whereConditions.push(`quantity > 0 AND quantity <= min_stock_level`);
      } else if (stock_status === 'in_stock') {
        whereConditions.push(`quantity > min_stock_level`);
      }
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) FROM inventory ${whereClause}`;
    const totalResult = await db.query(countQuery, params);
    const total = parseInt(totalResult.rows[0].count);
    
    // Get inventory items
    const query = `
      SELECT id, name, description, quantity, unit_price, updated_at, created_at,
             category, min_stock_level, supplier, sku, location
      FROM inventory
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    // Convert unit_price to numbers for frontend compatibility
    const rows = result.rows.map(row => ({
      ...row,
      unit_price: Number(row.unit_price)
    }));
    
    res.json({
      status: 'success',
      data: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) { next(err); }
});

// GET low stock items
router.get('/low-stock', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, description, quantity, unit_price, updated_at, created_at, category, min_stock_level, supplier, sku, location FROM inventory WHERE quantity < 5'
    );
    
    // Convert unit_price to numbers for frontend compatibility
    const rows = result.rows.map(row => ({
      ...row,
      unit_price: Number(row.unit_price)
    }));
    
    res.json(rows);
  } catch (err) { next(err); }
});

// GET inventory item by id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, description, quantity, unit_price, updated_at, created_at, category, min_stock_level, supplier, sku, location FROM inventory WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'Inventory item not found' });
    
    // Convert unit_price to number for frontend compatibility
    const item = {
      ...result.rows[0],
      unit_price: Number(result.rows[0].unit_price)
    };
    
    res.json({ status: 'success', data: item });
  } catch (err) { next(err); }
});

// PATCH update inventory item
router.patch('/:id', 
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('description').optional(),
    body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
    body('category').optional(),
    body('min_stock_level').optional().isInt({ min: 0 }).withMessage('Minimum stock level must be a positive number'),
    body('supplier').optional(),
    body('sku').optional(),
    body('location').optional()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'fail', 
        message: errors.array().map(err => `${err.param}: ${err.msg}`).join(', ')
      });
    }

    const { id } = req.params;
    const { name, description, quantity, unit_price, category, min_stock_level, supplier, sku, location } = req.body;
    
    try {
      const result = await db.query(
        `UPDATE inventory SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          quantity = COALESCE($3, quantity),
          unit_price = COALESCE($4, unit_price),
          category = COALESCE($5, category),
          min_stock_level = COALESCE($6, min_stock_level),
          supplier = COALESCE($7, supplier),
          sku = COALESCE($8, sku),
          location = COALESCE($9, location),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $10
        RETURNING id, name, description, quantity, unit_price, updated_at, created_at, category, min_stock_level, supplier, sku, location`,
        [name, description, quantity, unit_price, category, min_stock_level, supplier, sku, location, id]
      );
      
      if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'Inventory item not found' });
      
      const inventory = result.rows[0];

      // Convert unit_price to number for frontend compatibility
      inventory.unit_price = Number(inventory.unit_price);

      // Log action
      await logCustomAction(req, 'update', 'inventory', id, inventory.name, {
        updated_fields: Object.keys(req.body),
        quantity: inventory.quantity
      });

      // Create notifications for inventory changes
      try {
        if (inventory.quantity === 0) {
          await createInventoryNotification(inventory.id, 'out_of_stock');
        } else if (inventory.quantity < 5) {
          await createInventoryNotification(inventory.id, 'low_stock');
        }
      } catch (notificationError) {
        // Don't fail the request if notification fails
      }

      res.json({ status: 'success', data: inventory });
    } catch (err) { 
      next(err); 
    }
  }
);

// POST create inventory item
router.post('/',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('description').optional(),
    body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('unit_price').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
    body('category').optional(),
    body('min_stock_level').optional().isInt({ min: 0 }).withMessage('Minimum stock level must be a positive number'),
    body('supplier').optional(),
    body('sku').optional(),
    body('location').optional()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'fail', 
        message: errors.array().map(err => `${err.param}: ${err.msg}`).join(', ')
      });
    }
    try {
      const { name, description, quantity, unit_price, category, min_stock_level, supplier, sku, location } = req.body;
      const result = await db.query(
        'INSERT INTO inventory (name, description, quantity, unit_price, category, min_stock_level, supplier, sku, location) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, description, quantity, unit_price, updated_at, created_at, category, min_stock_level, supplier, sku, location',
        [name, description, quantity, unit_price, category, min_stock_level, supplier, sku, location]
      );
      
      const inventory = result.rows[0];

      // Convert unit_price to number for frontend compatibility
      inventory.unit_price = Number(inventory.unit_price);

      // Log action
      await logCustomAction(req, 'create', 'inventory', inventory.id, inventory.name, {
        category: inventory.category,
        quantity: inventory.quantity,
        unit_price: inventory.unit_price
      });

      // Create notification for new inventory item
      try {
        await createInventoryNotification(inventory.id, 'restocked');
      } catch (notificationError) {
        // Don't fail the request if notification fails
      }

      res.status(201).json(inventory);
    } catch (err) { next(err); }
  }
);

// DELETE inventory item
router.delete('/:id', async (req, res, next) => {
  try {
    const itemId = req.params.id;
    
    // Get item details before deletion
    const itemResult = await db.query('SELECT * FROM inventory WHERE id = $1', [itemId]);
    if (!itemResult.rows.length) return res.status(404).json({ status: 'fail', message: 'Inventory item not found' });
    const item = itemResult.rows[0];

    // Check if item is used in any work orders
    const workOrderUsageQuery = `
      SELECT COUNT(*) as count 
      FROM work_order_inventory 
      WHERE inventory_id = $1
    `;
    const workOrderUsageResult = await db.query(workOrderUsageQuery, [itemId]);
    const workOrderUsageCount = parseInt(workOrderUsageResult.rows[0].count);

    // Check if item is used in any warranty work orders
    const warrantyWorkOrderUsageQuery = `
      SELECT COUNT(*) as count 
      FROM warranty_work_order_inventory 
      WHERE inventory_id = $1
    `;
    const warrantyWorkOrderUsageResult = await db.query(warrantyWorkOrderUsageQuery, [itemId]);
    const warrantyWorkOrderUsageCount = parseInt(warrantyWorkOrderUsageResult.rows[0].count);

    // If item is used in any work orders, prevent deletion
    if (workOrderUsageCount > 0 || warrantyWorkOrderUsageCount > 0) {
      const totalUsage = workOrderUsageCount + warrantyWorkOrderUsageCount;
      return res.status(400).json({ 
        status: 'fail', 
        message: `Cannot delete inventory item. It is currently used in ${totalUsage} work order${totalUsage > 1 ? 's' : ''}.` 
      });
    }

    // Log action before deletion
    await logCustomAction(req, 'delete', 'inventory', itemId, item.name, {
      category: item.category,
      quantity: item.quantity,
      unit_price: item.unit_price
    });
    
    // Create notification for inventory deletion (before deletion)
    try {
      await createInventoryNotification(itemId, 'deleted', req.user?.id);
    } catch (notificationError) {
      console.error('Error creating inventory deletion notification:', notificationError);
      // Don't fail the request if notification fails
    }

    const result = await db.query('DELETE FROM inventory WHERE id = $1 RETURNING id', [itemId]);
    res.json({ status: 'success', message: 'Deleted', id: result.rows[0].id });
  } catch (err) { next(err); }
});

module.exports = router;
