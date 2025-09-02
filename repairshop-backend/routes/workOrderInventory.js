const express = require('express');
const router = express.Router();
const db = require('../db');

// POST add inventory usage to a work order
router.post('/', async (req, res, next) => {
  try {
    const { work_order_id, inventory_id, quantity } = req.body;
    
    // Validate required fields
    if (!work_order_id || !inventory_id || !quantity) {
      return res.status(400).json({
        status: 'fail',
        message: 'work_order_id, inventory_id, and quantity are required'
      });
    }
    
    // Check if inventory has sufficient stock
    const inventoryCheck = await db.query(
      'SELECT quantity FROM inventory WHERE id = $1',
      [inventory_id]
    );
    
    if (inventoryCheck.rows.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid inventory_id'
      });
    }
    
    if (inventoryCheck.rows[0].quantity < quantity) {
      return res.status(400).json({
        status: 'fail',
        message: 'Insufficient inventory stock'
      });
    }
    
    // Use transaction to ensure data consistency
    await db.query('BEGIN');
    
    const result = await db.query(
      'INSERT INTO work_order_inventory (work_order_id, inventory_id, quantity) VALUES ($1, $2, $3) RETURNING id, work_order_id, inventory_id, quantity, updated_at',
      [work_order_id, inventory_id, quantity]
    );
    
    // Update inventory quantity
    await db.query(
      'UPDATE inventory SET quantity = quantity - $1 WHERE id = $2',
      [quantity, inventory_id]
    );
    
    await db.query('COMMIT');
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await db.query('ROLLBACK');
    if (err.code === '23503') { // Foreign key constraint violation
      return res.status(400).json({ status: 'fail', message: 'Invalid work_order_id or inventory_id' });
    }
    next(err);
  }
});

// PATCH update usage quantity by id
router.patch('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ status: 'fail', message: 'Positive quantity is required.' });
  }

  try {
    await db.query('BEGIN');

    const usageRes = await db.query('SELECT inventory_id, quantity FROM work_order_inventory WHERE id = $1 FOR UPDATE', [id]);
    if (usageRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ status: 'fail', message: 'Usage record not found.' });
    }
    const { inventory_id, quantity: currentQty } = usageRes.rows[0];
    const diff = quantity - currentQty;

    if (diff > 0) {
      const invRes = await db.query('SELECT quantity FROM inventory WHERE id = $1 FOR UPDATE', [inventory_id]);
      const stock = invRes.rows[0].quantity;
      if (stock < diff) {
        await db.query('ROLLBACK');
        return res.status(400).json({ status: 'fail', message: 'Insufficient inventory stock for update.' });
      }
    }

    const updateUsageRes = await db.query(
      'UPDATE work_order_inventory SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, work_order_id, inventory_id, quantity, updated_at',
      [quantity, id]
    );

    await db.query(
      'UPDATE inventory SET quantity = quantity - $1 WHERE id = $2',
      [diff, inventory_id]
    );

    await db.query('COMMIT');

    res.json({
      status: 'success',
      data: updateUsageRes.rows[0]
    });
  } catch (err) {
    await db.query('ROLLBACK');
    next(err);
  }
});

// DELETE usage by id
router.delete('/:id', async (req, res, next) => {
  const { id } = req.params;

  try {
    await db.query('BEGIN');

    const usageRes = await db.query('SELECT inventory_id, quantity FROM work_order_inventory WHERE id = $1 FOR UPDATE', [id]);
    if (usageRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ status: 'fail', message: 'Usage record not found.' });
    }
    const { inventory_id, quantity } = usageRes.rows[0];

    await db.query('DELETE FROM work_order_inventory WHERE id = $1', [id]);
    await db.query(
      'UPDATE inventory SET quantity = quantity + $1 WHERE id = $2',
      [quantity, inventory_id]
    );

    await db.query('COMMIT');

    res.json({ status: 'success', message: 'Usage record deleted and stock restored.' });
  } catch (err) {
    await db.query('ROLLBACK');
    next(err);
  }
});

// GET all inventory usage for a given work order
router.get('/workorder/:workOrderId', async (req, res, next) => {
  const { workOrderId } = req.params;

  try {
    const result = await db.query(
      `SELECT woi.id, woi.quantity, woi.updated_at, 
              i.name AS inventory_name, i.description AS inventory_description, i.unit_price,
              (woi.quantity * i.unit_price) AS total_price
       FROM work_order_inventory woi
       JOIN inventory i ON woi.inventory_id = i.id
       WHERE woi.work_order_id = $1`,
      [workOrderId]
    );
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET all inventory usage for a given work order (alternative route for tests)
router.get('/:workOrderId', async (req, res, next) => {
  const { workOrderId } = req.params;

  try {
    const result = await db.query(
      `SELECT woi.id, woi.quantity, woi.updated_at, 
              i.name AS inventory_name, i.description AS inventory_description, i.unit_price,
              (woi.quantity * i.unit_price) AS total_price
       FROM work_order_inventory woi
       JOIN inventory i ON woi.inventory_id = i.id
       WHERE woi.work_order_id = $1`,
      [workOrderId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, work_order_id, inventory_id, quantity, updated_at FROM work_order_inventory WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'Work order inventory not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
