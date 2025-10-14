const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/dashboard - Get comprehensive dashboard metrics and statistics
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { user } = req;
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager';
    const isTechnician = user.role === 'technician';

    // Base date filter for recent activity
    const recentDateFilter = "created_at >= NOW() - INTERVAL '30 days'";

    // Comprehensive Work Order Statistics (including warranty and repair tickets)
    const workOrderStats = await db.query(`
      SELECT 
        -- Regular Work Orders
        (SELECT COUNT(*) FROM work_orders WHERE status = 'pending' AND status != 'intake') as pending_orders,
        (SELECT COUNT(*) FROM work_orders WHERE status = 'in_progress') as active_orders,
        (SELECT COUNT(*) FROM work_orders WHERE status = 'completed') as completed_orders,
        (SELECT COUNT(*) FROM work_orders WHERE priority = 'high' AND status != 'completed' AND status != 'intake') as high_priority_orders,
        (SELECT COUNT(*) FROM work_orders WHERE status = 'intake') as intake_tickets,
        
        -- Warranty Work Orders
        (SELECT COUNT(*) FROM warranty_work_orders WHERE status = 'pending') as warranty_pending_orders,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE status = 'in_progress') as warranty_active_orders,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE status = 'completed') as warranty_completed_orders,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE priority = 'high' AND status != 'completed') as warranty_high_priority_orders,
        
        -- Repair Tickets
        (SELECT COUNT(*) FROM repair_tickets WHERE status = 'intake') as repair_tickets_intake,
        (SELECT COUNT(*) FROM repair_tickets WHERE status = 'converted') as repair_tickets_converted,
        (SELECT COUNT(*) FROM repair_tickets WHERE status = 'cancelled') as repair_tickets_cancelled,
        
        -- Warranty Repair Tickets
        (SELECT COUNT(*) FROM warranty_repair_tickets WHERE status = 'intake') as warranty_repair_tickets_intake,
        (SELECT COUNT(*) FROM warranty_repair_tickets WHERE status = 'converted') as warranty_repair_tickets_converted,
        (SELECT COUNT(*) FROM warranty_repair_tickets WHERE status = 'cancelled') as warranty_repair_tickets_cancelled,
        
                    -- Financial Metrics
            (SELECT COALESCE(SUM(quote_total), 0) FROM work_orders WHERE status = 'completed') as total_revenue,
            (SELECT COALESCE(AVG(quote_total), 0) FROM work_orders WHERE status = 'completed') as avg_order_value,
            (SELECT COALESCE(SUM(quote_total), 0) FROM work_orders WHERE status = 'in_progress') as active_revenue,
            (SELECT COALESCE(SUM(quote_total), 0) FROM work_orders WHERE status = 'pending' AND status != 'intake') as pending_revenue
    `);

    // Inventory Statistics
    const inventoryStats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM inventory WHERE quantity < 5 AND quantity > 0) as low_stock_items,
        (SELECT COUNT(*) FROM inventory WHERE quantity = 0) as out_of_stock_items,
        (SELECT COUNT(*) FROM inventory) as total_items,
        (SELECT COALESCE(SUM(quantity * unit_price), 0) FROM inventory) as total_inventory_value,
        (SELECT COALESCE(AVG(unit_price), 0) FROM inventory) as avg_unit_price
    `);

    // Customer and Machine Statistics
    const customerStats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM customers) as total_customers,
        (SELECT COUNT(*) FROM sold_machines) as total_machines,
        (SELECT COUNT(DISTINCT customer_id) FROM work_orders WHERE created_at >= NOW() - INTERVAL '30 days') as active_customers,
        (SELECT COUNT(DISTINCT machine_id) FROM work_orders WHERE created_at >= NOW() - INTERVAL '30 days') as active_machines
    `);

    // Team Statistics
    const technicianStats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'technician') as total_technicians,
        (SELECT COUNT(*) FROM users WHERE role = 'manager') as total_managers,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') as total_admins,
        (SELECT COUNT(*) FROM users WHERE role = 'technician' AND id IN (
          SELECT DISTINCT technician_id FROM work_orders WHERE status IN ('pending', 'in_progress')
        )) as active_technicians
    `);

    // Performance Metrics
    const performanceStats = await db.query(`
      SELECT 
        -- Completion Rates
        (SELECT 
          CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*)), 1)
            ELSE 0 
          END 
        FROM work_orders WHERE status != 'intake') as work_order_completion_rate,
        
        (SELECT 
          CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*)), 1)
            ELSE 0 
          END 
        FROM warranty_work_orders) as warranty_completion_rate,
        
        -- Average Completion Times
        (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600), 0) 
         FROM work_orders WHERE status = 'completed' AND completed_at IS NOT NULL) as avg_completion_hours,
        
        (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600), 0) 
         FROM warranty_work_orders WHERE status = 'completed' AND completed_at IS NOT NULL) as avg_warranty_completion_hours,
        
        -- Conversion Rates
        (SELECT 
          CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN status = 'converted' THEN 1 END) * 100.0 / COUNT(*)), 1)
            ELSE 0 
          END 
        FROM repair_tickets) as repair_ticket_conversion_rate,
        
        (SELECT 
          CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN status = 'converted' THEN 1 END) * 100.0 / COUNT(*)), 1)
            ELSE 0 
          END 
        FROM warranty_repair_tickets) as warranty_repair_ticket_conversion_rate
    `);

    // Recent Activity - Enhanced with all activity types
    const recentActivity = await db.query(`
      SELECT 'work_order_created' as type, id, formatted_number, description, status, created_at, 'Work Order Created' as action_text FROM work_orders WHERE ${recentDateFilter} AND status != 'intake'
      UNION ALL
      SELECT 'work_order_updated' as type, id, formatted_number, description, status, updated_at as created_at, 'Work Order Updated' as action_text FROM work_orders WHERE updated_at >= NOW() - INTERVAL '30 days' AND status != 'intake'
      UNION ALL
      SELECT 'warranty_work_order_created' as type, id, formatted_number, description, status, created_at, 'Warranty Work Order Created' as action_text FROM warranty_work_orders WHERE ${recentDateFilter}
      UNION ALL
      SELECT 'warranty_work_order_updated' as type, id, formatted_number, description, status, updated_at as created_at, 'Warranty Work Order Updated' as action_text FROM warranty_work_orders WHERE updated_at >= NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT 'repair_ticket_created' as type, id, formatted_number, COALESCE(problem_description, description) as description, status, created_at, 'Repair Ticket Created' as action_text FROM repair_tickets WHERE ${recentDateFilter}
      UNION ALL
      SELECT 'repair_ticket_updated' as type, id, formatted_number, COALESCE(problem_description, description) as description, status, updated_at as created_at, 'Repair Ticket Updated' as action_text FROM repair_tickets WHERE updated_at >= NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT 'warranty_repair_ticket_created' as type, id, formatted_number, COALESCE(problem_description, 'Warranty Issue') as description, status, created_at, 'Warranty Repair Ticket Created' as action_text FROM warranty_repair_tickets WHERE ${recentDateFilter}
      UNION ALL
      SELECT 'warranty_repair_ticket_updated' as type, id, formatted_number, COALESCE(problem_description, 'Warranty Issue') as description, status, updated_at as created_at, 'Warranty Repair Ticket Updated' as action_text FROM warranty_repair_tickets WHERE updated_at >= NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT 'customer_created' as type, id, NULL as formatted_number, name as description, 'active' as status, created_at, 'Customer Added' as action_text FROM customers WHERE ${recentDateFilter}
      UNION ALL
      SELECT 'customer_updated' as type, id, NULL as formatted_number, name as description, 'updated' as status, updated_at as created_at, 'Customer Updated' as action_text FROM customers WHERE updated_at >= NOW() - INTERVAL '30 days'
             UNION ALL
               SELECT 'machine_created' as type, am.id, NULL as formatted_number, mm.name as description, 'active' as status, am.assigned_at as created_at, 'Machine Added' as action_text 
         FROM sold_machines am
         LEFT JOIN machine_serials ms ON am.serial_id = ms.id
         LEFT JOIN machine_models mm ON ms.model_id = mm.id
         WHERE am.assigned_at >= NOW() - INTERVAL '30 days'
         UNION ALL
         SELECT 'machine_updated' as type, am.id, NULL as formatted_number, mm.name as description, 'updated' as status, am.updated_at as created_at, 'Machine Updated' as action_text 
         FROM sold_machines am
         LEFT JOIN machine_serials ms ON am.serial_id = ms.id
         LEFT JOIN machine_models mm ON ms.model_id = mm.id
         WHERE am.updated_at >= NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT 'inventory_created' as type, id, NULL as formatted_number, name as description, 'created' as status, created_at, 'Inventory Item Added' as action_text FROM inventory WHERE ${recentDateFilter}
      UNION ALL
      SELECT 'inventory_updated' as type, id, NULL as formatted_number, name as description, 'updated' as status, updated_at as created_at, 'Inventory Item Updated' as action_text FROM inventory WHERE updated_at >= NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 25
    `);

    // Most Used Parts Statistics
    const mostUsedParts = await db.query(`
      SELECT 
        i.id,
        i.name as part_name,
        COALESCE(SUM(woi.quantity), 0) as total_used,
        COUNT(DISTINCT woi.work_order_id) as work_orders_count
      FROM inventory i
      LEFT JOIN work_order_inventory woi ON i.id = woi.inventory_id
      LEFT JOIN work_orders wo ON woi.work_order_id = wo.id
      GROUP BY i.id, i.name
      HAVING COALESCE(SUM(woi.quantity), 0) > 0
      ORDER BY total_used DESC
      LIMIT 5
    `);

    // Most Repaired Machines Statistics
    const mostRepairedMachines = await db.query(`
      SELECT 
        am.id,
        mm.name as name,
        COUNT(wo.id) as repair_count,
        COUNT(DISTINCT wo.customer_id) as unique_customers,
        COALESCE(AVG(EXTRACT(EPOCH FROM (wo.completed_at - wo.created_at))/3600), 0) as avg_repair_hours
      FROM sold_machines am
      LEFT JOIN machine_serials ms ON am.serial_id = ms.id
      LEFT JOIN machine_models mm ON ms.model_id = mm.id
      LEFT JOIN work_orders wo ON am.id = wo.machine_id
      GROUP BY am.id, mm.name
      HAVING COUNT(wo.id) > 0
      ORDER BY repair_count DESC
      LIMIT 5
    `);

    // User-specific data for technicians
    let userSpecificData = null;
    if (isTechnician) {
      const userWorkData = await db.query(`
        SELECT 
          -- User's Work Orders
          (SELECT COUNT(*) FROM work_orders WHERE technician_id = $1 AND status = 'pending' AND status != 'intake') as my_pending_orders,
          (SELECT COUNT(*) FROM work_orders WHERE technician_id = $1 AND status = 'in_progress') as my_active_orders,
          (SELECT COUNT(*) FROM work_orders WHERE technician_id = $1 AND status = 'completed') as my_completed_orders,
          (SELECT COUNT(*) FROM work_orders WHERE technician_id = $1 AND priority = 'high' AND status != 'completed' AND status != 'intake') as my_high_priority_orders,
          
          -- User's Warranty Work Orders
          (SELECT COUNT(*) FROM warranty_work_orders WHERE technician_id = $1 AND status = 'pending') as my_warranty_pending,
          (SELECT COUNT(*) FROM warranty_work_orders WHERE technician_id = $1 AND status = 'in_progress') as my_warranty_active,
          (SELECT COUNT(*) FROM warranty_work_orders WHERE technician_id = $1 AND status = 'completed') as my_warranty_completed,
          (SELECT COUNT(*) FROM warranty_work_orders WHERE technician_id = $1 AND priority = 'high' AND status != 'completed') as my_warranty_high_priority,
          
          -- User's Repair Tickets
          (SELECT COUNT(*) FROM repair_tickets WHERE submitted_by = $1 AND status = 'intake') as my_repair_tickets_intake,
          (SELECT COUNT(*) FROM repair_tickets WHERE submitted_by = $1 AND status = 'converted') as my_repair_tickets_converted,
          
          -- User's Performance
          (SELECT COALESCE(SUM(quote_total), 0) FROM work_orders WHERE technician_id = $1 AND status = 'completed') as my_total_revenue,
          (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600), 0) FROM work_orders WHERE technician_id = $1 AND status = 'completed' AND completed_at IS NOT NULL) as my_avg_completion_hours
      `, [user.id]);
      
      userSpecificData = userWorkData.rows[0];
    }

    // Compile dashboard data
    const dashboard = {
      // Core Statistics
      work_orders: workOrderStats.rows[0],
      inventory: inventoryStats.rows[0],
      customers: customerStats.rows[0],
      technicians: technicianStats.rows[0],
      performance: performanceStats.rows[0],
      
      // Recent Activity
      recent_activity: recentActivity.rows,
      
      // Most Used Parts and Repaired Machines
      most_used_parts: mostUsedParts.rows,
      most_repaired_machines: mostRepairedMachines.rows,
      
      // User-specific data (for technicians)
      user_specific: userSpecificData,
      
      // Role-based access
      user_role: user.role,
      is_admin: isAdmin,
      is_manager: isManager,
      is_technician: isTechnician
    };

    res.json({ status: 'success', data: dashboard });
  } catch (err) { 
    console.error('Dashboard error:', err);
    next(err); 
  }
});

// GET /api/dashboard/technician-workload - Get technician workload distribution
router.get('/technician-workload', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        -- Regular Work Orders
        COALESCE(wo_stats.total_regular_orders, 0) as total_regular_orders,
        COALESCE(wo_stats.pending_regular_orders, 0) as pending_regular_orders,
        COALESCE(wo_stats.active_regular_orders, 0) as active_regular_orders,
        COALESCE(wo_stats.completed_regular_orders, 0) as completed_regular_orders,
        COALESCE(wo_stats.high_priority_regular_orders, 0) as high_priority_regular_orders,
        
        -- Warranty Work Orders
        COALESCE(wwo_stats.total_warranty_orders, 0) as total_warranty_orders,
        COALESCE(wwo_stats.pending_warranty_orders, 0) as pending_warranty_orders,
        COALESCE(wwo_stats.active_warranty_orders, 0) as active_warranty_orders,
        COALESCE(wwo_stats.completed_warranty_orders, 0) as completed_warranty_orders,
        COALESCE(wwo_stats.high_priority_warranty_orders, 0) as high_priority_warranty_orders,
        
        -- Repair Tickets
        COALESCE(rt_stats.total_repair_tickets, 0) as total_repair_tickets,
        COALESCE(rt_stats.intake_repair_tickets, 0) as intake_repair_tickets,
        COALESCE(rt_stats.converted_repair_tickets, 0) as converted_repair_tickets,
        
        -- Warranty Repair Tickets
        COALESCE(wrt_stats.total_warranty_repair_tickets, 0) as total_warranty_repair_tickets,
        COALESCE(wrt_stats.intake_warranty_repair_tickets, 0) as intake_warranty_repair_tickets,
        COALESCE(wrt_stats.converted_warranty_repair_tickets, 0) as converted_warranty_repair_tickets,
        
        -- Performance Metrics
        COALESCE(wo_stats.total_revenue, 0) + COALESCE(wwo_stats.total_revenue, 0) as total_revenue,
        COALESCE(wo_stats.avg_completion_hours, 0) as avg_completion_hours
      FROM users u
      LEFT JOIN (
        SELECT 
          technician_id,
          COUNT(*) as total_regular_orders,
          COUNT(CASE WHEN status = 'pending' AND status != 'intake' THEN 1 END) as pending_regular_orders,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_regular_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_regular_orders,
          COUNT(CASE WHEN priority = 'high' AND status != 'completed' AND status != 'intake' THEN 1 END) as high_priority_regular_orders,
          COALESCE(SUM(quote_total), 0) as total_revenue,
          COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600), 0) as avg_completion_hours
        FROM work_orders 
        WHERE technician_id IS NOT NULL
        GROUP BY technician_id
      ) wo_stats ON u.id = wo_stats.technician_id
      LEFT JOIN (
        SELECT 
          technician_id,
          COUNT(*) as total_warranty_orders,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_warranty_orders,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_warranty_orders,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_warranty_orders,
          COUNT(CASE WHEN priority = 'high' AND status != 'completed' THEN 1 END) as high_priority_warranty_orders,
          COALESCE(SUM(quote_total), 0) as total_revenue
        FROM warranty_work_orders 
        WHERE technician_id IS NOT NULL
        GROUP BY technician_id
      ) wwo_stats ON u.id = wwo_stats.technician_id
      LEFT JOIN (
        SELECT 
          submitted_by,
          COUNT(*) as total_repair_tickets,
          COUNT(CASE WHEN status = 'intake' THEN 1 END) as intake_repair_tickets,
          COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_repair_tickets
        FROM repair_tickets 
        WHERE submitted_by IS NOT NULL
        GROUP BY submitted_by
      ) rt_stats ON u.id = rt_stats.submitted_by
      LEFT JOIN (
        SELECT 
          submitted_by,
          COUNT(*) as total_warranty_repair_tickets,
          COUNT(CASE WHEN status = 'intake' THEN 1 END) as intake_warranty_repair_tickets,
          COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_warranty_repair_tickets
        FROM warranty_repair_tickets 
        WHERE submitted_by IS NOT NULL
        GROUP BY submitted_by
      ) wrt_stats ON u.id = wrt_stats.submitted_by
      WHERE u.role = 'technician'
      ORDER BY (COALESCE(wo_stats.total_regular_orders, 0) + COALESCE(wwo_stats.total_warranty_orders, 0)) DESC
    `);

    // Calculate additional metrics for each technician
    const enhancedResult = result.rows.map(tech => {
      const totalRegular = parseInt(tech.total_regular_orders) || 0;
      const totalWarranty = parseInt(tech.total_warranty_orders) || 0;
      const totalOrders = totalRegular + totalWarranty;
      
      const completedRegular = parseInt(tech.completed_regular_orders) || 0;
      const completedWarranty = parseInt(tech.completed_warranty_orders) || 0;
      const totalCompleted = completedRegular + completedWarranty;
      
      const avgHours = parseFloat(tech.avg_completion_hours) || 0;
      
      return {
        ...tech,
        total_orders: totalOrders,
        total_completed_orders: totalCompleted,
        completion_rate: totalOrders > 0 ? Math.round((totalCompleted / totalOrders) * 100) : 0,
        efficiency_score: avgHours > 0 ? Math.round((8 / avgHours) * 100) : 85,
        workload_score: Math.min(100, Math.round((totalOrders / 10) * 100)), // Assuming 10 orders is 100% workload
        total_revenue: parseFloat(tech.total_revenue) || 0,
        avg_completion_hours: avgHours
      };
    });

    res.json({ status: 'success', data: enhancedResult });
  } catch (err) { next(err); }
});

// GET /api/dashboard/priority-breakdown - Get priority distribution across all work types
router.get('/priority-breakdown', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        priority,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status != 'completed' AND status != 'intake' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress
      FROM (
        SELECT priority, status FROM work_orders WHERE status != 'intake'
        UNION ALL
        SELECT priority, status FROM warranty_work_orders
        UNION ALL
        SELECT 'medium' as priority, status FROM repair_tickets
        UNION ALL
        SELECT 'high' as priority, status FROM warranty_repair_tickets
      ) combined_orders
      GROUP BY priority
      ORDER BY 
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
        END
    `);
    
    res.json({ status: 'success', data: result.rows });
  } catch (err) { next(err); }
});

// GET /api/dashboard/status-breakdown - Get status distribution across all work types
router.get('/status-breakdown', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority
      FROM (
        SELECT status, priority FROM work_orders WHERE status != 'intake'
        UNION ALL
        SELECT status, priority FROM warranty_work_orders
        UNION ALL
        SELECT status, 'medium' as priority FROM repair_tickets
        UNION ALL
        SELECT status, 'high' as priority FROM warranty_repair_tickets
      ) combined_orders
      GROUP BY status
      ORDER BY count DESC
    `);
    
    res.json({ status: 'success', data: result.rows });
  } catch (err) { next(err); }
});

// GET /api/dashboard/quick-stats - Get quick overview stats for dashboard cards
router.get('/quick-stats', authenticateToken, async (req, res, next) => {
  try {
    const { user } = req;
    const isTechnician = user.role === 'technician';

    let query = `
      SELECT 
        -- Work Orders
        (SELECT COUNT(*) FROM work_orders WHERE status = 'pending' AND status != 'intake') as pending_work_orders,
        (SELECT COUNT(*) FROM work_orders WHERE status = 'in_progress') as active_work_orders,
        (SELECT COUNT(*) FROM work_orders WHERE status = 'completed') as completed_work_orders,
        (SELECT COUNT(*) FROM work_orders WHERE priority = 'high' AND status != 'completed' AND status != 'intake') as high_priority_work_orders,
        
        -- Warranty Work Orders
        (SELECT COUNT(*) FROM warranty_work_orders WHERE status = 'pending') as pending_warranty_orders,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE status = 'in_progress') as active_warranty_orders,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE status = 'completed') as completed_warranty_orders,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE priority = 'high' AND status != 'completed') as high_priority_warranty_orders,
        
        -- Repair Tickets
        (SELECT COUNT(*) FROM repair_tickets WHERE status = 'intake') as intake_repair_tickets,
        (SELECT COUNT(*) FROM repair_tickets WHERE status = 'converted') as converted_repair_tickets,
        
        -- Warranty Repair Tickets
        (SELECT COUNT(*) FROM warranty_repair_tickets WHERE status = 'intake') as intake_warranty_repair_tickets,
        (SELECT COUNT(*) FROM warranty_repair_tickets WHERE status = 'converted') as converted_warranty_repair_tickets,
        
        -- Financial
        (SELECT COALESCE(SUM(quote_total), 0) FROM work_orders WHERE status = 'completed') as total_revenue,
        (SELECT COALESCE(SUM(quote_total), 0) FROM work_orders WHERE status = 'in_progress') as active_revenue,
        (SELECT COALESCE(SUM(quote_total), 0) FROM work_orders WHERE status = 'pending' AND status != 'intake') as pending_revenue,
        
        -- Inventory
        (SELECT COUNT(*) FROM inventory WHERE quantity < 5 AND quantity > 0) as low_stock_items,
        (SELECT COUNT(*) FROM inventory WHERE quantity = 0) as out_of_stock_items,
        (SELECT COUNT(*) FROM inventory) as total_inventory_items,
        
        -- Customers and Machines
        (SELECT COUNT(*) FROM customers) as total_customers,
        (SELECT COUNT(*) FROM sold_machines) as total_machines,
        (SELECT COUNT(DISTINCT customer_id) FROM work_orders WHERE created_at >= NOW() - INTERVAL '30 days') as active_customers,
        
        -- Team
        (SELECT COUNT(*) FROM users WHERE role = 'technician') as total_technicians,
        (SELECT COUNT(*) FROM users WHERE role = 'manager') as total_managers
    `;

    // Add user-specific stats for technicians
    if (isTechnician) {
      query += `,
        -- User-specific stats
        (SELECT COUNT(*) FROM work_orders WHERE technician_id = $1 AND status = 'pending' AND status != 'intake') as my_pending_work_orders,
        (SELECT COUNT(*) FROM work_orders WHERE technician_id = $1 AND status = 'in_progress') as my_active_work_orders,
        (SELECT COUNT(*) FROM work_orders WHERE technician_id = $1 AND status = 'completed') as my_completed_work_orders,
        (SELECT COUNT(*) FROM work_orders WHERE technician_id = $1 AND priority = 'high' AND status != 'completed' AND status != 'intake') as my_high_priority_work_orders,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE technician_id = $1 AND status = 'pending') as my_pending_warranty_orders,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE technician_id = $1 AND status = 'in_progress') as my_active_warranty_orders,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE technician_id = $1 AND status = 'completed') as my_completed_warranty_orders,
        (SELECT COUNT(*) FROM repair_tickets WHERE submitted_by = $1 AND status = 'intake') as my_intake_repair_tickets,
        (SELECT COUNT(*) FROM repair_tickets WHERE submitted_by = $1 AND status = 'converted') as my_converted_repair_tickets,
        (SELECT COALESCE(SUM(quote_total), 0) FROM work_orders WHERE technician_id = $1 AND status = 'completed') as my_total_revenue,
        (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600), 0) FROM work_orders WHERE technician_id = $1 AND status = 'completed' AND completed_at IS NOT NULL) as my_avg_completion_hours
      `;
    }

    const params = isTechnician ? [user.id] : [];
    const result = await db.query(query, params);
    
    const stats = result.rows[0];
    
    // Calculate derived metrics
    const totalWorkOrders = parseInt(stats.pending_work_orders) + parseInt(stats.active_work_orders) + parseInt(stats.completed_work_orders);
    const totalWarrantyOrders = parseInt(stats.pending_warranty_orders) + parseInt(stats.active_warranty_orders) + parseInt(stats.completed_warranty_orders);
    const totalRepairTickets = parseInt(stats.intake_repair_tickets) + parseInt(stats.converted_repair_tickets);
    const totalWarrantyRepairTickets = parseInt(stats.intake_warranty_repair_tickets) + parseInt(stats.converted_warranty_repair_tickets);
    
    const workOrderCompletionRate = totalWorkOrders > 0 ? Math.round((parseInt(stats.completed_work_orders) / totalWorkOrders) * 100) : 0;
    const warrantyCompletionRate = totalWarrantyOrders > 0 ? Math.round((parseInt(stats.completed_warranty_orders) / totalWarrantyOrders) * 100) : 0;
    const repairTicketConversionRate = totalRepairTickets > 0 ? Math.round((parseInt(stats.converted_repair_tickets) / totalRepairTickets) * 100) : 0;
    const warrantyRepairTicketConversionRate = totalWarrantyRepairTickets > 0 ? Math.round((parseInt(stats.converted_warranty_repair_tickets) / totalWarrantyRepairTickets) * 100) : 0;

    // Add calculated metrics to response
    const enhancedStats = {
      ...stats,
      total_work_orders: totalWorkOrders,
      total_warranty_orders: totalWarrantyOrders,
      total_repair_tickets: totalRepairTickets,
      total_warranty_repair_tickets: totalWarrantyRepairTickets,
      work_order_completion_rate: workOrderCompletionRate,
      warranty_completion_rate: warrantyCompletionRate,
      repair_ticket_conversion_rate: repairTicketConversionRate,
      warranty_repair_ticket_conversion_rate: warrantyRepairTicketConversionRate,
      total_revenue: parseFloat(stats.total_revenue) || 0,
      active_revenue: parseFloat(stats.active_revenue) || 0,
      pending_revenue: parseFloat(stats.pending_revenue) || 0
    };

    // Add user-specific calculated metrics for technicians
    if (isTechnician) {
      const myTotalWorkOrders = parseInt(stats.my_pending_work_orders) + parseInt(stats.my_active_work_orders) + parseInt(stats.my_completed_work_orders);
      const myTotalWarrantyOrders = parseInt(stats.my_pending_warranty_orders) + parseInt(stats.my_active_warranty_orders) + parseInt(stats.my_completed_warranty_orders);
      
      enhancedStats.my_total_work_orders = myTotalWorkOrders;
      enhancedStats.my_total_warranty_orders = myTotalWarrantyOrders;
      enhancedStats.my_work_order_completion_rate = myTotalWorkOrders > 0 ? Math.round((parseInt(stats.my_completed_work_orders) / myTotalWorkOrders) * 100) : 0;
      enhancedStats.my_warranty_completion_rate = myTotalWarrantyOrders > 0 ? Math.round((parseInt(stats.my_completed_warranty_orders) / myTotalWarrantyOrders) * 100) : 0;
      enhancedStats.my_total_revenue = parseFloat(stats.my_total_revenue) || 0;
      enhancedStats.my_avg_completion_hours = parseFloat(stats.my_avg_completion_hours) || 0;
    }

    res.json({ status: 'success', data: enhancedStats });
  } catch (err) { 
    console.error('Quick stats error:', err);
    next(err); 
  }
});

// GET /api/dashboard/sidebar-counts - Get counts for sidebar badges
router.get('/sidebar-counts', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        -- Repair Tickets (intake only)
        (SELECT COUNT(*) FROM repair_tickets WHERE status = 'intake') as repair_tickets_count,
        
        -- Warranty Repair Tickets (intake only)
        (SELECT COUNT(*) FROM warranty_repair_tickets WHERE status = 'intake') as warranty_repair_tickets_count,
        
        -- Notifications (unread)
        (SELECT COUNT(*) FROM notifications WHERE is_read = false) as unread_notifications_count
    `);
    
    const counts = result.rows[0];
    
    const repairTicketsCount = parseInt(counts.repair_tickets_count);
    const warrantyRepairTicketsCount = parseInt(counts.warranty_repair_tickets_count);
    
    const sidebarCounts = {
      repair_tickets: repairTicketsCount,
      warranty_repair_tickets: warrantyRepairTicketsCount,
      non_warranty_total: repairTicketsCount, // Only repair tickets for now
      warranty_total: warrantyRepairTicketsCount, // Only warranty repair tickets for now
      notifications: {
        unread: parseInt(counts.unread_notifications_count)
      }
    };
    
    res.json({ status: 'success', data: sidebarCounts });
  } catch (err) { 
    console.error('Sidebar counts error:', err);
    next(err); 
  }
});

module.exports = router;
