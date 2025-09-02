const db = require('../db');

exports.escalateOverdueOrders = async () => {
  try {
    // Find overdue non-high-priority orders
    const overdueOrders = await db.query(`
      UPDATE work_orders
      SET priority = 'high',
          due_date = CURRENT_TIMESTAMP + INTERVAL '1 day'
      WHERE due_date < CURRENT_TIMESTAMP
      AND status != 'completed'
      AND priority != 'high'
      RETURNING id, description
    `);
    
    if (overdueOrders.rows.length > 0) {
      console.log('⚠️ Escalated orders:', overdueOrders.rows);
    }
  } catch (err) {
    console.error('Escalation failed:', err);
  }
};

module.exports = exports;  