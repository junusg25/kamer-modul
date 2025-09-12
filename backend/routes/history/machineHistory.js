// routes/history/machineHistory.js
const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../../middleware/auth');

// GET /history/machines/:id — machine repair history
router.get('/:id', async (req, res, next) => {
  const machineId = req.params.id;

  try {
    const { rows } = await db.query(`
      SELECT 
        m.id AS machine_id,
        m.name AS machine_name,
        m.serial_number,
        m.warranty_expiry_date,
        m.warranty_active,
        wo.id AS work_order_id,
        wo.description,
        wo.status,
        wo.created_at,
        wo.updated_at,
        u.name AS technician_name,
        i.id AS part_id,
        i.name AS part_name,
        woi.quantity AS quantity_used
      FROM machines m
      LEFT JOIN work_orders wo ON wo.machine_id = m.id
      LEFT JOIN users u ON wo.technician_id = u.id
      LEFT JOIN work_order_inventory woi ON wo.id = woi.work_order_id
      LEFT JOIN inventory i ON woi.inventory_id = i.id
      WHERE m.id = $1
      ORDER BY wo.created_at DESC NULLS LAST, i.id
    `, [machineId]);

    if (rows.length === 0) return res.json([]);

    const response = {
      machine_id: rows[0].machine_id,
      machine_name: rows[0].machine_name,
      serial_number: rows[0].serial_number,
      warranty_expiry_date: rows[0].warranty_expiry_date,
      warranty_active: rows[0].warranty_active,
      work_orders: []
    };

    const woMap = new Map();

    for (const r of rows) {
      if (!r.work_order_id) continue;

      if (!woMap.has(r.work_order_id)) {
        woMap.set(r.work_order_id, {
          work_order_id: r.work_order_id,
          description: r.description,
          status: r.status,
          created_at: r.created_at,
          updated_at: r.updated_at,
          technician_name: r.technician_name,
          parts_used: []
        });
      }

      if (r.part_id) {
        woMap.get(r.work_order_id).parts_used.push({
          part_id: r.part_id,
          part_name: r.part_name,
          quantity_used: r.quantity_used
        });
      }
    }

    response.work_orders = Array.from(woMap.values());
    res.json([response]);
  } catch (err) {
    console.error('Error fetching machine history:', err.message);
    res.status(500).json({ error: 'Server error fetching machine history' });
  }
});

module.exports = router;
