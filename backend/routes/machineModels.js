const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all machine models with stats (from machine_models_with_stats view)
router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20, category, manufacturer } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT * FROM machine_models_with_stats 
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR catalogue_number ILIKE $${paramIndex} OR manufacturer ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (category) {
      query += ` AND category_name = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    if (manufacturer) {
      query += ` AND manufacturer = $${paramIndex}`;
      params.push(manufacturer);
      paramIndex++;
    }
    
    query += ` ORDER BY name, catalogue_number LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) FROM machine_models_with_stats WHERE 1=1`;
    const countParams = [];
    let countParamIndex = 1;
    
    if (search) {
      countQuery += ` AND (name ILIKE $${countParamIndex} OR catalogue_number ILIKE $${countParamIndex} OR manufacturer ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }
    
    if (category) {
      countQuery += ` AND category_name = $${countParamIndex}`;
      countParams.push(category);
      countParamIndex++;
    }
    
    if (manufacturer) {
      countQuery += ` AND manufacturer = $${countParamIndex}`;
      countParams.push(manufacturer);
      countParamIndex++;
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      status: 'success',
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET machine model by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'SELECT * FROM machine_models WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Machine model not found'
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

// POST create new machine model
router.post('/', async (req, res, next) => {
  try {
    const { name, catalogue_number, manufacturer, category_id, description, warranty_months } = req.body;
    
    // Validation
    if (!name || !manufacturer) {
      return res.status(400).json({
        status: 'error',
        message: 'Name and manufacturer are required'
      });
    }
    
    const result = await db.query(
      `INSERT INTO machine_models (name, catalogue_number, manufacturer, category_id, description, warranty_months)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, catalogue_number || null, manufacturer, category_id || null, description || null, warranty_months || 12]
    );
    
    res.status(201).json({
      status: 'success',
      data: result.rows[0],
      message: 'Machine model created successfully'
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

// PUT update machine model
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
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
      [name, catalogue_number || null, manufacturer, category_id || null, description || null, warranty_months || 12, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Machine model not found'
      });
    }
    
    res.json({
      status: 'success',
      data: result.rows[0],
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

// DELETE machine model (only if no serials exist)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if model has any serials
    const serialsCheck = await db.query(
      'SELECT COUNT(*) FROM machine_serials WHERE model_id = $1',
      [id]
    );
    
    if (parseInt(serialsCheck.rows[0].count) > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete machine model that has serial numbers. Delete all serials first.'
      });
    }
    
    const result = await db.query(
      'DELETE FROM machine_models WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Machine model not found'
      });
    }
    
    res.json({
      status: 'success',
      message: 'Machine model deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
