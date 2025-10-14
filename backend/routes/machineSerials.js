const express = require('express');
const router = express.Router();
const db = require('../db');

// GET serials for a specific model
router.get('/model/:modelId', async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const { status } = req.query;
    
    let query = `
      SELECT 
        ms.id,
        ms.serial_number,
        ms.status,
        ms.created_at,
        ms.updated_at,
        am.id as assignment_id,
        am.customer_id,
        am.purchase_date,
        am.warranty_expiry_date,
        am.warranty_active,
        am.description as assignment_description,
        am.assigned_at,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
      FROM machine_serials ms
      LEFT JOIN sold_machines am ON ms.id = am.serial_id
      LEFT JOIN customers c ON am.customer_id = c.id
      WHERE ms.model_id = $1
    `;
    const params = [modelId];
    
    if (status) {
      query += ` AND ms.status = $${params.length + 1}`;
      params.push(status);
    }
    
    query += ` ORDER BY ms.created_at DESC`;
    
    const result = await db.query(query, params);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET unassigned serials for a specific model
router.get('/unassigned/:modelId', async (req, res, next) => {
  try {
    const { modelId } = req.params;
    
    const query = `
      SELECT 
        ms.id,
        ms.serial_number,
        ms.model_id,
        ms.created_at,
        ms.updated_at
      FROM machine_serials ms
      LEFT JOIN sold_machines am ON ms.id = am.serial_id
      WHERE ms.model_id = $1 
        AND am.id IS NULL
      ORDER BY ms.created_at DESC
    `;
    
    const result = await db.query(query, [modelId]);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// POST add serial numbers to a model
router.post('/model/:modelId', async (req, res, next) => {
  try {
    const { modelId } = req.params;
    const { serial_numbers } = req.body;
    
    if (!serial_numbers || !Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Serial numbers array is required'
      });
    }
    
    // Check if model exists
    const modelCheck = await db.query(
      'SELECT id FROM machine_models WHERE id = $1',
      [modelId]
    );
    
    if (modelCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Machine model not found'
      });
    }
    
    // Insert serial numbers
    const insertedSerials = [];
    for (const serialNumber of serial_numbers) {
      try {
        const result = await db.query(
          'INSERT INTO machine_serials (model_id, serial_number) VALUES ($1, $2) RETURNING *',
          [modelId, serialNumber]
        );
        insertedSerials.push(result.rows[0]);
      } catch (err) {
        if (err.code === '23505') { // Unique constraint violation
          // Skip duplicate serial numbers
          continue;
        }
        throw err;
      }
    }
    
    res.status(201).json({
      status: 'success',
      data: insertedSerials,
      message: `${insertedSerials.length} serial number(s) added successfully`
    });
  } catch (err) {
    next(err);
  }
});

// PUT update serial number status
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['available', 'assigned', 'retired'].includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid status is required (available, assigned, retired)'
      });
    }
    
    const result = await db.query(
      'UPDATE machine_serials SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Serial number not found'
      });
    }
    
    res.json({
      status: 'success',
      data: result.rows[0],
      message: 'Serial number status updated successfully'
    });
  } catch (err) {
    next(err);
  }
});

// DELETE serial number (only if not assigned)
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if serial is assigned
    const assignmentCheck = await db.query(
      'SELECT COUNT(*) FROM sold_machines WHERE serial_id = $1',
      [id]
    );
    
    if (parseInt(assignmentCheck.rows[0].count) > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete serial number that is assigned to a customer'
      });
    }
    
    const result = await db.query(
      'DELETE FROM machine_serials WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Serial number not found'
      });
    }
    
    res.json({
      status: 'success',
      message: 'Serial number deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
