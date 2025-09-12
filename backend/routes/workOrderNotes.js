const express = require('express');
const router = express.Router();
const db = require('../db');
const { param, validationResult } = require('express-validator');

// Custom validator for workOrderId
const validateWorkOrderId = [
  param('workOrderId').isInt().withMessage('Work Order ID must be an integer'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'fail', 
        message: errors.array().map(err => err.msg).join(', ') 
      });
    }
    next();
  }
];

// Add a note to a work order (POST /api/workOrderNotes)
router.post('/', async (req, res) => {
  const { work_order_id, content } = req.body;
  
  if (!work_order_id || !content) {
    return res.status(400).json({ error: "Work order ID and note content are required" });
  }

  try {
    const result = await db.query(
      `INSERT INTO work_order_notes (work_order_id, content) 
       VALUES ($1, $2) 
       RETURNING *`,
      [work_order_id, content]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add note" });
  }
});

// Get all notes for a work order (GET /api/workOrderNotes/:workOrderId)
router.get('/:workOrderId', validateWorkOrderId, async (req, res) => {
  const { workOrderId } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM work_order_notes 
       WHERE work_order_id = $1 
       ORDER BY created_at DESC`,
      [workOrderId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

module.exports = router;