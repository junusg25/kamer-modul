// utils/alertHelpers.js
exports.checkOverdueOrders = async () => {
  const result = await db.query(
    `SELECT wo.id, c.name AS customer, m.name AS machine
     FROM work_orders wo
     JOIN customers c ON wo.customer_id = c.id
     JOIN machines m ON wo.machine_id = m.id
     WHERE wo.due_date < NOW() 
     AND wo.status != 'completed'`
  );
  
  if (result.rows.length > 0) {
    console.log('🚨 OVERDUE ORDERS:');
    result.rows.forEach(order => {
      console.log(`- #${order.id}: ${order.machine} (${order.customer})`);
    });
  }
};