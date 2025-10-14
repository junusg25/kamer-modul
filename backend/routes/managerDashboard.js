const express = require('express')
const router = express.Router()
const db = require('../db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')

// Middleware to ensure only managers and admins can access
router.use(authenticateToken)
router.use(authorizeRoles('manager', 'admin'))

// GET /api/manager-dashboard/overview - Team overview metrics
router.get('/overview', async (req, res, next) => {
  try {
    const { time_period = 'month', start_date, end_date } = req.query
    
    // Calculate date range based on time period
    let dateCondition = "completed_at >= DATE_TRUNC('month', CURRENT_DATE)"
    
    if (time_period === 'custom' && start_date && end_date) {
      dateCondition = `completed_at >= '${start_date}' AND completed_at <= '${end_date}'`
    } else if (time_period === 'week') {
      dateCondition = "completed_at >= DATE_TRUNC('week', CURRENT_DATE)"
    } else if (time_period === 'quarter') {
      dateCondition = "completed_at >= DATE_TRUNC('quarter', CURRENT_DATE)"
    } else if (time_period === 'year') {
      dateCondition = "completed_at >= DATE_TRUNC('year', CURRENT_DATE)"
    }
    
    // Key metrics
    const metricsQuery = `
      SELECT 
        -- Work Orders (including warranty) - Active means "in_progress" only
        (SELECT COUNT(*) FROM work_orders WHERE status = 'in_progress') as active_work_orders,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE status = 'in_progress') as active_warranty_orders,
        (SELECT COUNT(*) FROM work_orders WHERE status = 'pending') as pending_work_orders,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE status = 'pending') as pending_warranty_orders,
        (SELECT COUNT(*) FROM repair_tickets WHERE status = 'intake') as pending_tickets,
        (SELECT COUNT(*) FROM warranty_repair_tickets WHERE status = 'intake') as pending_warranty_tickets,
        
        -- Completed in selected period
        (SELECT COUNT(*) FROM work_orders WHERE status = 'completed' AND ${dateCondition}) as completed_work_orders,
        (SELECT COUNT(*) FROM warranty_work_orders WHERE status = 'completed' AND ${dateCondition}) as completed_warranty_orders,
        
        -- Team utilization
        (SELECT COUNT(DISTINCT technician_id) FROM work_orders 
         WHERE status IN ('pending', 'in_progress') AND technician_id IS NOT NULL) as active_technicians,
        (SELECT COUNT(DISTINCT technician_id) FROM warranty_work_orders 
         WHERE status IN ('pending', 'in_progress') AND technician_id IS NOT NULL) as active_warranty_technicians,
        (SELECT COUNT(*) FROM users WHERE role = 'technician' AND status = 'active') as total_technicians
    `
    
    const metricsResult = await db.query(metricsQuery)
    const metrics = metricsResult.rows[0]
    
    // Calculate totals including warranty work orders
    const totalActiveWorkOrders = parseInt(metrics.active_work_orders) + parseInt(metrics.active_warranty_orders)
    const totalPendingWorkOrders = parseInt(metrics.pending_work_orders) + parseInt(metrics.pending_warranty_orders)
    const totalPendingTickets = parseInt(metrics.pending_tickets) + parseInt(metrics.pending_warranty_tickets)
    const totalCompletedThisMonth = parseInt(metrics.completed_work_orders) + parseInt(metrics.completed_warranty_orders)
    
    // Calculate team utilization percentage (including warranty technicians)
    const totalActiveTechnicians = Math.max(
      parseInt(metrics.active_technicians), 
      parseInt(metrics.active_warranty_technicians)
    )
    const teamUtilization = metrics.total_technicians > 0
      ? Math.round((totalActiveTechnicians / metrics.total_technicians) * 100)
      : 0

    res.json({
      status: 'success',
      data: {
        active_work_orders: totalActiveWorkOrders,
        pending_work_orders: totalPendingWorkOrders,
        pending_tickets: totalPendingTickets,
        completed_this_month: totalCompletedThisMonth,
        team_utilization: teamUtilization,
        active_technicians: parseInt(metrics.active_technicians),
        total_technicians: parseInt(metrics.total_technicians)
      }
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/manager-dashboard/team-workload - Team workload distribution
router.get('/team-workload', async (req, res, next) => {
  try {
    const { time_period = 'month', start_date, end_date } = req.query
    
    // Calculate date range based on time period
    let dateCondition = "DATE_TRUNC('month', CURRENT_DATE)"
    
    if (time_period === 'custom' && start_date && end_date) {
      dateCondition = `'${start_date}' AND completed_at <= '${end_date}'`
    } else if (time_period === 'week') {
      dateCondition = "DATE_TRUNC('week', CURRENT_DATE)"
    } else if (time_period === 'quarter') {
      dateCondition = "DATE_TRUNC('quarter', CURRENT_DATE)"
    } else if (time_period === 'year') {
      dateCondition = "DATE_TRUNC('year', CURRENT_DATE)"
    }
    
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.status as account_status,
        u.last_login,
        
        -- Regular Work Orders
        COUNT(DISTINCT CASE WHEN wo.status = 'in_progress' THEN wo.id END) as in_progress_work_orders,
        COUNT(DISTINCT CASE WHEN wo.status = 'pending' THEN wo.id END) as pending_work_orders,
        COUNT(DISTINCT CASE WHEN wo.status = 'completed' AND wo.completed_at >= ${dateCondition} THEN wo.id END) as completed_work_orders,
        
        -- Warranty Work Orders
        COUNT(DISTINCT CASE WHEN wwo.status = 'in_progress' THEN wwo.id END) as in_progress_warranty_orders,
        COUNT(DISTINCT CASE WHEN wwo.status = 'pending' THEN wwo.id END) as pending_warranty_orders,
        COUNT(DISTINCT CASE WHEN wwo.status = 'completed' AND wwo.completed_at >= ${dateCondition} THEN wwo.id END) as completed_warranty_orders,
        
        -- Performance metrics (only for completed work orders in selected period)
        COALESCE(AVG(CASE WHEN wo.status = 'completed' AND wo.completed_at IS NOT NULL 
          AND wo.completed_at >= ${dateCondition}
          THEN EXTRACT(EPOCH FROM (wo.completed_at - wo.created_at))/3600 END), 0) as avg_completion_hours
        
      FROM users u
      LEFT JOIN work_orders wo ON u.id = wo.technician_id
      LEFT JOIN warranty_work_orders wwo ON u.id = wwo.technician_id
      WHERE u.role = 'technician' AND u.status = 'active'
      GROUP BY u.id, u.name, u.email, u.status, u.last_login
      ORDER BY in_progress_work_orders DESC, pending_work_orders DESC
    `
    
    const result = await db.query(query)
    
    // Calculate workload status for each technician
    const teamWorkload = result.rows.map(tech => {
      // Combine regular + warranty work orders
      const activeWorkOrders = parseInt(tech.in_progress_work_orders) + parseInt(tech.in_progress_warranty_orders)
      const pendingWorkOrders = parseInt(tech.pending_work_orders) + parseInt(tech.pending_warranty_orders)
      const completedWorkOrders = parseInt(tech.completed_work_orders) + parseInt(tech.completed_warranty_orders)
      const totalActive = activeWorkOrders + pendingWorkOrders
      
      let workloadStatus = 'low' // green
      if (totalActive >= 10) workloadStatus = 'high' // red
      else if (totalActive >= 6) workloadStatus = 'medium' // yellow
      
      return {
        ...tech,
        active_work_orders: activeWorkOrders,
        pending_work_orders: pendingWorkOrders,
        completed_this_month: completedWorkOrders,
        total_active: totalActive,
        workload_status: workloadStatus,
        avg_completion_hours: parseFloat(tech.avg_completion_hours).toFixed(1)
      }
    })

    res.json({
      status: 'success',
      data: teamWorkload
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/manager-dashboard/priority-work-orders - High priority work orders
router.get('/priority-work-orders', async (req, res, next) => {
  try {
    const query = `
      SELECT 
        wo.id,
        wo.formatted_number,
        wo.description,
        wo.status,
        wo.priority,
        wo.created_at,
        c.name as customer_name,
        u.name as technician_name,
        wo.technician_id
      FROM work_orders wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN users u ON wo.technician_id = u.id
      WHERE wo.priority = 'high' 
        AND wo.status NOT IN ('completed', 'cancelled', 'intake')
      
      UNION ALL
      
      SELECT 
        wwo.id,
        wwo.formatted_number,
        wwo.description,
        wwo.status,
        wwo.priority,
        wwo.created_at,
        c.name as customer_name,
        u.name as technician_name,
        wwo.technician_id
      FROM warranty_work_orders wwo
      LEFT JOIN customers c ON wwo.customer_id = c.id
      LEFT JOIN users u ON wwo.technician_id = u.id
      WHERE wwo.priority = 'high' 
        AND wwo.status NOT IN ('completed', 'cancelled', 'intake')
      
      ORDER BY created_at DESC
      LIMIT 20
    `
    
    const result = await db.query(query)

    res.json({
      status: 'success',
      data: result.rows
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/manager-dashboard/recent-activity - Recent team activity
router.get('/recent-activity', async (req, res, next) => {
  try {
    const query = `
      SELECT 
        'work_order' as entity_type,
        wo.id::text as entity_id,
        wo.formatted_number as entity_name,
        wo.status,
        wo.updated_at as timestamp,
        u.name as user_name,
        'Status changed to ' || wo.status as action
      FROM work_orders wo
      LEFT JOIN users u ON wo.technician_id = u.id
      WHERE wo.updated_at >= NOW() - INTERVAL '24 hours'
      
      UNION ALL
      
      SELECT 
        'repair_ticket' as entity_type,
        rt.id::text as entity_id,
        rt.formatted_number as entity_name,
        rt.status,
        rt.created_at as timestamp,
        u.name as user_name,
        'Ticket created' as action
      FROM repair_tickets rt
      LEFT JOIN users u ON rt.submitted_by = u.id
      WHERE rt.created_at >= NOW() - INTERVAL '24 hours'
      
      UNION ALL
      
      SELECT 
        'customer' as entity_type,
        c.id::text as entity_id,
        c.name as entity_name,
        'active' as status,
        c.created_at as timestamp,
        'System' as user_name,
        'Customer added' as action
      FROM customers c
      WHERE c.created_at >= NOW() - INTERVAL '24 hours'
      
      ORDER BY timestamp DESC
      LIMIT 20
    `
    
    const result = await db.query(query)

    res.json({
      status: 'success',
      data: result.rows
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/manager-dashboard/technician-performance - Detailed technician performance
router.get('/technician-performance', async (req, res, next) => {
  try {
    const { period = 'month' } = req.query
    
    let dateFilter = "wo.completed_at >= DATE_TRUNC('month', CURRENT_DATE)"
    if (period === 'week') {
      dateFilter = "wo.completed_at >= DATE_TRUNC('week', CURRENT_DATE)"
    } else if (period === 'quarter') {
      dateFilter = "wo.completed_at >= DATE_TRUNC('quarter', CURRENT_DATE)"
    }
    
    const query = `
      SELECT 
        u.id,
        u.name,
        COUNT(CASE WHEN ${dateFilter} THEN wo.id END) as completed_count,
        COALESCE(AVG(CASE WHEN ${dateFilter} 
          THEN EXTRACT(EPOCH FROM (wo.completed_at - wo.created_at))/3600 END), 0) as avg_completion_hours,
        COALESCE(SUM(CASE WHEN ${dateFilter} THEN wo.quote_total END), 0) as total_revenue,
        COUNT(CASE WHEN wo.status IN ('pending', 'in_progress') THEN wo.id END) as current_workload
      FROM users u
      LEFT JOIN work_orders wo ON u.id = wo.technician_id
      WHERE u.role = 'technician' AND u.status = 'active'
      GROUP BY u.id, u.name
      ORDER BY completed_count DESC
    `
    
    const result = await db.query(query)
    
    const performance = result.rows.map(tech => ({
      ...tech,
      completed_count: parseInt(tech.completed_count),
      avg_completion_hours: parseFloat(tech.avg_completion_hours).toFixed(1),
      total_revenue: parseFloat(tech.total_revenue),
      current_workload: parseInt(tech.current_workload)
    }))

    res.json({
      status: 'success',
      data: performance
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/manager-dashboard/sales-overview - Sales team overview
router.get('/sales-overview', async (req, res, next) => {
  try {
    const { time_period = 'month', start_date, end_date } = req.query
    
    // Calculate date range based on time period
    let dateCondition = "DATE_TRUNC('month', CURRENT_DATE)"
    
    if (time_period === 'custom' && start_date && end_date) {
      dateCondition = `'${start_date}'`
      var endDateCondition = `'${end_date}'`
    } else if (time_period === 'week') {
      dateCondition = "DATE_TRUNC('week', CURRENT_DATE)"
    } else if (time_period === 'quarter') {
      dateCondition = "DATE_TRUNC('quarter', CURRENT_DATE)"
    } else if (time_period === 'year') {
      dateCondition = "DATE_TRUNC('year', CURRENT_DATE)"
    }
    
    const endDateFilter = endDateCondition ? ` AND sale_date <= ${endDateCondition}` : ''
    const endDateFilterLeads = endDateCondition ? ` AND updated_at <= ${endDateCondition}` : ''
    const endDateFilterQuotes = endDateCondition ? ` AND updated_at <= ${endDateCondition}` : ''
    const endDateFilterCreated = endDateCondition ? ` AND created_at <= ${endDateCondition}` : ''
    
    const query = `
      SELECT 
        -- Sales metrics (selected period)
        (SELECT COALESCE(SUM(sale_price), 0) FROM sold_machines 
         WHERE is_sale = true AND sale_date >= ${dateCondition}${endDateFilter}) as monthly_sales_revenue,
        (SELECT COUNT(*) FROM sold_machines 
         WHERE is_sale = true AND sale_date >= ${dateCondition}${endDateFilter}) as monthly_sales_count,
        
        -- Leads metrics
        (SELECT COUNT(*) FROM leads WHERE sales_stage NOT IN ('won', 'lost')) as active_leads,
        (SELECT COUNT(*) FROM leads WHERE sales_stage = 'won' 
         AND updated_at >= ${dateCondition}${endDateFilterLeads}) as won_leads_month,
        (SELECT COUNT(*) FROM leads WHERE created_at >= ${dateCondition}${endDateFilterCreated}) as new_leads_month,
        
        -- Quotes metrics
        (SELECT COUNT(*) FROM quotes WHERE status = 'sent') as pending_quotes,
        (SELECT COUNT(*) FROM quotes WHERE status = 'accepted' 
         AND updated_at >= ${dateCondition}${endDateFilterQuotes}) as accepted_quotes_month,
        
        -- Conversion rate
        (SELECT COUNT(*) FROM leads WHERE sales_stage = 'won' 
         AND updated_at >= DATE_TRUNC('month', CURRENT_DATE)) as won_count,
        (SELECT COUNT(*) FROM leads WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as total_count
    `
    
    const result = await db.query(query)
    const sales = result.rows[0]
    
    // Calculate conversion rate
    const conversionRate = sales.total_count > 0
      ? ((sales.won_count / sales.total_count) * 100)
      : 0

    res.json({
      status: 'success',
      data: {
        monthly_sales_revenue: parseFloat(sales.monthly_sales_revenue),
        monthly_sales_count: parseInt(sales.monthly_sales_count),
        active_leads: parseInt(sales.active_leads),
        won_leads_month: parseInt(sales.won_leads_month),
        new_leads_month: parseInt(sales.new_leads_month),
        pending_quotes: parseInt(sales.pending_quotes),
        accepted_quotes_month: parseInt(sales.accepted_quotes_month),
        conversion_rate: parseFloat(conversionRate.toFixed(2))
      }
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/manager-dashboard/sales-team - Sales team performance
router.get('/sales-team', async (req, res, next) => {
  try {
    const { time_period = 'month', start_date, end_date } = req.query
    
    // Calculate date range based on time period
    let dateCondition = "DATE_TRUNC('month', CURRENT_DATE)"
    let targetType = 'monthly'
    
    if (time_period === 'custom' && start_date && end_date) {
      dateCondition = `'${start_date}'`
      var endDateCondition = `'${end_date}'`
      targetType = 'monthly' // Default to monthly for custom ranges
    } else if (time_period === 'week') {
      dateCondition = "DATE_TRUNC('week', CURRENT_DATE)"
      targetType = 'monthly'
    } else if (time_period === 'quarter') {
      dateCondition = "DATE_TRUNC('quarter', CURRENT_DATE)"
      targetType = 'quarterly'
    } else if (time_period === 'year') {
      dateCondition = "DATE_TRUNC('year', CURRENT_DATE)"
      targetType = 'yearly'
    }
    
    const endDateFilter = endDateCondition ? ` AND am.sale_date <= ${endDateCondition}` : ''
    const endDateFilterLeads = endDateCondition ? ` AND l.updated_at <= ${endDateCondition}` : ''
    
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        
        -- Leads
        COUNT(DISTINCT l.id) as total_leads,
        COUNT(DISTINCT CASE WHEN l.sales_stage = 'won' 
          AND l.updated_at >= ${dateCondition}${endDateFilterLeads} THEN l.id END) as won_leads,
        
        -- Quotes
        COUNT(DISTINCT q.id) as total_quotes,
        COUNT(DISTINCT CASE WHEN q.status = 'accepted' THEN q.id END) as accepted_quotes,
        
        -- Sales
        COUNT(DISTINCT CASE WHEN am.is_sale = true 
          AND am.sale_date >= ${dateCondition}${endDateFilter} THEN am.id END) as deals_closed,
        COALESCE(SUM(CASE WHEN am.is_sale = true 
          AND am.sale_date >= ${dateCondition}${endDateFilter} THEN am.sale_price END), 0) as revenue,
        
        -- Target (get from sales_targets table)
        (SELECT target_amount FROM sales_targets st 
         WHERE st.user_id = u.id 
         AND st.target_type = '${targetType}' 
         AND st.is_active = true 
         AND st.target_period_start <= CURRENT_DATE 
         AND st.target_period_end >= CURRENT_DATE
         LIMIT 1) as target
        
      FROM users u
      LEFT JOIN leads l ON u.id = l.assigned_to
      LEFT JOIN quotes q ON u.id = q.created_by
      LEFT JOIN sold_machines am ON u.id = am.sold_by_user_id
      WHERE u.role = 'sales' AND u.status = 'active'
      GROUP BY u.id, u.name, u.email
      ORDER BY revenue DESC
    `
    
    const result = await db.query(query)
    
    const salesTeam = result.rows.map(person => {
      const revenue = parseFloat(person.revenue)
      const target = parseFloat(person.target || 0)
      const targetProgress = target > 0 ? Math.round((revenue / target) * 100) : 0
      const wonLeads = parseInt(person.won_leads)
      const totalLeads = parseInt(person.total_leads)
      const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : 0
      
      return {
        id: person.id,
        name: person.name,
        email: person.email,
        total_leads: totalLeads,
        won_leads: wonLeads,
        total_quotes: parseInt(person.total_quotes),
        accepted_quotes: parseInt(person.accepted_quotes),
        deals_closed: parseInt(person.deals_closed),
        revenue: revenue,
        target: target,
        target_progress: targetProgress,
        conversion_rate: parseFloat(conversionRate)
      }
    })

    res.json({
      status: 'success',
      data: salesTeam
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/manager-dashboard/revenue-trends - Revenue trends chart data
router.get('/revenue-trends', async (req, res, next) => {
  try {
    const { period = 'month' } = req.query
    
    let dateFormat, groupBy, intervalCount
    switch (period) {
      case 'week':
        dateFormat = 'YYYY-MM-DD'
        groupBy = 'DATE(created_at)'
        intervalCount = 7
        break
      case 'quarter':
        dateFormat = 'YYYY-"W"WW'
        groupBy = "DATE_TRUNC('week', created_at)"
        intervalCount = 12
        break
      default: // month
        dateFormat = 'YYYY-MM-DD'
        groupBy = 'DATE(created_at)'
        intervalCount = 30
    }
    
    const query = `
      SELECT 
        TO_CHAR(${groupBy}, '${dateFormat}') as date,
        COALESCE(SUM(quote_total), 0) as revenue,
        COUNT(*) as work_orders_count
      FROM work_orders
      WHERE completed_at >= CURRENT_DATE - INTERVAL '${intervalCount} days'
        AND status = 'completed'
      GROUP BY ${groupBy}
      ORDER BY ${groupBy} ASC
    `
    
    const result = await db.query(query)
    
    const trends = result.rows.map(row => ({
      date: row.date,
      revenue: parseFloat(row.revenue),
      work_orders: parseInt(row.work_orders_count)
    }))

    res.json({
      status: 'success',
      data: trends
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/manager-dashboard/top-opportunities - Top sales opportunities
router.get('/top-opportunities', async (req, res, next) => {
  try {
    const query = `
      SELECT 
        l.id,
        l.customer_name,
        l.company_name,
        l.potential_value,
        l.lead_quality,
        l.sales_stage,
        l.next_follow_up,
        u.name as assigned_to_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.sales_stage NOT IN ('won', 'lost')
        AND l.lead_quality = 'high'
      ORDER BY l.potential_value DESC, l.next_follow_up ASC
      LIMIT 10
      
      UNION ALL
      
      SELECT 
        q.id,
        q.customer_name,
        q.customer_name as company_name,
        q.total_amount as potential_value,
        'medium' as lead_quality,
        q.status as sales_stage,
        q.valid_until as next_follow_up,
        u.name as assigned_to_name
      FROM quotes q
      LEFT JOIN users u ON q.created_by = u.id
      WHERE q.status = 'sent'
      ORDER BY potential_value DESC
      LIMIT 10
    `
    
    const result = await db.query(query)

    res.json({
      status: 'success',
      data: result.rows.map(opp => ({
        ...opp,
        potential_value: parseFloat(opp.potential_value)
      }))
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/manager-dashboard/inventory-alerts - Low stock inventory items
router.get('/inventory-alerts', async (req, res, next) => {
  try {
    const query = `
      SELECT 
        i.id,
        i.name,
        i.quantity,
        i.min_stock_level,
        i.unit_price,
        i.category,
        (i.min_stock_level - i.quantity) as quantity_needed,
        (i.min_stock_level - i.quantity) * i.unit_price as reorder_value
      FROM inventory i
      WHERE i.quantity <= i.min_stock_level
      ORDER BY 
        CASE WHEN i.quantity = 0 THEN 0 ELSE 1 END,
        (i.min_stock_level - i.quantity) DESC
      LIMIT 20
    `
    
    const result = await db.query(query)

    res.json({
      status: 'success',
      data: result.rows.map(item => ({
        ...item,
        quantity: parseInt(item.quantity),
        min_stock_level: parseInt(item.min_stock_level),
        unit_price: parseFloat(item.unit_price),
        quantity_needed: parseInt(item.quantity_needed),
        reorder_value: parseFloat(item.reorder_value)
      }))
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
