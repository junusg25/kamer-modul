const express = require('express')
const router = express.Router()
const db = require('../db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')

// Middleware to ensure only admins can access these endpoints
router.use(authenticateToken)
router.use(authorizeRoles('admin'))

// Test endpoint to check if admin routes are working
router.get('/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Admin routes are working',
    user: req.user
  })
})

// GET /api/admin/system-health
router.get('/system-health', async (req, res, next) => {
  try {
    console.log('Admin system-health endpoint called by user:', req.user?.id, 'role:', req.user?.role)
    
    // Get basic system information
    const startTime = Date.now()
    
    // Test database connection
    const dbTest = await db.query('SELECT NOW() as current_time')
    const dbResponseTime = Date.now() - startTime
    
    // Get real system metrics
    const memUsage = process.memoryUsage()
    const totalMemory = memUsage.heapTotal
    const usedMemory = memUsage.heapUsed
    const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100)

    // Get active database connections
    const poolQuery = await db.query('SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database()')
    const activeConnections = parseInt(poolQuery.rows[0].count)

    const systemHealth = {
      server_status: 'online',
      database_status: dbResponseTime < 1000 ? 'connected' : 'slow',
      api_response_time: dbResponseTime,
      memory_usage: memoryUsagePercent,
      cpu_usage: Math.round(process.cpuUsage().user / 1000000), // Convert microseconds to percentage approximation
      disk_usage: 0, // Disk usage requires OS-specific commands, keeping as 0 for now
      active_connections: activeConnections,
      uptime: process.uptime() // Node.js process uptime in seconds
    }

    // Convert uptime to human readable format
    const uptimeSeconds = systemHealth.uptime
    const days = Math.floor(uptimeSeconds / 86400)
    const hours = Math.floor((uptimeSeconds % 86400) / 3600)
    const minutes = Math.floor((uptimeSeconds % 3600) / 60)
    systemHealth.uptime = `${days}d ${hours}h ${minutes}m`

    res.json({
      status: 'success',
      data: systemHealth
    })
  } catch (err) {
    console.error('Error in system-health endpoint:', err)
    next(err)
  }
})

// GET /api/admin/user-activity
router.get('/user-activity', async (req, res, next) => {
  try {
    console.log('Admin user-activity endpoint called by user:', req.user?.id, 'role:', req.user?.role)
    // Get WebSocket service instance
    const websocketService = require('../services/websocketService')
    const wsInstance = websocketService.getInstance()
    
    // Get real-time user statuses from WebSocket memory
    const realTimeUsers = wsInstance.getAllUserStatuses()
    
    console.log('Real-time WebSocket users:', realTimeUsers.length, 'users found')
    realTimeUsers.forEach(user => {
      console.log(`User ${user.name}: status=${user.status}, connectedAt=${user.connectedAt}`)
    })
    
    // Also get all users from database for complete list
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.last_login
      FROM users u
      ORDER BY u.name
    `
    
    const result = await db.query(query)
    const allUsers = result.rows
    
    // Merge real-time status with database users
    const userActivity = allUsers.map(dbUser => {
      const realTimeUser = realTimeUsers.find(rt => rt.id === dbUser.id)
      
      if (realTimeUser) {
        // User is connected via WebSocket - use real-time data
        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          account_status: dbUser.status, // Database account status (active/inactive)
          last_login: dbUser.last_login,
          status: realTimeUser.status, // Online/offline status
          session_duration: realTimeUser.session_duration,
          actions_count: realTimeUser.actions_count,
          login_attempts: realTimeUser.login_attempts
        }
      } else {
        // User is not connected - show as offline
        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          account_status: dbUser.status, // Database account status (active/inactive)
          last_login: dbUser.last_login,
          status: 'offline',
          session_duration: 'N/A',
          actions_count: 0,
          login_attempts: 0
        }
      }
    })

    res.json({
      status: 'success',
      data: userActivity
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/business-metrics
router.get('/business-metrics', async (req, res, next) => {
  try {
    // Get revenue metrics
    const revenueQuery = `
      SELECT 
        COALESCE(SUM(am.sale_price), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN am.sale_date >= DATE_TRUNC('month', CURRENT_DATE) THEN am.sale_price ELSE 0 END), 0) as monthly_revenue,
        COALESCE(SUM(CASE WHEN am.sale_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND am.sale_date < DATE_TRUNC('month', CURRENT_DATE) THEN am.sale_price ELSE 0 END), 0) as last_month_revenue
      FROM assigned_machines am
      WHERE am.is_sale = true AND am.sale_price IS NOT NULL
    `

    // Get work order metrics
    const workOrderQuery = `
      SELECT 
        COUNT(CASE WHEN status IN ('pending', 'in_progress', 'on_hold') THEN 1 END) as active_work_orders,
        COUNT(CASE WHEN status = 'completed' AND completed_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as completed_work_orders,
        0 as pending_approvals
      FROM work_orders
      UNION ALL
      SELECT 
        COUNT(CASE WHEN status IN ('pending', 'in_progress', 'on_hold') THEN 1 END) as active_work_orders,
        COUNT(CASE WHEN status = 'completed' AND completed_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as completed_work_orders,
        0 as pending_approvals
      FROM warranty_work_orders
    `

    // Get inventory alerts
    const inventoryQuery = `
      SELECT COUNT(*) as inventory_alerts
      FROM inventory 
      WHERE quantity <= min_stock_level OR quantity = 0
    `

    // Get customer satisfaction (mock for now)
    const customerSatisfaction = Math.floor(Math.random() * 20) + 80 // Mock: 80-100%

    const [revenueResult, workOrderResult, inventoryResult] = await Promise.all([
      db.query(revenueQuery),
      db.query(workOrderQuery),
      db.query(inventoryQuery)
    ])

    const revenue = revenueResult.rows[0]
    const workOrders = workOrderResult.rows.reduce((acc, row) => ({
      active_work_orders: acc.active_work_orders + row.active_work_orders,
      completed_work_orders: acc.completed_work_orders + row.completed_work_orders,
      pending_approvals: acc.pending_approvals + row.pending_approvals
    }), { active_work_orders: 0, completed_work_orders: 0, pending_approvals: 0 })

    const inventoryAlerts = inventoryResult.rows[0].inventory_alerts

    // Calculate revenue change
    const revenueChange = revenue.last_month_revenue > 0 
      ? ((revenue.monthly_revenue - revenue.last_month_revenue) / revenue.last_month_revenue) * 100
      : 0

    const businessMetrics = {
      total_revenue: parseFloat(revenue.total_revenue) || 0,
      monthly_revenue: parseFloat(revenue.monthly_revenue) || 0,
      revenue_change: Math.round(revenueChange * 100) / 100,
      active_work_orders: workOrders.active_work_orders,
      completed_work_orders: workOrders.completed_work_orders,
      pending_approvals: workOrders.pending_approvals,
      customer_satisfaction: customerSatisfaction,
      inventory_alerts: inventoryAlerts
    }

    res.json({
      status: 'success',
      data: businessMetrics
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/system-alerts
router.get('/system-alerts', async (req, res, next) => {
  try {
    // Get system alerts from database (if you have an alerts table)
    // For now, we'll generate some mock alerts based on system conditions
    
    const alerts = []

    // Check for low inventory
    const lowInventoryQuery = `
      SELECT COUNT(*) as count
      FROM inventory 
      WHERE quantity <= min_stock_level
    `
    const lowInventoryResult = await db.query(lowInventoryQuery)
    if (lowInventoryResult.rows[0].count > 0) {
      alerts.push({
        id: 'low-inventory',
        type: 'warning',
        title: 'Low Inventory Alert',
        message: `${lowInventoryResult.rows[0].count} items are below minimum stock level`,
        timestamp: new Date().toISOString(),
        severity: 'medium',
        resolved: false
      })
    }

    // Check for overdue work orders
    const overdueQuery = `
      SELECT COUNT(*) as count
      FROM work_orders 
      WHERE status IN ('pending', 'in_progress') 
        AND due_date < CURRENT_DATE
      UNION ALL
      SELECT COUNT(*) as count
      FROM warranty_work_orders 
      WHERE status IN ('pending', 'in_progress') 
        AND due_date < CURRENT_DATE
    `
    const overdueResult = await db.query(overdueQuery)
    const totalOverdue = overdueResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0)
    
    if (totalOverdue > 0) {
      alerts.push({
        id: 'overdue-work-orders',
        type: 'warning',
        title: 'Overdue Work Orders',
        message: `${totalOverdue} work orders are overdue`,
        timestamp: new Date().toISOString(),
        severity: 'high',
        resolved: false
      })
    }

    // Check for failed login attempts (mock for now since we don't have login_attempts table)
    // const failedLoginsQuery = `
    //   SELECT COUNT(*) as count
    //   FROM login_attempts 
    //   WHERE success = false 
    //     AND created_at > NOW() - INTERVAL '1 hour'
    // `
    // const failedLoginsResult = await db.query(failedLoginsQuery)
    // if (failedLoginsResult.rows[0].count > 10) {
    //   alerts.push({
    //     id: 'failed-logins',
    //     type: 'error',
    //     title: 'High Failed Login Attempts',
    //     message: `${failedLoginsResult.rows[0].count} failed login attempts in the last hour`,
    //     timestamp: new Date().toISOString(),
    //     severity: 'high',
    //     resolved: false
    //   })
    // }

    // Add some mock system alerts
    alerts.push({
      id: 'system-update',
      type: 'info',
      title: 'System Update Available',
      message: 'A new system update is available for installation',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      severity: 'low',
      resolved: false
    })

    alerts.push({
      id: 'backup-completed',
      type: 'success',
      title: 'Backup Completed',
      message: 'Daily backup completed successfully',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      severity: 'low',
      resolved: true
    })

    res.json({
      status: 'success',
      data: alerts
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/recent-activity
router.get('/recent-activity', async (req, res, next) => {
  try {
    // Get recent user activity (if you have an activity log table)
    // For now, we'll get recent work order and ticket activities
    
    const activityQuery = `
      SELECT 
        'work_order' as entity_type,
        wo.id::text as entity_id,
        wo.formatted_number as entity_name,
        'created' as action,
        'System' as user_name,
        wo.created_at as timestamp,
        '127.0.0.1' as ip_address
      FROM work_orders wo
      WHERE wo.created_at > NOW() - INTERVAL '24 hours'
      
      UNION ALL
      
      SELECT 
        'warranty_work_order' as entity_type,
        wwo.id::text as entity_id,
        wwo.formatted_number as entity_name,
        'created' as action,
        'System' as user_name,
        wwo.created_at as timestamp,
        '127.0.0.1' as ip_address
      FROM warranty_work_orders wwo
      WHERE wwo.created_at > NOW() - INTERVAL '24 hours'
      
      UNION ALL
      
      SELECT 
        'repair_ticket' as entity_type,
        rt.id::text as entity_id,
        rt.formatted_number as entity_name,
        'created' as action,
        u.name as user_name,
        rt.created_at as timestamp,
        '127.0.0.1' as ip_address
      FROM repair_tickets rt
      JOIN users u ON rt.submitted_by = u.id
      WHERE rt.created_at > NOW() - INTERVAL '24 hours'
      
      UNION ALL
      
      SELECT 
        'warranty_repair_ticket' as entity_type,
        wrt.id::text as entity_id,
        wrt.formatted_number as entity_name,
        'created' as action,
        u.name as user_name,
        wrt.created_at as timestamp,
        '127.0.0.1' as ip_address
      FROM warranty_repair_tickets wrt
      JOIN users u ON wrt.submitted_by = u.id
      WHERE wrt.created_at > NOW() - INTERVAL '24 hours'
      
      ORDER BY timestamp DESC
      LIMIT 20
    `

    const result = await db.query(activityQuery)
    
    const recentActivity = result.rows.map((row, index) => ({
      id: `activity-${index}`,
      user_name: row.user_name,
      action: row.action,
      entity_type: row.entity_type,
      entity_name: row.entity_name,
      timestamp: row.timestamp,
      ip_address: row.ip_address
    }))

    res.json({
      status: 'success',
      data: recentActivity
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/resolve-alert
router.post('/resolve-alert', async (req, res, next) => {
  try {
    const { alertId } = req.body
    
    // In a real implementation, you would update the alert status in the database
    // For now, we'll just return success
    
    res.json({
      status: 'success',
      message: 'Alert resolved successfully'
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/system-stats
router.get('/system-stats', async (req, res, next) => {
  try {
    // Get comprehensive system statistics
    const stats = {}

    // User statistics
    const userStatsQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN last_login > NOW() - INTERVAL '24 hours' THEN 1 END) as users_last_24h,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
        COUNT(CASE WHEN role = 'technician' THEN 1 END) as technician_users,
        COUNT(CASE WHEN role = 'sales' THEN 1 END) as sales_users
      FROM users
    `

    // Work order statistics
    const workOrderStatsQuery = `
      SELECT 
        COUNT(*) as total_work_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_work_orders,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_work_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_work_orders,
        COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as monthly_work_orders
      FROM work_orders
      UNION ALL
      SELECT 
        COUNT(*) as total_work_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_work_orders,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_work_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_work_orders,
        COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as monthly_work_orders
      FROM warranty_work_orders
    `

    // Customer statistics
    const customerStatsQuery = `
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_customers,
        COUNT(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as monthly_customers
      FROM customers
    `

    // Machine statistics
    const machineStatsQuery = `
      SELECT 
        COUNT(*) as total_machines,
        COUNT(CASE WHEN warranty_active = true THEN 1 END) as machines_under_warranty,
        COUNT(CASE WHEN is_sale = true THEN 1 END) as machines_sold
      FROM assigned_machines
    `

    const [userStats, workOrderStats, customerStats, machineStats] = await Promise.all([
      db.query(userStatsQuery),
      db.query(workOrderStatsQuery),
      db.query(customerStatsQuery),
      db.query(machineStatsQuery)
    ])

    // Aggregate work order stats
    const aggregatedWorkOrderStats = workOrderStats.rows.reduce((acc, row) => ({
      total_work_orders: acc.total_work_orders + parseInt(row.total_work_orders),
      pending_work_orders: acc.pending_work_orders + parseInt(row.pending_work_orders),
      in_progress_work_orders: acc.in_progress_work_orders + parseInt(row.in_progress_work_orders),
      completed_work_orders: acc.completed_work_orders + parseInt(row.completed_work_orders),
      monthly_work_orders: acc.monthly_work_orders + parseInt(row.monthly_work_orders)
    }), {
      total_work_orders: 0,
      pending_work_orders: 0,
      in_progress_work_orders: 0,
      completed_work_orders: 0,
      monthly_work_orders: 0
    })

    const systemStats = {
      users: userStats.rows[0],
      work_orders: aggregatedWorkOrderStats,
      customers: customerStats.rows[0],
      machines: machineStats.rows[0],
      generated_at: new Date().toISOString()
    }

    res.json({
      status: 'success',
      data: systemStats
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
