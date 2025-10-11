const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      status: 'fail',
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }
  next();
};

// GET /api/table-preferences - Get all table preferences for current user
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(
      `SELECT 
        id,
        table_key,
        visible_columns,
        created_at,
        updated_at
       FROM user_table_preferences
       WHERE user_id = $1
       ORDER BY table_key`,
      [userId]
    );

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    console.error('Error fetching table preferences:', err);
    next(err);
  }
});

// GET /api/table-preferences/:tableKey - Get specific table preference
router.get('/:tableKey', authenticateToken, [
  param('tableKey').isLength({ min: 1, max: 50 }).withMessage('Valid table key is required')
], handleValidationErrors, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tableKey } = req.params;
    
    const result = await db.query(
      `SELECT 
        id,
        table_key,
        visible_columns,
        created_at,
        updated_at
       FROM user_table_preferences
       WHERE user_id = $1 AND table_key = $2`,
      [userId, tableKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Table preferences not found'
      });
    }

    res.json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error fetching table preference:', err);
    next(err);
  }
});

// PUT /api/table-preferences/:tableKey - Save/update table preference
router.put('/:tableKey', authenticateToken, [
  param('tableKey').isLength({ min: 1, max: 50 }).withMessage('Valid table key is required'),
  body('visible_columns').isArray().withMessage('visible_columns must be an array'),
  body('visible_columns.*').isString().withMessage('Each column must be a string')
], handleValidationErrors, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tableKey } = req.params;
    const { visible_columns } = req.body;

    // Check if preference already exists
    const existingResult = await db.query(
      'SELECT id FROM user_table_preferences WHERE user_id = $1 AND table_key = $2',
      [userId, tableKey]
    );

    let result;
    if (existingResult.rows.length > 0) {
      // Update existing preference
      result = await db.query(
        `UPDATE user_table_preferences 
         SET visible_columns = $3, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND table_key = $2
         RETURNING id, table_key, visible_columns, created_at, updated_at`,
        [userId, tableKey, JSON.stringify(visible_columns)]
      );
    } else {
      // Create new preference
      result = await db.query(
        `INSERT INTO user_table_preferences (user_id, table_key, visible_columns)
         VALUES ($1, $2, $3)
         RETURNING id, table_key, visible_columns, created_at, updated_at`,
        [userId, tableKey, JSON.stringify(visible_columns)]
      );
    }

    res.json({
      status: 'success',
      data: result.rows[0],
      message: 'Table preferences saved successfully'
    });
  } catch (err) {
    console.error('Error saving table preference:', err);
    next(err);
  }
});

// DELETE /api/table-preferences/:tableKey - Reset table preference to defaults
router.delete('/:tableKey', authenticateToken, [
  param('tableKey').isLength({ min: 1, max: 50 }).withMessage('Valid table key is required')
], handleValidationErrors, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tableKey } = req.params;

    const result = await db.query(
      'DELETE FROM user_table_preferences WHERE user_id = $1 AND table_key = $2 RETURNING id',
      [userId, tableKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Table preferences not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Table preferences reset to defaults'
    });
  } catch (err) {
    console.error('Error deleting table preference:', err);
    next(err);
  }
});

// POST /api/table-preferences/bulk - Save multiple table preferences at once
router.post('/bulk', authenticateToken, [
  body('preferences').isArray().withMessage('preferences must be an array'),
  body('preferences.*.table_key').isString().withMessage('table_key is required'),
  body('preferences.*.visible_columns').isArray().withMessage('visible_columns must be an array')
], handleValidationErrors, async (req, res, next) => {
  const client = await db.connect();
  
  try {
    const userId = req.user.id;
    const { preferences } = req.body;

    await client.query('BEGIN');

    const results = [];
    for (const pref of preferences) {
      const { table_key, visible_columns } = pref;

      // Upsert (insert or update)
      const result = await client.query(
        `INSERT INTO user_table_preferences (user_id, table_key, visible_columns)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, table_key) 
         DO UPDATE SET visible_columns = $3, updated_at = CURRENT_TIMESTAMP
         RETURNING id, table_key, visible_columns, created_at, updated_at`,
        [userId, table_key, JSON.stringify(visible_columns)]
      );

      results.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.json({
      status: 'success',
      data: results,
      message: 'Table preferences saved successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving bulk table preferences:', err);
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
