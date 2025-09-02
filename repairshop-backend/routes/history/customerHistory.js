// routes/history/customerHistory.js
const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../../middleware/auth');

router.get('/:customerId', async (req, res, next) => {
  const { customerId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // Paginated work order ids for this customer
    const idsRes = await db.query(`
      SELECT wo.id
      FROM work_orders wo
      JOIN machines m ON wo.machine_id = m.id
      WHERE m.customer_id = $1
      ORDER BY wo.created_at DESC
      LIMIT $2 OFFSET $3
    `, [customerId, limit, offset]);

    const workOrderIds = idsRes.rows.map(r => r.id);

    const totalRes = await db.query(`
      SELECT COUNT(*) FROM work_orders wo
      JOIN machines m ON wo.machine_id = m.id
      WHERE m.customer_id = $1
    `, [customerId]);
    const total = parseInt(totalRes.rows[0].count, 10);

    // If none, still return header
    if (workOrderIds.length === 0) {
      return res.json({
        customer_id: Number(customerId),
        customer_name: null,
        customer_email: null,
        machines: [],
        page, limit, total_work_orders: total
      });
    }

    // Fetch detailed rows
    const { rows } = await db.query(`
      SELECT 
        c.id AS customer_id,
        c.name AS customer_name,
        c.email AS customer_email,
        m.id AS machine_id,
        m.name AS machine_name,
        m.serial_number,
        m.warranty_expiry_date,
        m.warranty_active,
        wo.id AS work_order_id,
        wo.description,
        wo.status,
        wo.created_at AS work_order_created,
        wo.updated_at AS work_order_updated,
        u.name AS technician_name,
        i.id AS part_id,
        i.name AS part_name,
        woi.quantity AS quantity_used
      FROM customers c
      LEFT JOIN machines m ON m.customer_id = c.id
      LEFT JOIN work_orders wo ON wo.machine_id = m.id
      LEFT JOIN users u ON wo.technician_id = u.id
      LEFT JOIN work_order_inventory woi ON wo.id = woi.work_order_id
      LEFT JOIN inventory i ON woi.inventory_id = i.id
      WHERE c.id = $1 AND (wo.id = ANY($2::int[]))
      ORDER BY m.id, wo.created_at DESC, i.id
    `, [customerId, workOrderIds]);

    // Group
    const out = {
      customer_id: null,
      customer_name: null,
      customer_email: null,
      machines: [],
      page, limit, total_work_orders: total
    };

    const machineMap = new Map();

    for (const row of rows) {
      if (!out.customer_id) {
        out.customer_id = row.customer_id;
        out.customer_name = row.customer_name;
        out.customer_email = row.customer_email;
      }
      if (!row.machine_id) continue;

      if (!machineMap.has(row.machine_id)) {
        machineMap.set(row.machine_id, {
          machine_id: row.machine_id,
          machine_name: row.machine_name,
          serial_number: row.serial_number,
          warranty_expiry_date: row.warranty_expiry_date,
          warranty_active: row.warranty_active,
          work_orders: []
        });
      }

      if (!row.work_order_id) continue;

      const machine = machineMap.get(row.machine_id);
      let wo = machine.work_orders.find(x => x.work_order_id === row.work_order_id);
      if (!wo) {
        wo = {
          work_order_id: row.work_order_id,
          description: row.description,
          status: row.status,
          work_order_created: row.work_order_created,
          work_order_updated: row.work_order_updated,
          technician_name: row.technician_name,
          parts_used: []
        };
        machine.work_orders.push(wo);
      }

      if (row.part_id) {
        wo.parts_used.push({
          part_id: row.part_id,
          part_name: row.part_name,
          quantity_used: row.quantity_used
        });
      }
    }

    out.machines = Array.from(machineMap.values());
    res.json(out);

  } catch (err) {
    console.error('Error fetching paginated customer history:', err.message);
    res.status(500).json({ error: 'Server error fetching paginated customer history' });
  }
});

module.exports = router;
