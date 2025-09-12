// routes/history/userHistory.js
const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../../middleware/auth');

router.get('/:userId', async (req, res, next) => {
  const { userId } = req.params;
  
  if (!userId || userId === 'undefined') {
    return res.status(400).json({ error: 'Valid user ID is required' });
  }
  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const woIdsRes = await db.query(`
      SELECT id
      FROM work_orders
      WHERE technician_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const workOrderIds = woIdsRes.rows.map(r => r.id);

    const totalRes = await db.query(
      'SELECT COUNT(*) FROM work_orders WHERE technician_id = $1',
      [userId]
    );
    const total = parseInt(totalRes.rows[0].count, 10);

    if (workOrderIds.length === 0) {
      return res.json({ user_id: Number(userId), work_orders: [], page, limit, total_work_orders: total });
    }

    const { rows } = await db.query(`
      SELECT
        wo.id AS work_order_id,
        wo.description,
        wo.status,
        wo.created_at,
        wo.updated_at,
        c.id AS customer_id,
        c.name AS customer_name,
        m.id AS machine_id,
        m.name AS machine_name,
        m.serial_number,
        m.warranty_expiry_date,
        m.warranty_active,
        i.id AS part_id,
        i.name AS part_name,
        woi.quantity AS quantity_used
      FROM work_orders wo
      JOIN customers c ON c.id = wo.customer_id
      JOIN machines m ON m.id = wo.machine_id
      LEFT JOIN work_order_inventory woi ON wo.id = woi.work_order_id
      LEFT JOIN inventory i ON woi.inventory_id = i.id
      WHERE wo.id = ANY($1::int[])
      ORDER BY wo.created_at DESC, i.id
    `, [workOrderIds]);

    // group by work order
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.work_order_id)) {
        map.set(r.work_order_id, {
          work_order_id: r.work_order_id,
          description: r.description,
          status: r.status,
          created_at: r.created_at,
          updated_at: r.updated_at,
          customer: { customer_id: r.customer_id, customer_name: r.customer_name },
          machine: {
            machine_id: r.machine_id,
            machine_name: r.machine_name,
            serial_number: r.serial_number,
            warranty_expiry_date: r.warranty_expiry_date,
            warranty_active: r.warranty_active
          },
          parts_used: []
        });
      }
      if (r.part_id) {
        map.get(r.work_order_id).parts_used.push({
          part_id: r.part_id,
          part_name: r.part_name,
          quantity_used: r.quantity_used
        });
      }
    }

    res.json({
      user_id: Number(userId),
      work_orders: Array.from(map.values()),
      page, limit, total_work_orders: total
    });
  } catch (err) {
    console.error('Error fetching user history:', err.message);
    res.status(500).json({ error: 'Server error fetching user history' });
  }
});

module.exports = router;
