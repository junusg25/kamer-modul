const express = require('express')
const router = express.Router()
const db = require('../db')
const { authenticateToken, authorizeRoles } = require('../middleware/auth')
const { format, subDays, subWeeks, subMonths, subQuarters, subYears, startOfWeek, startOfMonth, startOfQuarter, startOfYear } = require('date-fns')

// Analytics Overview - Comprehensive dashboard data
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    // Simplified version without complex date filtering for now
    // Financial Analytics - INCLUDE all work orders for accurate statistics
    const financialQuery = `
      SELECT 
        COALESCE(SUM(quote_total), 0) as total_revenue,
        COALESCE(AVG(quote_total), 0) as avg_order_value,
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'intake' THEN 1 END) as intake_orders
      FROM work_orders
    `
    const financialResult = await db.query(financialQuery)
    const financial = financialResult.rows[0]
    console.log('Financial data:', financial)

    // Work Orders Analytics - INCLUDE all work orders for accurate statistics
    const workOrdersQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'intake' THEN 1 END) as intake_orders,
        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600), 0) as avg_completion_hours
      FROM work_orders
    `
    const workOrdersResult = await db.query(workOrdersQuery)
    const workOrders = workOrdersResult.rows[0]
    console.log('Work orders data:', workOrders)

    // Warranty Work Orders Analytics
    const warrantyWorkOrdersQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600), 0) as avg_completion_hours
      FROM warranty_work_orders
    `
    const warrantyWorkOrdersResult = await db.query(warrantyWorkOrdersQuery)
    const warrantyWorkOrders = warrantyWorkOrdersResult.rows[0]
    console.log('Warranty work orders data:', warrantyWorkOrders)

    // Customer Analytics - INCLUDE all work orders for accurate statistics
    const customerQuery = `
      SELECT 
        COUNT(DISTINCT c.id) as total_customers,
        COUNT(DISTINCT CASE WHEN wo.created_at >= NOW() - INTERVAL '30 days' THEN c.id END) as active_customers
      FROM customers c
      LEFT JOIN work_orders wo ON c.id = wo.customer_id
    `
    const customerResult = await db.query(customerQuery)
    const customers = customerResult.rows[0]
    console.log('Customers data:', customers)

    // Team Analytics - INCLUDE all work orders for accurate statistics
    const teamQuery = `
      SELECT 
        COUNT(DISTINCT u.id) as total_technicians,
        COALESCE(AVG(completion_rate), 0) as avg_productivity,
        COALESCE(AVG(utilization_rate), 0) as avg_utilization
      FROM users u
      LEFT JOIN (
        SELECT 
          technician_id,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0) as completion_rate,
          COUNT(*) * 100.0 / 40 as utilization_rate
        FROM work_orders 
        WHERE technician_id IS NOT NULL
        GROUP BY technician_id
      ) tech_stats ON u.id = tech_stats.technician_id
      WHERE u.role = 'technician'
    `
    const teamResult = await db.query(teamQuery)
    const team = teamResult.rows[0]
    console.log('Team data:', team)

    // Inventory Analytics
    const inventoryQuery = `
      SELECT 
        COUNT(*) as total_items,
        COALESCE(SUM(quantity * unit_price), 0) as total_value,
        COUNT(CASE WHEN quantity <= 5 THEN 1 END) as low_stock_items,
        COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_items
      FROM inventory
    `
    const inventoryResult = await db.query(inventoryQuery)
    const inventory = inventoryResult.rows[0]
    console.log('Inventory data:', inventory)

    // Simple growth rates (would be calculated from previous period data in production)
    const growthRates = {
      revenue_growth: '+12.5%',
      work_orders_growth: '+8.2%',
      customers_growth: '+5.1%',
      efficiency_growth: '+2.3%',
      value_change: '+3.7%'
    }

    // Calculate derived metrics
    const completion_rate = workOrders.total_orders > 0 
      ? Math.round((workOrders.completed_orders / workOrders.total_orders) * 100) 
      : 0

    const efficiency = workOrders.avg_completion_hours > 0 
      ? Math.round((8 / workOrders.avg_completion_hours) * 100) 
      : 85

    const satisfaction_score = 4.5 // This would come from customer feedback system
    const utilization_rate = Math.min(team.avg_utilization || 78, 100)

    res.json({
      status: 'success',
      data: {
        financial: {
          total_revenue: parseFloat(financial.total_revenue) || 0,
          avg_order_value: parseFloat(financial.avg_order_value) || 0,
          total_orders: parseInt(financial.total_orders) || 0,
          completed_orders: parseInt(financial.completed_orders) || 0,
          active_orders: parseInt(financial.active_orders) || 0,
          pending_orders: parseInt(financial.pending_orders) || 0,
          ...growthRates
        },
        work_orders: {
          total_orders: parseInt(workOrders.total_orders) || 0,
          active_orders: parseInt(workOrders.active_orders) || 0,
          pending_orders: parseInt(workOrders.pending_orders) || 0,
          completed_orders: parseInt(workOrders.completed_orders) || 0,
          avg_completion_hours: parseFloat(workOrders.avg_completion_hours) || 0,
          completion_rate: completion_rate,
          efficiency: efficiency,
          ...growthRates
        },
        warranty_work_orders: {
          total_orders: parseInt(warrantyWorkOrders.total_orders) || 0,
          active_orders: parseInt(warrantyWorkOrders.active_orders) || 0,
          pending_orders: parseInt(warrantyWorkOrders.pending_orders) || 0,
          completed_orders: parseInt(warrantyWorkOrders.completed_orders) || 0,
          avg_completion_hours: parseFloat(warrantyWorkOrders.avg_completion_hours) || 0,
          ...growthRates
        },
        customers: {
          total_customers: parseInt(customers.total_customers) || 0,
          active_customers: parseInt(customers.active_customers) || 0,
          satisfaction_score: satisfaction_score,
          ...growthRates
        },
        team: {
          total_technicians: parseInt(team.total_technicians) || 0,
          avg_productivity: Math.round(team.avg_productivity) || 0,
          utilization_rate: Math.round(utilization_rate),
          ...growthRates
        },
        inventory: {
          total_items: parseInt(inventory.total_items) || 0,
          total_value: parseFloat(inventory.total_value) || 0,
          low_stock_items: parseInt(inventory.low_stock_items) || 0,
          out_of_stock_items: parseInt(inventory.out_of_stock_items) || 0,
          ...growthRates
        }
      }
    })
  } catch (error) {
    console.error('Analytics overview error:', error)
    res.status(500).json({ status: 'error', message: 'Failed to fetch analytics overview' })
  }
})

// Revenue Trends
router.get('/revenue-trends', authenticateToken, async (req, res) => {
  try {
    const { period = 'month', start_date, end_date } = req.query
    
    let dateFormat, groupBy, dateFilter
    const params = []

    if (start_date && end_date) {
      dateFilter = 'WHERE created_at >= $1 AND created_at <= $2'
      params.push(start_date, end_date)
    } else {
      dateFilter = 'WHERE created_at >= NOW() - INTERVAL \'12 months\''
    }

    switch (period) {
      case 'daily':
        dateFormat = 'YYYY-MM-DD'
        groupBy = 'DATE(created_at)'
        break
      case 'weekly':
        dateFormat = 'YYYY-WW'
        groupBy = 'DATE_TRUNC(\'week\', created_at)'
        break
      case 'monthly':
        dateFormat = 'YYYY-MM'
        groupBy = 'DATE_TRUNC(\'month\', created_at)'
        break
      case 'quarterly':
        dateFormat = 'YYYY-Q'
        groupBy = 'DATE_TRUNC(\'quarter\', created_at)'
        break
      case 'yearly':
        dateFormat = 'YYYY'
        groupBy = 'DATE_TRUNC(\'year\', created_at)'
        break
      default:
        dateFormat = 'YYYY-MM'
        groupBy = 'DATE_TRUNC(\'month\', created_at)'
    }

    const query = `
      SELECT 
        TO_CHAR(${groupBy}, '${dateFormat}') as date,
        COUNT(*) as orders,
        COALESCE(SUM(quote_total), 0) as revenue,
        COALESCE(AVG(quote_total), 0) as avg_order_value,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders
      FROM work_orders 
      ${dateFilter}
      GROUP BY ${groupBy}
      ORDER BY ${groupBy} ASC
      LIMIT 24
    `

    const result = await db.query(query, params)
    
    // Format the data and ensure we have data for all periods
    const trends = result.rows.map(row => ({
      date: row.date,
      orders: parseInt(row.orders) || 0,
      revenue: parseFloat(row.revenue) || 0,
      avg_order_value: parseFloat(row.avg_order_value) || 0,
      completed_orders: parseInt(row.completed_orders) || 0,
      active_orders: parseInt(row.active_orders) || 0,
      pending_orders: parseInt(row.pending_orders) || 0
    }))

    // Fill in missing periods with zero values if needed
    const filledTrends = []
    if (trends.length > 0) {
      const startDate = new Date(start_date || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000))
      const endDate = new Date(end_date || new Date())
      
      let currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const dateStr = format(currentDate, period === 'daily' ? 'yyyy-MM-dd' : 
                                     period === 'weekly' ? 'yyyy-\'W\'ww' : 
                                     period === 'monthly' ? 'yyyy-MM' : 
                                     period === 'quarterly' ? 'yyyy-\'Q\'Q' : 'yyyy')
        
        const existingData = trends.find(t => t.date === dateStr)
        filledTrends.push(existingData || {
          date: dateStr,
          orders: 0,
          revenue: 0,
          avg_order_value: 0,
          completed_orders: 0,
          active_orders: 0,
          pending_orders: 0
        })
        
        // Increment date based on period
        switch (period) {
          case 'daily':
            currentDate.setDate(currentDate.getDate() + 1)
            break
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7)
            break
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + 1)
            break
          case 'quarterly':
            currentDate.setMonth(currentDate.getMonth() + 3)
            break
          case 'yearly':
            currentDate.setFullYear(currentDate.getFullYear() + 1)
            break
          default:
            currentDate.setMonth(currentDate.getMonth() + 1)
        }
      }
    }

    res.json({
      status: 'success',
      data: filledTrends.length > 0 ? filledTrends : trends
    })
  } catch (error) {
    console.error('Revenue trends error:', error)
    res.status(500).json({ status: 'error', message: 'Failed to fetch revenue trends' })
  }
})

// Technician Performance
router.get('/technician-performance', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query
    const dateFilter = start_date && end_date 
      ? 'AND wo.created_at >= $1 AND wo.created_at <= $2' 
      : ''
    const params = start_date && end_date ? [start_date, end_date] : []

    const query = `
      SELECT 
        u.id,
        u.name,
        COUNT(wo.id) as total_orders,
        COUNT(CASE WHEN wo.status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN wo.status = 'active' THEN 1 END) as in_progress_orders,
        COUNT(CASE WHEN wo.status = 'pending' THEN 1 END) as pending_orders,
        COALESCE(AVG(EXTRACT(EPOCH FROM (wo.completed_at - wo.created_at))/3600), 0) as avg_completion_hours,
        COALESCE(SUM(wo.quote_total), 0) as total_revenue,
        COALESCE(AVG(wo.quote_total), 0) as avg_order_value,
        COUNT(CASE WHEN wo.priority = 'high' AND wo.status != 'completed' THEN 1 END) as high_priority_pending,
        COALESCE(AVG(wo.labor_hours), 0) as avg_labor_hours,
        COUNT(CASE WHEN wo.status = 'completed' AND wo.completed_at IS NOT NULL THEN 1 END) as on_time_completions
      FROM users u
      LEFT JOIN work_orders wo ON u.id = wo.technician_id ${dateFilter}
      WHERE u.role = 'technician'
      GROUP BY u.id, u.name
      ORDER BY completed_orders DESC, total_revenue DESC
    `

    const result = await db.query(query, params)
    
    const performance = result.rows.map(tech => {
      const totalOrders = parseInt(tech.total_orders)
      const completedOrders = parseInt(tech.completed_orders)
      const avgHours = parseFloat(tech.avg_completion_hours)
      const totalRevenue = parseFloat(tech.total_revenue)
      const avgLaborHours = parseFloat(tech.avg_labor_hours)
      const onTimeCompletions = parseInt(tech.on_time_completions)
      
      // Calculate performance metrics
      const completion_rate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0
      const efficiency = avgHours > 0 ? Math.round((8 / avgHours) * 100) : 85
      const productivity = Math.round((completedOrders / Math.max(1, totalOrders)) * 100)
      
      // Calculate quality score based on on-time completions and revenue per hour
      const onTimeRate = completedOrders > 0 ? Math.round((onTimeCompletions / completedOrders) * 100) : 0
      const revenuePerHour = avgLaborHours > 0 ? totalRevenue / avgLaborHours : 0
      const quality_score = Math.round((onTimeRate * 0.6) + (Math.min(revenuePerHour / 100, 100) * 0.4))

      return {
        id: tech.id,
        name: tech.name,
        total_orders: totalOrders,
        completed_orders: completedOrders,
        in_progress_orders: parseInt(tech.in_progress_orders),
        pending_orders: parseInt(tech.pending_orders),
        avg_completion_hours: avgHours,
        total_revenue: totalRevenue,
        avg_order_value: parseFloat(tech.avg_order_value),
        high_priority_pending: parseInt(tech.high_priority_pending),
        completion_rate: completion_rate,
        efficiency: efficiency,
        productivity: productivity,
        quality_score: Math.max(0, Math.min(100, quality_score)), // Ensure between 0-100
        on_time_rate: onTimeRate,
        revenue_per_hour: Math.round(revenuePerHour)
      }
    })

    res.json({
      status: 'success',
      data: performance
    })
  } catch (error) {
    console.error('Technician performance error:', error)
    res.status(500).json({ status: 'error', message: 'Failed to fetch technician performance' })
  }
})

// Customer Analytics
router.get('/customer-analytics', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query
    const dateFilter = start_date && end_date 
      ? 'WHERE wo.created_at >= $1 AND wo.created_at <= $2' 
      : ''
    const params = start_date && end_date ? [start_date, end_date] : []

    // Customer data
    const customerQuery = `
      SELECT 
        c.id,
        c.name,
        c.email,
        COUNT(wo.id) as total_orders,
        COUNT(CASE WHEN wo.status = 'completed' THEN 1 END) as completed_orders,
        COALESCE(SUM(wo.quote_total), 0) as total_spent,
        COALESCE(AVG(wo.quote_total), 0) as avg_order_value,
        MIN(wo.created_at) as first_order,
        MAX(wo.created_at) as last_order,
        COUNT(DISTINCT DATE_TRUNC('month', wo.created_at)) as active_months
      FROM customers c
      LEFT JOIN work_orders wo ON c.id = wo.customer_id ${dateFilter}
      GROUP BY c.id, c.name, c.email
      ORDER BY total_spent DESC
      LIMIT 20
    `

    const customerResult = await db.query(customerQuery, params)
    
    // Overall metrics
    const overallQuery = `
      SELECT 
        COUNT(DISTINCT c.id) as total_customers,
        COUNT(DISTINCT CASE WHEN wo_stats.customer_id IS NOT NULL THEN c.id END) as active_customers,
        COALESCE(AVG(orders_per_customer), 0) as avg_orders_per_customer,
        COALESCE(AVG(customer_lifetime_value), 0) as avg_clv
      FROM customers c
      LEFT JOIN (
        SELECT 
          customer_id,
          COUNT(*) as orders_per_customer,
          SUM(quote_total) as customer_lifetime_value
        FROM work_orders
        GROUP BY customer_id
      ) wo_stats ON c.id = wo_stats.customer_id
    `

    const overallResult = await db.query(overallQuery)
    const overallMetrics = overallResult.rows[0]

    const customerData = customerResult.rows.map(customer => {
      const totalSpent = parseFloat(customer.total_spent)
      const totalOrders = parseInt(customer.total_orders)
      const completedOrders = parseInt(customer.completed_orders)
      
      // Calculate customer metrics
      const satisfaction_score = Math.round(Math.random() * 2 + 3.5) // Simulated satisfaction
      const retention_rate = totalOrders > 1 ? Math.round((completedOrders / totalOrders) * 100) : 0

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        total_orders: totalOrders,
        completed_orders: completedOrders,
        total_spent: totalSpent,
        avg_order_value: parseFloat(customer.avg_order_value),
        first_order: customer.first_order,
        last_order: customer.last_order,
        active_months: parseInt(customer.active_months),
        satisfaction_score: satisfaction_score,
        retention_rate: retention_rate
      }
    })

    res.json({
      status: 'success',
      data: {
        customerData: customerData,
        overallMetrics: {
          total_customers: parseInt(overallMetrics.total_customers),
          active_customers: parseInt(overallMetrics.active_customers),
          avg_orders_per_customer: parseFloat(overallMetrics.avg_orders_per_customer),
          avg_clv: parseFloat(overallMetrics.avg_clv)
        }
      }
    })
  } catch (error) {
    console.error('Customer analytics error:', error)
    res.status(500).json({ status: 'error', message: 'Failed to fetch customer analytics' })
  }
})

// Inventory Analytics
router.get('/inventory-analytics', authenticateToken, async (req, res) => {
  try {
    // Inventory data
    const inventoryQuery = `
      SELECT 
        id,
        name,
        COALESCE(description, '') as category,
        quantity,
        unit_price,
        (quantity * unit_price) as current_value,
        CASE 
          WHEN quantity = 0 THEN 'Out of Stock'
          WHEN quantity <= 5 THEN 'Low Stock'
          ELSE 'In Stock'
        END as stock_status
      FROM inventory
      ORDER BY current_value DESC
    `

    const inventoryResult = await db.query(inventoryQuery)
    
    // Overall metrics
    const overallQuery = `
      SELECT 
        COUNT(*) as total_items,
        COALESCE(SUM(quantity * unit_price), 0) as total_value,
        COUNT(CASE WHEN quantity <= 5 THEN 1 END) as low_stock_items,
        COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_items,
        COALESCE(AVG(unit_price), 0) as avg_unit_price
      FROM inventory
    `

    const overallResult = await db.query(overallQuery)
    const overallMetrics = overallResult.rows[0]

    // Category breakdown (using description as category)
    const categoryQuery = `
      SELECT 
        COALESCE(description, 'Uncategorized') as category,
        COUNT(*) as item_count,
        COALESCE(SUM(quantity * unit_price), 0) as category_value,
        COALESCE(AVG(unit_price), 0) as avg_price
      FROM inventory
      GROUP BY description
      ORDER BY category_value DESC
    `

    const categoryResult = await db.query(categoryQuery)

    const inventoryData = inventoryResult.rows.map(item => {
      const currentValue = parseFloat(item.current_value)
      const quantity = parseInt(item.quantity)
      const unitPrice = parseFloat(item.unit_price)
      
      // Calculate inventory metrics
      const inventory_turnover = Math.round(Math.random() * 12 + 4) // Simulated turnover
      const stock_utilization = Math.round((quantity / Math.max(1, 10)) * 100) // Using 10 as default threshold

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: quantity,
        unit_price: unitPrice,
        current_value: currentValue,
        stock_status: item.stock_status,
        inventory_turnover: inventory_turnover,
        stock_utilization: stock_utilization
      }
    })

    const categoryData = categoryResult.rows.map(cat => ({
      category: cat.category,
      item_count: parseInt(cat.item_count),
      category_value: parseFloat(cat.category_value),
      avg_price: parseFloat(cat.avg_price)
    }))

    res.json({
      status: 'success',
      data: {
        inventoryData: inventoryData,
        overallMetrics: {
          total_items: parseInt(overallMetrics.total_items),
          total_value: parseFloat(overallMetrics.total_value),
          low_stock_items: parseInt(overallMetrics.low_stock_items),
          out_of_stock_items: parseInt(overallMetrics.out_of_stock_items),
          avg_unit_price: parseFloat(overallMetrics.avg_unit_price)
        },
        categoryData: categoryData
      }
    })
  } catch (error) {
    console.error('Inventory analytics error:', error)
    res.status(500).json({ status: 'error', message: 'Failed to fetch inventory analytics' })
  }
})

// Top Machines Analytics
router.get('/top-machines', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query
    const dateFilter = start_date && end_date 
      ? 'WHERE wo.created_at >= $1 AND wo.created_at <= $2' 
      : ''
    const params = start_date && end_date ? [start_date, end_date] : []

    const query = `
      SELECT 
        m.id,
        m.name,
        m.model,
        m.brand,
        COUNT(wo.id) as service_count,
        COALESCE(AVG(EXTRACT(EPOCH FROM (wo.completed_at - wo.created_at))/3600), 0) as avg_hours,
        COALESCE(SUM(wo.quote_total), 0) as total_revenue,
        COUNT(DISTINCT wo.customer_id) as unique_customers
      FROM machines m
      LEFT JOIN work_orders wo ON m.id = wo.machine_id ${dateFilter}
      GROUP BY m.id, m.name, m.model, m.brand
      HAVING COUNT(wo.id) > 0
      ORDER BY service_count DESC
      LIMIT 10
    `

    const result = await db.query(query, params)
    
    const topMachines = result.rows.map(machine => ({
      id: machine.id,
      name: machine.name,
      model: machine.model,
      brand: machine.brand,
      service_count: parseInt(machine.service_count),
      avg_hours: parseFloat(machine.avg_hours),
      total_revenue: parseFloat(machine.total_revenue),
      unique_customers: parseInt(machine.unique_customers)
    }))

    res.json({
      status: 'success',
      data: topMachines
    })
  } catch (error) {
    console.error('Top machines error:', error)
    res.status(500).json({ status: 'error', message: 'Failed to fetch top machines' })
  }
})

// Top Parts Analytics
router.get('/top-parts', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query
    const dateFilter = start_date && end_date 
      ? 'AND wo.created_at >= $1 AND wo.created_at <= $2' 
      : ''
    const params = start_date && end_date ? [start_date, end_date] : []

    const query = `
      SELECT 
        i.id,
        i.name,
        COALESCE(i.description, '') as category,
        COALESCE(SUM(woi.quantity), 0) as total_quantity_used,
        COUNT(DISTINCT woi.work_order_id) as work_orders_count,
        COALESCE(AVG(i.unit_price), 0) as avg_unit_price,
        COALESCE(SUM(woi.quantity * i.unit_price), 0) as total_value_used
      FROM inventory i
      LEFT JOIN work_order_inventory woi ON i.id = woi.inventory_id
      LEFT JOIN work_orders wo ON woi.work_order_id = wo.id ${dateFilter}
      GROUP BY i.id, i.name, i.description
      HAVING COALESCE(SUM(woi.quantity), 0) > 0
      ORDER BY total_quantity_used DESC
      LIMIT 10
    `

    const result = await db.query(query, params)
    
    const topParts = result.rows.map(part => ({
      id: part.id,
      name: part.name,
      category: part.category,
      total_quantity_used: parseInt(part.total_quantity_used),
      work_orders_count: parseInt(part.work_orders_count),
      avg_unit_price: parseFloat(part.avg_unit_price),
      total_value_used: parseFloat(part.total_value_used)
    }))

    res.json({
      status: 'success',
      data: topParts
    })
  } catch (error) {
    console.error('Top parts error:', error)
    res.status(500).json({ status: 'error', message: 'Failed to fetch top parts' })
  }
})

// User-specific Analytics (for regular users)
router.get('/user-dashboard/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params
    const { start_date, end_date } = req.query
    const dateFilter = start_date && end_date 
      ? 'AND created_at >= $2 AND created_at <= $3' 
      : ''
    const params = start_date && end_date ? [userId, start_date, end_date] : [userId]

    // User's work orders
    const workOrdersQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN priority = 'high' AND status != 'completed' THEN 1 END) as high_priority_pending,
        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/3600), 0) as avg_completion_hours,
        COALESCE(SUM(quote_total), 0) as total_revenue
      FROM work_orders 
      WHERE technician_id = $1 ${dateFilter}
    `
    const workOrdersResult = await db.query(workOrdersQuery, params)
    const workOrders = workOrdersResult.rows[0]

    // User's warranty work orders
    const warrantyQuery = `
      SELECT 
        COUNT(*) as total_warranty_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_warranty,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_warranty,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_warranty
      FROM warranty_work_orders 
      WHERE technician_id = $1 ${dateFilter}
    `
    const warrantyResult = await db.query(warrantyQuery, params)
    const warranty = warrantyResult.rows[0]

         // User's repair tickets
     const ticketsQuery = `
       SELECT 
         COUNT(*) as total_tickets,
         COUNT(CASE WHEN status = 'intake' THEN 1 END) as intake_tickets,
         COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_tickets,
         COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_tickets
       FROM repair_tickets 
       WHERE submitted_by = $1 ${dateFilter}
     `
    const ticketsResult = await db.query(ticketsQuery, params)
    const tickets = ticketsResult.rows[0]

    // Calculate completion rates separately
    const workOrdersCompletionRate = parseInt(workOrders.total_orders) > 0 
      ? Math.round((parseInt(workOrders.completed_orders) / parseInt(workOrders.total_orders)) * 100) 
      : 0
    
    const warrantyCompletionRate = parseInt(warranty.total_warranty_orders) > 0 
      ? Math.round((parseInt(warranty.completed_warranty) / parseInt(warranty.total_warranty_orders)) * 100) 
      : 0

    // Calculate efficiency score
    const avgHours = parseFloat(workOrders.avg_completion_hours)
    const efficiency = avgHours > 0 ? Math.round((8 / avgHours) * 100) : 85

    res.json({
      status: 'success',
      data: {
        work_orders: {
          total: parseInt(workOrders.total_orders) || 0,
          pending: parseInt(workOrders.pending_orders) || 0,
          active: parseInt(workOrders.active_orders) || 0,
          completed: parseInt(workOrders.completed_orders) || 0,
          high_priority_pending: parseInt(workOrders.high_priority_pending) || 0,
          total_revenue: parseFloat(workOrders.total_revenue) || 0
        },
        warranty_orders: {
          total: parseInt(warranty.total_warranty_orders) || 0,
          pending: parseInt(warranty.pending_warranty) || 0,
          active: parseInt(warranty.active_warranty) || 0,
          completed: parseInt(warranty.completed_warranty) || 0
        },
        repair_tickets: {
          total: parseInt(tickets.total_tickets) || 0,
          intake: parseInt(tickets.intake_tickets) || 0,
          converted: parseInt(tickets.converted_tickets) || 0,
          cancelled: parseInt(tickets.cancelled_tickets) || 0
        },
        performance: {
          completion_rate: workOrdersCompletionRate,
          warranty_completion_rate: warrantyCompletionRate,
          efficiency: efficiency,
          avg_completion_hours: avgHours,
          total_orders_completed: parseInt(workOrders.completed_orders) || 0,
          total_warranty_completed: parseInt(warranty.completed_warranty) || 0
        }
      }
    })
  } catch (error) {
    console.error('User dashboard error:', error)
    res.status(500).json({ status: 'error', message: 'Failed to fetch user dashboard data' })
  }
})

// Recent Activity Feed
router.get('/recent-activity', authenticateToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query

    // Combined recent activity from all tables
    const activityQuery = `
      (SELECT 
        'work_order' as type,
        id,
        COALESCE(formatted_number, 'Work Order #' || id) as title,
        description as details,
        status,
        created_at,
        updated_at,
        technician_id as created_by,
        technician_id,
        priority,
        'Work order ' || 
        CASE 
          WHEN status = 'completed' THEN 'completed'
          WHEN status = 'in_progress' THEN 'started'
          WHEN status = 'pending' THEN 'created'
          ELSE 'updated'
        END as action_text
      FROM work_orders
      WHERE created_at >= NOW() - INTERVAL '30 days')
      
      UNION ALL
      
      (SELECT 
        'warranty_work_order' as type,
        id,
        COALESCE(formatted_number, 'Warranty Work Order #' || id) as title,
        description as details,
        status,
        created_at,
        updated_at,
        technician_id as created_by,
        technician_id,
        priority,
        'Warranty work order ' || 
        CASE 
          WHEN status = 'completed' THEN 'completed'
          WHEN status = 'in_progress' THEN 'started'
          WHEN status = 'pending' THEN 'created'
          ELSE 'updated'
        END as action_text
      FROM warranty_work_orders
      WHERE created_at >= NOW() - INTERVAL '30 days')
      
      UNION ALL
      
      (SELECT 
        'repair_ticket' as type,
        id,
        COALESCE(formatted_number, 'Repair Ticket #' || COALESCE(ticket_number, id)) as title,
        COALESCE(problem_description, description) as details,
        status,
        created_at,
        updated_at,
        submitted_by,
        submitted_by as technician_id,
        'medium' as priority,
        'Repair ticket ' || 
        CASE 
          WHEN status = 'converted' THEN 'converted to work order'
          WHEN status = 'cancelled' THEN 'cancelled'
          ELSE 'created'
        END as action_text
      FROM repair_tickets
      WHERE created_at >= NOW() - INTERVAL '30 days')
      
      UNION ALL
      
      (SELECT 
        'warranty_repair_ticket' as type,
        id,
        COALESCE(formatted_number, 'Warranty Repair Ticket #' || COALESCE(ticket_number, id)) as title,
        COALESCE(problem_description, 'Warranty issue') as details,
        status,
        created_at,
        updated_at,
        submitted_by,
        submitted_by as technician_id,
        'high' as priority,
        'Warranty repair ticket ' || 
        CASE 
          WHEN status = 'converted' THEN 'converted to warranty work order'
          WHEN status = 'cancelled' THEN 'cancelled'
          ELSE 'created'
        END as action_text
      FROM warranty_repair_tickets
      WHERE created_at >= NOW() - INTERVAL '30 days')
      
      UNION ALL
      
      (SELECT 
        'customer' as type,
        id,
        'Customer: ' || name as title,
        email as details,
        'active' as status,
        created_at,
        updated_at,
        NULL as created_by,
        NULL as technician_id,
        'low' as priority,
        'New customer added' as action_text
      FROM customers
      WHERE created_at >= NOW() - INTERVAL '30 days')
      
      UNION ALL
      
      (SELECT 
        'machine' as type,
        id,
        'Machine: ' || name as title,
        serial_number as details,
        'active' as status,
        created_at,
        updated_at,
        NULL as created_by,
        NULL as technician_id,
        'low' as priority,
        'New machine added' as action_text
      FROM machines
      WHERE created_at >= NOW() - INTERVAL '30 days')
      
      ORDER BY created_at DESC
      LIMIT $1
    `

    const result = await db.query(activityQuery, [limit])
    
    // Get user names for created_by and technician_id
    const userIds = [...new Set([
      ...result.rows.map(row => row.created_by).filter(Boolean),
      ...result.rows.map(row => row.technician_id).filter(Boolean)
    ])]

    let userNames = {}
    if (userIds.length > 0) {
      const userQuery = `SELECT id, name FROM users WHERE id = ANY($1)`
      const userResult = await db.query(userQuery, [userIds])
      userNames = userResult.rows.reduce((acc, user) => {
        acc[user.id] = user.name
        return acc
      }, {})
    }

    const activities = result.rows.map(activity => ({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      details: activity.details,
      status: activity.status,
      priority: activity.priority,
      action_text: activity.action_text,
      created_at: activity.created_at,
      updated_at: activity.updated_at,
      created_by: activity.created_by ? userNames[activity.created_by] : null,
      technician: activity.technician_id ? userNames[activity.technician_id] : null
    }))

    res.json({
      status: 'success',
      data: activities
    })
  } catch (error) {
    console.error('Recent activity error:', error)
    res.status(500).json({ status: 'error', message: 'Failed to fetch recent activity' })
  }
})

// User's Latest Tasks
router.get('/user-tasks/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params
    const { limit = 10 } = req.query

    // Get user's assigned tasks from all sources
    const tasksQuery = `
      (SELECT 
        'work_order' as task_type,
        id,
        COALESCE(formatted_number, 'Work Order #' || id) as title,
        description as details,
        status,
        priority,
        created_at,
        due_date,
        customer_id,
        machine_id,
        quote_total as estimated_value,
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
        END as priority_order
      FROM work_orders
      WHERE technician_id = $1 AND status IN ('pending', 'in_progress'))
      
      UNION ALL
      
      (SELECT 
        'warranty_work_order' as task_type,
        id,
        COALESCE(formatted_number, 'Warranty Work Order #' || id) as title,
        description as details,
        status,
        priority,
        created_at,
        due_date,
        customer_id,
        machine_id,
        quote_total as estimated_value,
        CASE priority 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
        END as priority_order
      FROM warranty_work_orders
      WHERE technician_id = $1 AND status IN ('pending', 'in_progress'))
      
      UNION ALL
      
             (SELECT 
         'repair_ticket' as task_type,
         id,
         COALESCE(formatted_number, 'Repair Ticket #' || COALESCE(ticket_number, id)) as title,
         COALESCE(problem_description, description) as details,
         status,
         'medium' as priority,
         created_at,
         NULL as due_date,
         customer_id,
         machine_id,
         NULL as estimated_value,
         2 as priority_order
       FROM repair_tickets
       WHERE submitted_by = $1 AND status = 'intake')
      
      ORDER BY priority_order, created_at ASC
      LIMIT $2
    `

    const result = await db.query(tasksQuery, [userId, limit])
    
    // Get customer and machine names
    const customerIds = [...new Set(result.rows.map(row => row.customer_id).filter(Boolean))]
    const machineIds = [...new Set(result.rows.map(row => row.machine_id).filter(Boolean))]

    let customerNames = {}
    let machineNames = {}

    if (customerIds.length > 0) {
      const customerQuery = `SELECT id, name FROM customers WHERE id = ANY($1)`
      const customerResult = await db.query(customerQuery, [customerIds])
      customerNames = customerResult.rows.reduce((acc, customer) => {
        acc[customer.id] = customer.name
        return acc
      }, {})
    }

    if (machineIds.length > 0) {
      const machineQuery = `SELECT id, name, serial_number FROM machines WHERE id = ANY($1)`
      const machineResult = await db.query(machineQuery, [machineIds])
      machineNames = machineResult.rows.reduce((acc, machine) => {
        acc[machine.id] = { name: machine.name, model: machine.serial_number }
        return acc
      }, {})
    }

    const tasks = result.rows.map(task => ({
      id: task.id,
      type: task.task_type,
      title: task.title,
      details: task.details,
      status: task.status,
      priority: task.priority,
      created_at: task.created_at,
      due_date: task.due_date,
      customer: task.customer_id ? customerNames[task.customer_id] : null,
      machine: task.machine_id ? machineNames[task.machine_id] : null,
      estimated_value: task.estimated_value
    }))

    res.json({
      status: 'success',
      data: tasks
    })
  } catch (error) {
    console.error('User tasks error:', error)
    res.status(500).json({ status: 'error', message: 'Failed to fetch user tasks' })
  }
})

// Top Repaired Machines (for all users)
router.get('/top-repaired-machines', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, limit = 5 } = req.query
    const dateFilter = start_date && end_date 
      ? 'WHERE wo.created_at >= $1 AND wo.created_at <= $2' 
      : ''
    const params = start_date && end_date ? [start_date, end_date] : []

    const query = `
      SELECT 
        am.id,
        mm.name,
        ms.serial_number as model,
        mm.description as brand,
        COUNT(wo.id) as repair_count,
        COALESCE(AVG(EXTRACT(EPOCH FROM (wo.completed_at - wo.created_at))/3600), 0) as avg_repair_hours,
        COALESCE(SUM(wo.quote_total), 0) as total_revenue,
        COUNT(DISTINCT wo.customer_id) as unique_customers
      FROM assigned_machines am
      LEFT JOIN machine_serials ms ON am.serial_id = ms.id
      LEFT JOIN machine_models mm ON ms.model_id = mm.id
      LEFT JOIN work_orders wo ON am.id = wo.machine_id ${dateFilter}
      GROUP BY am.id, mm.name, ms.serial_number, mm.description
      HAVING COUNT(wo.id) > 0
      ORDER BY repair_count DESC, total_revenue DESC
      LIMIT $${params.length + 1}
    `

    const result = await db.query(query, [...params, limit])
    
    const topMachines = result.rows.map(machine => ({
      id: machine.id,
      name: machine.name,
      model: machine.model,
      brand: machine.brand,
      repair_count: parseInt(machine.repair_count),
      avg_repair_hours: parseFloat(machine.avg_repair_hours),
      total_revenue: parseFloat(machine.total_revenue),
      unique_customers: parseInt(machine.unique_customers)
    }))

    res.json({
      status: 'success',
      data: topMachines
    })
  } catch (error) {
    console.error('Top repaired machines error:', error)
    res.status(500).json({ status: 'error', message: 'Failed to fetch top repaired machines' })
  }
})

// Most Used Parts in Repairs (for all users)
router.get('/most-used-parts', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, limit = 5 } = req.query
    const dateFilter = start_date && end_date 
      ? 'AND wo.created_at >= $1 AND wo.created_at <= $2' 
      : ''
    const params = start_date && end_date ? [start_date, end_date] : []

    const query = `
      SELECT 
        i.id,
        i.name,
        COALESCE(i.description, 'General Parts') as category,
        COALESCE(SUM(woi.quantity), 0) as total_quantity_used,
        COUNT(DISTINCT woi.work_order_id) as work_orders_count,
        COALESCE(AVG(i.unit_price), 0) as avg_unit_price,
        COALESCE(SUM(woi.quantity * i.unit_price), 0) as total_value_used,
        COUNT(DISTINCT wo.customer_id) as unique_customers
      FROM inventory i
      LEFT JOIN work_order_inventory woi ON i.id = woi.inventory_id
      LEFT JOIN work_orders wo ON woi.work_order_id = wo.id ${dateFilter}
      GROUP BY i.id, i.name, i.description
      HAVING COALESCE(SUM(woi.quantity), 0) > 0
      ORDER BY total_quantity_used DESC, total_value_used DESC
      LIMIT $${params.length + 1}
    `

    const result = await db.query(query, [...params, limit])
    
    const mostUsedParts = result.rows.map(part => ({
      id: part.id,
      name: part.name,
      category: part.category,
      total_quantity_used: parseInt(part.total_quantity_used),
      work_orders_count: parseInt(part.work_orders_count),
      avg_unit_price: parseFloat(part.avg_unit_price),
      total_value_used: parseFloat(part.total_value_used),
      unique_customers: parseInt(part.unique_customers)
    }))

    res.json({
      status: 'success',
      data: mostUsedParts
    })
  } catch (error) {
    console.error('Most used parts error:', error)
    res.status(500).json({ status: 'error', message: 'Failed to fetch most used parts' })
  }
})

// Sales Analytics Endpoints

// GET sales metrics with period comparison
router.get('/sales-metrics', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Calculate date ranges
    let startDate, previousStartDate, previousEndDate;
    const now = new Date();
    
    switch (period) {
      case 'week':
        startDate = startOfWeek(now);
        previousStartDate = startOfWeek(subWeeks(now, 1));
        previousEndDate = subDays(startDate, 1);
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        previousStartDate = startOfQuarter(subQuarters(now, 1));
        previousEndDate = subDays(startDate, 1);
        break;
      case 'year':
        startDate = startOfYear(now);
        previousStartDate = startOfYear(subYears(now, 1));
        previousEndDate = subDays(startDate, 1);
        break;
      default: // month
        startDate = startOfMonth(now);
        previousStartDate = startOfMonth(subMonths(now, 1));
        previousEndDate = subDays(startDate, 1);
    }

    // Current period metrics
    const currentMetricsQuery = `
      SELECT 
        COUNT(CASE WHEN is_sale = true THEN 1 END) as total_sales,
        COALESCE(SUM(CASE WHEN is_sale = true THEN sale_price END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN is_sale = true THEN sale_price END), 0) as avg_sale_price,
        COUNT(CASE WHEN is_sale = false THEN 1 END) as total_assignments
      FROM assigned_machines 
      WHERE assigned_at >= $1
    `;
    
    // Previous period metrics
    const previousMetricsQuery = `
      SELECT 
        COUNT(CASE WHEN is_sale = true THEN 1 END) as total_sales,
        COALESCE(SUM(CASE WHEN is_sale = true THEN sale_price END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN is_sale = true THEN sale_price END), 0) as avg_sale_price
      FROM assigned_machines 
      WHERE assigned_at >= $1 AND assigned_at <= $2
    `;

    const [currentResult, previousResult] = await Promise.all([
      db.query(currentMetricsQuery, [startDate]),
      db.query(previousMetricsQuery, [previousStartDate, previousEndDate])
    ]);

    const current = currentResult.rows[0];
    const previous = previousResult.rows[0];

    // Calculate percentage changes
    const salesChange = previous.total_sales > 0 
      ? ((current.total_sales - previous.total_sales) / previous.total_sales * 100)
      : 0;
    
    const revenueChange = previous.total_revenue > 0 
      ? ((current.total_revenue - previous.total_revenue) / previous.total_revenue * 100)
      : 0;
    
    const avgPriceChange = previous.avg_sale_price > 0 
      ? ((current.avg_sale_price - previous.avg_sale_price) / previous.avg_sale_price * 100)
      : 0;

    res.json({
      status: 'success',
      data: {
        totalSales: parseInt(current.total_sales),
        totalRevenue: parseFloat(current.total_revenue),
        avgSalePrice: parseFloat(current.avg_sale_price),
        totalAssignments: parseInt(current.total_assignments),
        salesChange: parseFloat(salesChange.toFixed(2)),
        revenueChange: parseFloat(revenueChange.toFixed(2)),
        avgPriceChange: parseFloat(avgPriceChange.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Sales metrics error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch sales metrics' });
  }
});

// GET sales opportunities from repair tickets and work orders
router.get('/sales-opportunities', authenticateToken, async (req, res) => {
  try {
    const { sales_user_id } = req.query;
    
    let whereClause = '';
    let params = [];
    
    if (sales_user_id && sales_user_id !== 'all') {
      whereClause = 'WHERE sales_user_id = $1';
      params.push(sales_user_id);
    }

    const query = `
      SELECT * FROM sales_opportunities
      ${whereClause}
      ORDER BY 
        CASE lead_quality 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          ELSE 3 
        END,
        potential_value DESC
      LIMIT 50
    `;

    const result = await db.query(query, params);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (error) {
    console.error('Sales opportunities error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch sales opportunities' });
  }
});

// GET sales team performance
router.get('/sales-team', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Calculate date range
    let startDate;
    const now = new Date();
    
    switch (period) {
      case 'week':
        startDate = startOfWeek(now);
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        break;
      default: // month
        startDate = startOfMonth(now);
    }

    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(CASE WHEN am.is_sale = true THEN 1 END) as total_sales,
        COALESCE(SUM(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as avg_sale_price,
        -- Assuming a monthly target of €10,000 per sales person
        10000 as target
      FROM users u
      LEFT JOIN assigned_machines am ON u.id = am.sold_by_user_id 
        AND am.assigned_at >= $1
        AND am.is_sale = true
      WHERE u.role = 'sales' AND u.status = 'active'
      GROUP BY u.id, u.name, u.email
      ORDER BY total_revenue DESC
    `;

    const result = await db.query(query, [startDate]);
    
    res.json({
      status: 'success',
      data: result.rows.map(row => ({
        ...row,
        totalSales: parseInt(row.total_sales),
        totalRevenue: parseFloat(row.total_revenue),
        avgSalePrice: parseFloat(row.avg_sale_price),
        target: parseFloat(row.target)
      }))
    });
  } catch (error) {
    console.error('Sales team error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch sales team performance' });
  }
});

// GET recent sales activity
router.get('/recent-sales', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const query = `
      SELECT 
        am.id,
        am.sale_date,
        am.sale_price,
        c.name as customer_name,
        c.company_name,
        mm.name as model_name,
        ms.serial_number,
        u.name as sold_by_name
      FROM assigned_machines am
      INNER JOIN machine_serials ms ON am.serial_id = ms.id
      INNER JOIN machine_models mm ON ms.model_id = mm.id
      INNER JOIN customers c ON am.customer_id = c.id
      LEFT JOIN users u ON am.sold_by_user_id = u.id
      WHERE am.is_sale = true
      ORDER BY am.sale_date DESC, am.assigned_at DESC
      LIMIT $1
    `;

    const result = await db.query(query, [limit]);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (error) {
    console.error('Recent sales error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch recent sales' });
  }
});

// Sales Reports Analytics Endpoints

// GET comprehensive sales reports
router.get('/sales-reports', authenticateToken, async (req, res) => {
  try {
    const { period = 'month', sales_person } = req.query;
    
    // Calculate date range
    let startDate, previousStartDate, previousEndDate;
    const now = new Date();
    
    switch (period) {
      case 'week':
        startDate = startOfWeek(now);
        previousStartDate = startOfWeek(subWeeks(now, 1));
        previousEndDate = subDays(startDate, 1);
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        previousStartDate = startOfQuarter(subQuarters(now, 1));
        previousEndDate = subDays(startDate, 1);
        break;
      case 'year':
        startDate = startOfYear(now);
        previousStartDate = startOfYear(subYears(now, 1));
        previousEndDate = subDays(startDate, 1);
        break;
      default: // month
        startDate = startOfMonth(now);
        previousStartDate = startOfMonth(subMonths(now, 1));
        previousEndDate = subDays(startDate, 1);
    }

    let whereClause = 'WHERE am.assigned_at >= $1';
    let previousWhereClause = 'WHERE am.assigned_at >= $1 AND am.assigned_at <= $2';
    let params = [startDate];
    let previousParams = [previousStartDate, previousEndDate];

    if (sales_person && sales_person !== 'all') {
      whereClause += ' AND am.sold_by_user_id = $2';
      previousWhereClause += ' AND am.sold_by_user_id = $3';
      params.push(sales_person);
      previousParams.push(sales_person);
    }

    // Current period analytics
    const currentAnalyticsQuery = `
      SELECT 
        COUNT(CASE WHEN am.is_sale = true THEN 1 END) as total_sales,
        COALESCE(SUM(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as avg_sale_price,
        COUNT(CASE WHEN am.is_sale = false THEN 1 END) as total_assignments
      FROM assigned_machines am
      ${whereClause}
    `;

    // Previous period analytics
    const previousAnalyticsQuery = `
      SELECT 
        COUNT(CASE WHEN am.is_sale = true THEN 1 END) as total_sales,
        COALESCE(SUM(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as avg_sale_price
      FROM assigned_machines am
      ${previousWhereClause}
    `;

    // Conversion rate calculation
    const conversionQuery = `
      SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN sales_stage = 'won' THEN 1 END) as won_leads
      FROM leads l
      WHERE l.created_at >= $1
      ${sales_person && sales_person !== 'all' ? 'AND l.assigned_to = $2' : ''}
    `;

    const [currentResult, previousResult, conversionResult] = await Promise.all([
      db.query(currentAnalyticsQuery, params),
      db.query(previousAnalyticsQuery, previousParams),
      db.query(conversionQuery, sales_person && sales_person !== 'all' ? [startDate, sales_person] : [startDate])
    ]);

    const current = currentResult.rows[0];
    const previous = previousResult.rows[0];
    const conversion = conversionResult.rows[0];

    // Calculate percentage changes
    const salesChange = previous.total_sales > 0 
      ? ((current.total_sales - previous.total_sales) / previous.total_sales * 100)
      : 0;
    
    const revenueChange = previous.total_revenue > 0 
      ? ((current.total_revenue - previous.total_revenue) / previous.total_revenue * 100)
      : 0;
    
    const avgPriceChange = previous.avg_sale_price > 0 
      ? ((current.avg_sale_price - previous.avg_sale_price) / previous.avg_sale_price * 100)
      : 0;

    const conversionRate = conversion.total_leads > 0 
      ? (conversion.won_leads / conversion.total_leads * 100)
      : 0;

    res.json({
      status: 'success',
      data: {
        totalSales: parseInt(current.total_sales),
        totalRevenue: parseFloat(current.total_revenue),
        avgSalePrice: parseFloat(current.avg_sale_price),
        totalAssignments: parseInt(current.total_assignments),
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        salesChange: parseFloat(salesChange.toFixed(2)),
        revenueChange: parseFloat(revenueChange.toFixed(2)),
        avgPriceChange: parseFloat(avgPriceChange.toFixed(2)),
        conversionChange: 0 // Would need historical data to calculate
      }
    });
  } catch (error) {
    console.error('Sales reports error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch sales reports' });
  }
});

// GET sales trends over time
router.get('/sales-trends', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFormat, intervalClause;
    switch (period) {
      case 'week':
        dateFormat = 'YYYY-"W"WW';
        intervalClause = "DATE_TRUNC('week', am.assigned_at)";
        break;
      case 'quarter':
        dateFormat = 'YYYY-"Q"Q';
        intervalClause = "DATE_TRUNC('quarter', am.assigned_at)";
        break;
      case 'year':
        dateFormat = 'YYYY';
        intervalClause = "DATE_TRUNC('year', am.assigned_at)";
        break;
      default: // month
        dateFormat = 'YYYY-MM';
        intervalClause = "DATE_TRUNC('month', am.assigned_at)";
    }

    const trendsQuery = `
      SELECT 
        TO_CHAR(${intervalClause}, '${dateFormat}') as period,
        COUNT(CASE WHEN am.is_sale = true THEN 1 END) as sales,
        COALESCE(SUM(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as revenue,
        COALESCE(AVG(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as avg_deal_size
      FROM assigned_machines am
      WHERE am.assigned_at >= CURRENT_DATE - INTERVAL '12 months'
        AND am.is_sale = true
      GROUP BY ${intervalClause}
      ORDER BY ${intervalClause}
    `;

    const result = await db.query(trendsQuery);
    
    res.json({
      status: 'success',
      data: result.rows.map(row => ({
        period: row.period,
        sales: parseInt(row.sales),
        revenue: parseFloat(row.revenue),
        avgDealSize: parseFloat(row.avg_deal_size)
      }))
    });
  } catch (error) {
    console.error('Sales trends error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch sales trends' });
  }
});

// GET team performance metrics
router.get('/team-performance', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let startDate;
    const now = new Date();
    
    switch (period) {
      case 'week':
        startDate = startOfWeek(now);
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        break;
      default: // month
        startDate = startOfMonth(now);
    }

    const teamQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(l.id) as leads_generated,
        COUNT(CASE WHEN l.sales_stage = 'won' THEN 1 END) as leads_converted,
        COUNT(CASE WHEN am.is_sale = true THEN 1 END) as total_sales,
        COALESCE(SUM(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN am.is_sale = true THEN am.sale_price END), 0) as avg_deal_size,
        CASE 
          WHEN COUNT(l.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN l.sales_stage = 'won' THEN 1 END)::FLOAT / COUNT(l.id)::FLOAT * 100)::NUMERIC, 2)
          ELSE 0 
        END as conversion_rate,
        10000 as target -- Default monthly target
      FROM users u
      LEFT JOIN leads l ON u.id = l.assigned_to 
        AND l.created_at >= $1
      LEFT JOIN assigned_machines am ON u.id = am.sold_by_user_id 
        AND am.assigned_at >= $1
        AND am.is_sale = true
      WHERE u.role = 'sales' AND u.status = 'active'
      GROUP BY u.id, u.name, u.email
      ORDER BY total_revenue DESC
    `;

    const result = await db.query(teamQuery, [startDate]);
    
    res.json({
      status: 'success',
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        leadsGenerated: parseInt(row.leads_generated),
        leadsConverted: parseInt(row.leads_converted),
        totalSales: parseInt(row.total_sales),
        totalRevenue: parseFloat(row.total_revenue),
        avgDealSize: parseFloat(row.avg_deal_size),
        conversionRate: parseFloat(row.conversion_rate),
        target: parseFloat(row.target)
      }))
    });
  } catch (error) {
    console.error('Team performance error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch team performance' });
  }
});

// GET conversion funnel data
router.get('/conversion-funnel', authenticateToken, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let startDate;
    const now = new Date();
    
    switch (period) {
      case 'week':
        startDate = startOfWeek(now);
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        break;
      default: // month
        startDate = startOfMonth(now);
    }

    const funnelQuery = `
      SELECT 
        sales_stage as stage,
        COUNT(*) as count
      FROM leads
      WHERE created_at >= $1
      GROUP BY sales_stage
      ORDER BY 
        CASE sales_stage 
          WHEN 'new' THEN 1 
          WHEN 'contacted' THEN 2 
          WHEN 'qualified' THEN 3 
          WHEN 'proposal' THEN 4 
          WHEN 'negotiation' THEN 5 
          WHEN 'won' THEN 6 
          WHEN 'lost' THEN 7 
          ELSE 8 
        END
    `;

    const result = await db.query(funnelQuery, [startDate]);
    const totalLeads = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
    
    res.json({
      status: 'success',
      data: result.rows.map(row => ({
        stage: row.stage,
        count: parseInt(row.count),
        percentage: totalLeads > 0 ? (parseInt(row.count) / totalLeads * 100) : 0
      }))
    });
  } catch (error) {
    console.error('Conversion funnel error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch conversion funnel' });
  }
});

// GET export sales report (Excel/CSV)
router.get('/sales-reports/export', authenticateToken, async (req, res) => {
  try {
    const { period = 'month', sales_person } = req.query;
    
    // This would typically use a library like xlsx or csv-writer
    // For now, we'll return a simple JSON response that could be processed client-side
    const reportData = {
      period,
      sales_person,
      generated_at: new Date().toISOString(),
      // Include all the analytics data here
    };
    
    res.json({
      status: 'success',
      message: 'Export functionality would be implemented here',
      data: reportData
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ status: 'error', message: 'Failed to export report' });
  }
});

module.exports = router
