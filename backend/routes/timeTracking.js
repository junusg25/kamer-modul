const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/time-tracking/start - Start time tracking for work order
router.post('/start', async (req, res, next) => {
  try {
    const { work_order_id, technician_id, notes } = req.body;
    
    if (!work_order_id || !technician_id) {
      return res.status(400).json({
        status: 'fail',
        message: 'work_order_id and technician_id are required'
      });
    }

    // Check if work order exists and is not completed
    const workOrderCheck = await db.query(
      'SELECT id, status FROM work_orders WHERE id = $1',
      [work_order_id]
    );

    if (workOrderCheck.rows.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Work order not found'
      });
    }

    if (workOrderCheck.rows[0].status === 'completed') {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot track time for completed work orders'
      });
    }

    // Check if there's already an active time entry for this work order
    const activeCheck = await db.query(
      'SELECT id FROM work_order_time_entries WHERE work_order_id = $1 AND end_time IS NULL',
      [work_order_id]
    );

    if (activeCheck.rows.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Time tracking is already active for this work order'
      });
    }

    const result = await db.query(
      `INSERT INTO work_order_time_entries 
       (work_order_id, technician_id, start_time, notes)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
       RETURNING id, work_order_id, technician_id, start_time, notes`,
      [work_order_id, technician_id, notes || null]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/time-tracking/stop - Stop time tracking for work order
router.post('/stop', async (req, res, next) => {
  try {
    const { work_order_id, notes } = req.body;
    
    if (!work_order_id) {
      return res.status(400).json({
        status: 'fail',
        message: 'work_order_id is required'
      });
    }

    // Find active time entry
    const result = await db.query(
      `UPDATE work_order_time_entries 
       SET end_time = CURRENT_TIMESTAMP, notes = COALESCE($2, notes)
       WHERE work_order_id = $1 AND end_time IS NULL
       RETURNING id, work_order_id, technician_id, start_time, end_time, notes,
         EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))/3600 as hours_worked`,
      [work_order_id, notes]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'No active time tracking found for this work order'
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

// GET /api/time-tracking/work-order/:id - Get time entries for work order
router.get('/work-order/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT 
        te.id,
        te.work_order_id,
        te.technician_id,
        te.start_time,
        te.end_time,
        te.notes,
        u.name as technician_name,
        CASE 
          WHEN te.end_time IS NULL THEN 
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - te.start_time))/3600
          ELSE 
            EXTRACT(EPOCH FROM (te.end_time - te.start_time))/3600
        END as hours_worked
       FROM work_order_time_entries te
       LEFT JOIN users u ON te.technician_id = u.id
       WHERE te.work_order_id = $1
       ORDER BY te.start_time DESC`,
      [id]
    );

    // Calculate totals
    const totals = result.rows.reduce((acc, entry) => {
      acc.total_hours += parseFloat(entry.hours_worked) || 0;
      acc.entries_count += 1;
      if (!entry.end_time) acc.active_entries += 1;
      return acc;
    }, { total_hours: 0, entries_count: 0, active_entries: 0 });

    res.json({
      status: 'success',
      data: {
        entries: result.rows,
        summary: totals
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/time-tracking/technician/:id - Get time entries for technician
router.get('/technician/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;
    
    let whereConditions = ['te.technician_id = $1'];
    let queryParams = [id];
    let paramIndex = 2;

    if (start_date) {
      whereConditions.push(`te.start_time >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`te.start_time <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const result = await db.query(
      `SELECT 
        te.id,
        te.work_order_id,
        te.start_time,
        te.end_time,
        te.notes,
        wo.description as work_order_description,
        c.name as customer_name,
        CASE 
          WHEN te.end_time IS NULL THEN 
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - te.start_time))/3600
          ELSE 
            EXTRACT(EPOCH FROM (te.end_time - te.start_time))/3600
        END as hours_worked
       FROM work_order_time_entries te
       LEFT JOIN work_orders wo ON te.work_order_id = wo.id
       LEFT JOIN customers c ON wo.customer_id = c.id
       ${whereClause}
       ORDER BY te.start_time DESC`,
      queryParams
    );

    // Calculate totals
    const totals = result.rows.reduce((acc, entry) => {
      acc.total_hours += parseFloat(entry.hours_worked) || 0;
      acc.entries_count += 1;
      if (!entry.end_time) acc.active_entries += 1;
      return acc;
    }, { total_hours: 0, entries_count: 0, active_entries: 0 });

    res.json({
      status: 'success',
      data: {
        entries: result.rows,
        summary: totals
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/time-tracking/:id - Update time entry
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { start_time, end_time, notes } = req.body;
    
    const result = await db.query(
      `UPDATE work_order_time_entries 
       SET 
         start_time = COALESCE($2, start_time),
         end_time = COALESCE($3, end_time),
         notes = COALESCE($4, notes),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, work_order_id, technician_id, start_time, end_time, notes,
         EXTRACT(EPOCH FROM (end_time - start_time))/3600 as hours_worked`,
      [id, start_time, end_time, notes]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Time entry not found'
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

// DELETE /api/time-tracking/:id - Delete time entry
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM work_order_time_entries WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Time entry not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Time entry deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
