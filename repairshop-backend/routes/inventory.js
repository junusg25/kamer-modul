const express = require('express');
const router = express.Router();
const db = require('../db');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { createInventoryNotification } = require('../utils/notificationHelpers');

// GET all inventory items (with pagination and optional search)
router.get('/', async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { search } = req.query;
  try {
    let result;
    let total;
    if (search) {
      const like = `%${search}%`;
      result = await db.query(
        `SELECT id, name, description, quantity, unit_price, updated_at, created_at,
                category, min_stock_level, supplier, sku, location
         FROM inventory
         WHERE name ILIKE $1 OR COALESCE(description,'') ILIKE $1 OR COALESCE(sku,'') ILIKE $1
         ORDER BY updated_at DESC
         LIMIT $2 OFFSET $3`,
        [like, limit, offset]
      );
      total = await db.query(`SELECT COUNT(*) FROM inventory WHERE name ILIKE $1 OR COALESCE(description,'') ILIKE $1`, [like]);
    } else {
      result = await db.query(
        'SELECT id, name, description, quantity, unit_price, updated_at, created_at, category, min_stock_level, supplier, sku, location FROM inventory ORDER BY updated_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      total = await db.query('SELECT COUNT(*) FROM inventory');
    }
    
    // Convert unit_price to numbers for frontend compatibility
    const rows = result.rows.map(row => ({
      ...row,
      unit_price: Number(row.unit_price)
    }));
    
    res.json({
      status: 'success',
      data: rows,
      page,
      limit,
      total: parseInt(total.rows[0].count)
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
    
    // Create notification for inventory deletion (before deletion)
    try {
      await createInventoryNotification(itemId, 'deleted', req.user?.id);
    } catch (notificationError) {
      console.error('Error creating inventory deletion notification:', notificationError);
      // Don't fail the request if notification fails
    }

    const result = await db.query('DELETE FROM inventory WHERE id = $1 RETURNING id', [itemId]);
    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'Inventory item not found' });
    res.json({ status: 'success', message: 'Deleted', id: result.rows[0].id });
  } catch (err) { next(err); }
});

module.exports = router;
