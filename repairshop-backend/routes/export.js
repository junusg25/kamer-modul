const express = require('express');
const router = express.Router();
const db = require('../db');
const { escape } = require('html-escaper');

// Helper function to convert data to CSV
function convertToCSV(data, headers) {
  const csvHeaders = headers.map(h => `"${h.label}"`).join(',');
  const csvRows = data.map(row => 
    headers.map(h => `"${row[h.key] || ''}"`).join(',')
  );
  return [csvHeaders, ...csvRows].join('\n');
}

// GET /api/export/work-orders - Export work orders as CSV
router.get('/work-orders', async (req, res, next) => {
  try {
    const { status, priority, start_date, end_date } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`wo.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (priority) {
      whereConditions.push(`wo.priority = $${paramIndex}`);
      queryParams.push(priority);
      paramIndex++;
    }

    if (start_date) {
      whereConditions.push(`wo.created_at >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`wo.created_at <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await db.query(`
      SELECT 
        wo.id,
        wo.description,
        wo.status,
        wo.priority,
        wo.created_at,
        wo.updated_at,
        c.name as customer_name,
        c.email as customer_email,
        m.name as machine_name,
        m.serial_number,
        u.name as technician_name
      FROM work_orders wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN machines m ON wo.machine_id = m.id
      LEFT JOIN users u ON wo.technician_id = u.id
      ${whereClause}
      ORDER BY wo.created_at DESC
    `, queryParams);

    const headers = [
      { key: 'id', label: 'Work Order ID' },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'customer_email', label: 'Customer Email' },
      { key: 'machine_name', label: 'Machine' },
      { key: 'serial_number', label: 'Serial Number' },
      { key: 'technician_name', label: 'Technician' },
      { key: 'created_at', label: 'Created Date' },
      { key: 'updated_at', label: 'Last Updated' }
    ];

    const csv = convertToCSV(result.rows, headers);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=work_orders.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// GET /api/export/customers - Export customers as CSV
router.get('/customers', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.email,
        c.phone,
        c.address,
        c.created_at,
        COUNT(m.id) as machine_count,
        COUNT(wo.id) as work_order_count
      FROM customers c
      LEFT JOIN machines m ON c.id = m.customer_id
      LEFT JOIN work_orders wo ON c.id = wo.customer_id
      GROUP BY c.id, c.name, c.email, c.phone, c.address, c.created_at
      ORDER BY c.created_at DESC
    `);

    const headers = [
      { key: 'id', label: 'Customer ID' },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'address', label: 'Address' },
      { key: 'machine_count', label: 'Machines' },
      { key: 'work_order_count', label: 'Work Orders' },
      { key: 'created_at', label: 'Created Date' }
    ];

    const csv = convertToCSV(result.rows, headers);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// GET /api/export/inventory - Export inventory as CSV
router.get('/inventory', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        i.id,
        i.name,
        i.description,
        i.quantity,
        i.created_at,
        i.updated_at,
        COUNT(woi.id) as usage_count
      FROM inventory i
      LEFT JOIN work_order_inventory woi ON i.id = woi.inventory_id
      GROUP BY i.id, i.name, i.description, i.quantity, i.created_at, i.updated_at
      ORDER BY i.name
    `);

    const headers = [
      { key: 'id', label: 'Item ID' },
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'usage_count', label: 'Times Used' },
      { key: 'created_at', label: 'Created Date' },
      { key: 'updated_at', label: 'Last Updated' }
    ];

    const csv = convertToCSV(result.rows, headers);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// GET /api/export/technician-performance - Export technician performance as CSV
router.get('/technician-performance', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    let whereConditions = ['u.role = \'technician\''];
    let queryParams = [];
    let paramIndex = 1;

    if (start_date) {
      whereConditions.push(`wo.created_at >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`wo.created_at <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const result = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(wo.id) as total_orders,
        COUNT(CASE WHEN wo.status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN wo.status = 'in_progress' THEN 1 END) as active_orders,
        COUNT(CASE WHEN wo.status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN wo.priority = 'high' THEN 1 END) as high_priority_orders,
        ROUND(
          COUNT(CASE WHEN wo.status = 'completed' THEN 1 END) * 100.0 / 
          NULLIF(COUNT(wo.id), 0), 2
        ) as completion_rate
      FROM users u
      LEFT JOIN work_orders wo ON u.id = wo.technician_id
      ${whereClause}
      GROUP BY u.id, u.name, u.email
      ORDER BY total_orders DESC
    `, queryParams);

    const headers = [
      { key: 'id', label: 'Technician ID' },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'total_orders', label: 'Total Orders' },
      { key: 'completed_orders', label: 'Completed' },
      { key: 'active_orders', label: 'Active' },
      { key: 'pending_orders', label: 'Pending' },
      { key: 'high_priority_orders', label: 'High Priority' },
      { key: 'completion_rate', label: 'Completion Rate (%)' }
    ];

    const csv = convertToCSV(result.rows, headers);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=technician_performance.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
