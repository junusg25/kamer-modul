const express = require('express')
const { authenticateToken, requireRole } = require('../middleware/auth')
const db = require('../db')
const router = express.Router()

// Get all system settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        s.id,
        s.setting_key,
        s.setting_value,
        s.description,
        s.updated_at,
        u.name as updated_by_name
      FROM system_settings s
      LEFT JOIN users u ON s.updated_by = u.id
      ORDER BY s.setting_key
    `)

    const settings = {}
    result.rows.forEach(row => {
      settings[row.setting_key] = {
        id: row.id,
        value: row.setting_value,
        description: row.description,
        updated_at: row.updated_at,
        updated_by_name: row.updated_by_name
      }
    })

    res.json({ success: true, data: settings })
  } catch (error) {
    console.error('Error fetching system settings:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch system settings' })
  }
})

// Get specific system setting
router.get('/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params

    const result = await db.query(`
      SELECT 
        s.id,
        s.setting_key,
        s.setting_value,
        s.description,
        s.updated_at,
        u.name as updated_by_name
      FROM system_settings s
      LEFT JOIN users u ON s.updated_by = u.id
      WHERE s.setting_key = $1
    `, [key])

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Setting not found' })
    }

    const setting = result.rows[0]
    res.json({ 
      success: true, 
      data: {
        id: setting.id,
        value: setting.setting_value,
        description: setting.description,
        updated_at: setting.updated_at,
        updated_by_name: setting.updated_by_name
      }
    })
  } catch (error) {
    console.error('Error fetching system setting:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch system setting' })
  }
})

// Update system setting (Admin only)
router.post('/:key', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body

    if (!value) {
      return res.status(400).json({ success: false, message: 'Value is required' })
    }

    // Check if setting exists
    const checkResult = await db.query(
      'SELECT id FROM system_settings WHERE setting_key = $1',
      [key]
    )

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Setting not found' })
    }

    // Update setting
    const result = await db.query(`
      UPDATE system_settings 
      SET setting_value = $1, updated_by = $2, updated_at = NOW()
      WHERE setting_key = $3
      RETURNING id, setting_key, setting_value, updated_at
    `, [value, req.user.id, key])

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Setting not found' })
    }

    const updatedSetting = result.rows[0]
    
    res.json({ 
      success: true, 
      message: 'Setting updated successfully',
      data: {
        id: updatedSetting.id,
        key: updatedSetting.setting_key,
        value: updatedSetting.setting_value,
        updated_at: updatedSetting.updated_at
      }
    })
  } catch (error) {
    console.error('Error updating system setting:', error)
    res.status(500).json({ success: false, message: 'Failed to update system setting' })
  }
})

// Create new system setting (Admin only)
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { key, value, description } = req.body

    if (!key || !value) {
      return res.status(400).json({ 
        success: false, 
        message: 'Setting key and value are required' 
      })
    }

    // Check if setting already exists
    const checkResult = await db.query(
      'SELECT id FROM system_settings WHERE setting_key = $1',
      [key]
    )

    if (checkResult.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'Setting with this key already exists' 
      })
    }

    // Create setting
    const result = await db.query(`
      INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, setting_key, setting_value, description, created_at
    `, [key, value, description || null, req.user.id])

    const newSetting = result.rows[0]
    
    res.status(201).json({ 
      success: true, 
      message: 'Setting created successfully',
      data: {
        id: newSetting.id,
        key: newSetting.setting_key,
        value: newSetting.setting_value,
        description: newSetting.description,
        created_at: newSetting.created_at
      }
    })
  } catch (error) {
    console.error('Error creating system setting:', error)
    res.status(500).json({ success: false, message: 'Failed to create system setting' })
  }
})

// Delete system setting (Admin only)
router.delete('/:key', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { key } = req.params

    const result = await db.query(
      'DELETE FROM system_settings WHERE setting_key = $1 RETURNING id',
      [key]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Setting not found' })
    }

    res.json({ success: true, message: 'Setting deleted successfully' })
  } catch (error) {
    console.error('Error deleting system setting:', error)
    res.status(500).json({ success: false, message: 'Failed to delete system setting' })
  }
})

module.exports = router
