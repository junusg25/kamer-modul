const express = require('express');
const router = express.Router();
const db = require('../db');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');

// GET all inventory categories
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, description, created_at, updated_at FROM inventory_categories ORDER BY name ASC'
    );
    res.json({ status: 'success', data: result.rows });
  } catch (err) { 
    next(err); 
  }
});

// POST create new inventory category
router.post('/',
  [
    body('name').notEmpty().withMessage('Category name is required'),
    body('description').optional()
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
      const { name, description } = req.body;
      const result = await db.query(
        'INSERT INTO inventory_categories (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at, updated_at',
        [name.trim(), description?.trim() || null]
      );
      
      res.status(201).json({ status: 'success', data: result.rows[0] });
    } catch (err) { 
      if (err.code === '23505') { // Unique constraint violation
        return res.status(400).json({ 
          status: 'fail', 
          message: 'Category with this name already exists' 
        });
      }
      next(err); 
    }
  }
);

// PUT update inventory category
router.put('/:id',
  [
    body('name').notEmpty().withMessage('Category name is required'),
    body('description').optional()
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
      const { id } = req.params;
      const { name, description } = req.body;
      
      const result = await db.query(
        'UPDATE inventory_categories SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, name, description, created_at, updated_at',
        [name.trim(), description?.trim() || null, id]
      );
      
      if (!result.rows.length) {
        return res.status(404).json({ status: 'fail', message: 'Category not found' });
      }
      
      res.json({ status: 'success', data: result.rows[0] });
    } catch (err) { 
      if (err.code === '23505') { // Unique constraint violation
        return res.status(400).json({ 
          status: 'fail', 
          message: 'Category with this name already exists' 
        });
      }
      next(err); 
    }
  }
);

// DELETE inventory category
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if category is being used by any inventory items
    const usageCheck = await db.query(
      'SELECT COUNT(*) as count FROM inventory WHERE category = (SELECT name FROM inventory_categories WHERE id = $1)',
      [id]
    );
    
    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'Cannot delete category that is being used by inventory items' 
      });
    }
    
    const result = await db.query('DELETE FROM inventory_categories WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) {
      return res.status(404).json({ status: 'fail', message: 'Category not found' });
    }
    
    res.json({ status: 'success', message: 'Category deleted successfully' });
  } catch (err) { 
    next(err); 
  }
});

module.exports = router;
