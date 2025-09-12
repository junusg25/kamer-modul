const express = require('express')
const router = express.Router()
const db = require('../db')
const { authenticateToken } = require('../middleware/auth')

// GET all machine categories
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM machine_categories ORDER BY name'
    )
    
    res.json({
      status: 'success',
      data: result.rows
    })
  } catch (error) {
    next(error)
  }
})

// GET single machine category
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    
    const result = await db.query(
      'SELECT * FROM machine_categories WHERE id = $1',
      [id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Machine category not found'
      })
    }
    
    res.json({
      status: 'success',
      data: result.rows[0]
    })
  } catch (error) {
    next(error)
  }
})

// POST create new machine category
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { name } = req.body
    
    if (!name) {
      return res.status(400).json({
        status: 'fail',
        message: 'name is required'
      })
    }
    
    const result = await db.query(
      'INSERT INTO machine_categories (name) VALUES ($1) RETURNING *',
      [name]
    )
    
    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    })
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        status: 'fail',
        message: 'Machine category with this name already exists'
      })
    }
    next(error)
  }
})

// PUT update machine category
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    const { name } = req.body
    
    if (!name) {
      return res.status(400).json({
        status: 'fail',
        message: 'name is required'
      })
    }
    
    const result = await db.query(
      'UPDATE machine_categories SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [name, id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Machine category not found'
      })
    }
    
    res.json({
      status: 'success',
      data: result.rows[0]
    })
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({
        status: 'fail',
        message: 'Machine category with this name already exists'
      })
    }
    next(error)
  }
})

// DELETE machine category
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params
    
    // Check if category is being used by any machines
    const usageCheck = await db.query(
      'SELECT COUNT(*) FROM machines WHERE category_id = $1',
      [id]
    )
    
    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot delete category that is being used by machines'
      })
    }
    
    const result = await db.query(
      'DELETE FROM machine_categories WHERE id = $1 RETURNING *',
      [id]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Machine category not found'
      })
    }
    
    res.json({
      status: 'success',
      message: 'Machine category deleted successfully'
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
