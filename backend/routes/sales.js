const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET sales metrics
router.get('/metrics', authenticateToken, async (req, res, next) => {
  try {
    const { time_period = 'month', sales_person } = req.query;
    
    // Calculate date range based on time_period
    let dateFilter = '';
    let params = [];
    
    switch (time_period) {
      case 'week':
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'7 days\'';
        break;
      case 'month':
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'30 days\'';
        break;
      case 'quarter':
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'90 days\'';
        break;
      case 'year':
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'365 days\'';
        break;
      default:
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'30 days\'';
    }

    // Add sales person filter if provided
    let salesPersonFilter = '';
    if (sales_person && sales_person !== 'all') {
      salesPersonFilter = 'AND u.id = $1';
      params.push(sales_person);
    }

    const metricsQuery = `
      SELECT 
        COUNT(am.id) as total_sales,
        COALESCE(SUM(am.sale_price), 0) as total_revenue,
        COALESCE(AVG(am.sale_price), 0) as avg_sale_price,
        COUNT(DISTINCT am.customer_id) as customers_served
      FROM assigned_machines am
      LEFT JOIN users u ON am.sold_by_user_id = u.id
      WHERE am.is_sale = true 
        AND am.sale_price > 0
        ${dateFilter}
        ${salesPersonFilter}
    `;

    const result = await db.query(metricsQuery, params);
    const metrics = result.rows[0];

    res.json({
      status: 'success',
      data: {
        totalSales: parseInt(metrics.total_sales) || 0,
        totalRevenue: parseFloat(metrics.total_revenue) || 0,
        avgSalePrice: parseFloat(metrics.avg_sale_price) || 0,
        customersServed: parseInt(metrics.customers_served) || 0,
        salesChange: 0, // TODO: Calculate change from previous period
        revenueChange: 0, // TODO: Calculate change from previous period
        avgPriceChange: 0 // TODO: Calculate change from previous period
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET sales opportunities (from leads and sales_opportunities view)
router.get('/opportunities', authenticateToken, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, stage, assigned_to } = req.query;
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereConditions.push(`(customer_name ILIKE $${paramCount} OR company_name ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    if (stage && stage !== 'all') {
      paramCount++;
      whereConditions.push(`sales_stage = $${paramCount}`);
      params.push(stage);
    }

    if (assigned_to && assigned_to !== 'all') {
      paramCount++;
      whereConditions.push(`sales_user_id = $${paramCount}`);
      params.push(assigned_to);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM sales_opportunities so
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get opportunities with pagination
    paramCount++;
    const query = `
      SELECT 
        so.*,
        u.name as sales_user_name
      FROM sales_opportunities so
      LEFT JOIN users u ON so.sales_user_id = u.id
      ${whereClause}
      ORDER BY 
        CASE so.lead_quality 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          ELSE 3 
        END,
        so.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      status: 'success',
      data: {
        opportunities: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET sales team
router.get('/team', authenticateToken, async (req, res, next) => {
  try {
    const teamQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        COALESCE(sm.total_machines_sold, 0) as total_sales,
        COALESCE(sm.total_sales_revenue, 0) as total_revenue,
        COALESCE(sm.avg_sale_price, 0) as avg_sale_price,
        COALESCE(sm.customers_served, 0) as customers_served,
        100000 as target, -- TODO: Add targets table
        CASE 
          WHEN COALESCE(sm.total_sales_revenue, 0) > 0 THEN 
            ROUND((COALESCE(sm.total_sales_revenue, 0) / 100000.0 * 100)::NUMERIC, 2)
          ELSE 0 
        END as completion_rate
      FROM users u
      LEFT JOIN sales_metrics sm ON u.id = sm.sales_user_id
      WHERE u.role = 'sales' AND u.status = 'active'
      ORDER BY COALESCE(sm.total_sales_revenue, 0) DESC
    `;

    const result = await db.query(teamQuery);

    res.json({
      status: 'success',
      data: {
        team: result.rows.map(member => ({
          id: member.id,
          name: member.name,
          email: member.email,
          avatar: null, // Avatar column doesn't exist in database
          totalSales: parseInt(member.total_sales),
          totalRevenue: parseFloat(member.total_revenue),
          avgSalePrice: parseFloat(member.avg_sale_price),
          customersServed: parseInt(member.customers_served),
          target: parseInt(member.target),
          completionRate: parseFloat(member.completion_rate)
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET recent sales
router.get('/recent', authenticateToken, async (req, res, next) => {
  try {
    const { limit = 5, time_period = 'month', sales_person } = req.query;
    
    // Calculate date range based on time_period
    let dateFilter = '';
    let params = [];
    
    switch (time_period) {
      case 'week':
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'7 days\'';
        break;
      case 'month':
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'30 days\'';
        break;
      case 'quarter':
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'90 days\'';
        break;
      case 'year':
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'365 days\'';
        break;
      default:
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'30 days\'';
    }

    // Add sales person filter if provided
    let salesPersonFilter = '';
    if (sales_person && sales_person !== 'all') {
      salesPersonFilter = 'AND u.id = $1';
      params.push(sales_person);
    }

    const recentSalesQuery = `
      SELECT 
        am.id,
        c.name as customer_name,
        c.company_name,
        mm.name as model_name,
        ms.serial_number,
        u.name as sold_by_name,
        am.sale_price,
        am.sale_date,
        am.assigned_at
      FROM assigned_machines am
      LEFT JOIN customers c ON am.customer_id = c.id
      LEFT JOIN machine_serials ms ON am.serial_id = ms.id
      LEFT JOIN machine_models mm ON ms.model_id = mm.id
      LEFT JOIN users u ON am.sold_by_user_id = u.id
      WHERE am.is_sale = true 
        AND am.sale_price > 0
        ${dateFilter}
        ${salesPersonFilter}
      ORDER BY am.sale_date DESC, am.assigned_at DESC
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const result = await db.query(recentSalesQuery, params);

    res.json({
      status: 'success',
      data: {
        sales: result.rows.map(sale => ({
          id: sale.id,
          customer_name: sale.customer_name,
          company_name: sale.company_name,
          model_name: sale.model_name,
          serial_number: sale.serial_number,
          sold_by_name: sale.sold_by_name,
          sale_price: parseFloat(sale.sale_price),
          sale_date: sale.sale_date,
          created_at: sale.assigned_at
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET sales reports
router.get('/reports', authenticateToken, async (req, res, next) => {
  try {
    const { time_period = 'month', report_type = 'overview', sales_person } = req.query;
    
    // This is a placeholder for sales reports
    // In a real implementation, you would generate various reports based on the parameters
    
    res.json({
      status: 'success',
      data: {
        reportType: report_type,
        timePeriod: time_period,
        salesPerson: sales_person,
        message: 'Sales reports endpoint - implementation needed'
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET sales trends
router.get('/trends', authenticateToken, async (req, res, next) => {
  try {
    const { time_period = 'month', sales_person, start_date, end_date } = req.query;
    
    // Calculate date range based on time_period or custom dates
    let dateFilter = '';
    let params = [];
    let startDate, endDate;
    
    if (time_period === 'custom' && start_date && end_date) {
      // Custom date range
      dateFilter = 'AND am.sale_date >= $' + (params.length + 1) + ' AND am.sale_date <= $' + (params.length + 2);
      params.push(start_date, end_date);
      startDate = new Date(start_date);
      endDate = new Date(end_date);
    } else {
      // Predefined time periods
      switch (time_period) {
        case 'week':
          dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'7 days\'';
          endDate = new Date();
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'30 days\'';
          endDate = new Date();
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'quarter':
          dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'90 days\'';
          endDate = new Date();
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 90);
          break;
        case 'year':
          dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'365 days\'';
          endDate = new Date();
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 365);
          break;
        default:
          dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'30 days\'';
          endDate = new Date();
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
      }
    }

    // Add sales person filter if provided
    let salesPersonFilter = '';
    if (sales_person) {
      salesPersonFilter = 'AND am.sold_by_user_id = $' + (params.length + 1);
      params.push(sales_person);
    }

    const query = `
      SELECT 
        DATE_TRUNC('day', am.sale_date) as date,
        COUNT(*) as sales,
        COALESCE(SUM(am.sale_price), 0) as revenue,
        COUNT(DISTINCT am.customer_id) as customers
      FROM assigned_machines am
      WHERE am.is_sale = true 
        AND am.sale_date IS NOT NULL
        ${dateFilter}
        ${salesPersonFilter}
      GROUP BY DATE_TRUNC('day', am.sale_date)
      ORDER BY date ASC
    `;

    const result = await db.query(query, params);
    
    // Fill in missing dates with zero values
    const trends = [];
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      const existingData = result.rows.find(row => row.date.toISOString().split('T')[0] === dateStr);
      
      trends.push({
        date: dateStr,
        sales: existingData ? parseInt(existingData.sales) : 0,
        revenue: existingData ? parseFloat(existingData.revenue) : 0,
        customers: existingData ? parseInt(existingData.customers) : 0
      });
    }
    
    res.json({
      status: 'success',
      data: trends
    });
  } catch (err) {
    next(err);
  }
});

// GET top customers
router.get('/top-customers', authenticateToken, async (req, res, next) => {
  try {
    const { limit = 10, time_period = 'month' } = req.query;
    
    // Calculate date range based on time_period
    let dateFilter = '';
    
    switch (time_period) {
      case 'week':
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'7 days\'';
        break;
      case 'month':
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'30 days\'';
        break;
      case 'quarter':
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'90 days\'';
        break;
      case 'year':
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'365 days\'';
        break;
      default:
        dateFilter = 'AND am.sale_date >= CURRENT_DATE - INTERVAL \'30 days\'';
    }

    const topCustomersQuery = `
      SELECT 
        c.id,
        c.name,
        c.company_name,
        COUNT(am.id) as total_deals,
        COALESCE(SUM(am.sale_price), 0) as total_revenue,
        MAX(am.sale_date) as last_deal
      FROM customers c
      LEFT JOIN assigned_machines am ON c.id = am.customer_id 
        AND am.is_sale = true 
        AND am.sale_price > 0
        ${dateFilter}
      GROUP BY c.id, c.name, c.company_name
      HAVING COUNT(am.id) > 0
      ORDER BY total_revenue DESC
      LIMIT $1
    `;

    const result = await db.query(topCustomersQuery, [limit]);

    res.json({
      status: 'success',
      data: {
        customers: result.rows.map(customer => ({
          id: customer.id,
          name: customer.name,
          company: customer.company_name,
          totalRevenue: parseFloat(customer.total_revenue),
          totalDeals: parseInt(customer.total_deals),
          lastDeal: customer.last_deal,
          status: 'active' // TODO: Determine status based on recent activity
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET sales forecast
router.get('/forecast', authenticateToken, async (req, res, next) => {
  try {
    const { months = 6 } = req.query;
    
    // This is a placeholder for sales forecast
    // In a real implementation, you would use historical data to predict future sales
    
    res.json({
      status: 'success',
      data: {
        months: parseInt(months),
        message: 'Sales forecast endpoint - implementation needed'
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET lead sources analytics
router.get('/lead-sources', authenticateToken, async (req, res, next) => {
  try {
    const { time_period = 'month' } = req.query;
    
    // Calculate date range based on time_period
    let dateFilter = '';
    
    switch (time_period) {
      case 'week':
        dateFilter = 'AND l.created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
        break;
      case 'month':
        dateFilter = 'AND l.created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
        break;
      case 'quarter':
        dateFilter = 'AND l.created_at >= CURRENT_DATE - INTERVAL \'90 days\'';
        break;
      case 'year':
        dateFilter = 'AND l.created_at >= CURRENT_DATE - INTERVAL \'365 days\'';
        break;
      default:
        dateFilter = 'AND l.created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
    }

    const leadSourcesQuery = `
      SELECT 
        COALESCE(l.source, 'Unknown') as source,
        COUNT(l.id) as leads,
        COALESCE(SUM(l.potential_value), 0) as revenue,
        CASE 
          WHEN COUNT(l.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN l.sales_stage = 'closed_won' THEN 1 END)::NUMERIC / COUNT(l.id)::NUMERIC * 100), 2)
          ELSE 0 
        END as conversion_rate,
        CASE 
          WHEN (SELECT COUNT(*) FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') > 0 THEN
            ROUND((COUNT(l.id)::NUMERIC / (SELECT COUNT(*) FROM leads WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')::NUMERIC * 100), 2)
          ELSE 0
        END as percentage
      FROM leads l
      WHERE l.source IS NOT NULL 
        AND l.source != ''
        ${dateFilter}
      GROUP BY l.source
      ORDER BY leads DESC
    `;

    const result = await db.query(leadSourcesQuery);

    res.json({
      status: 'success',
      data: {
        leadSources: result.rows.map(source => ({
          source: source.source,
          leads: parseInt(source.leads),
          revenue: parseFloat(source.revenue),
          conversionRate: parseFloat(source.conversion_rate),
          percentage: parseFloat(source.percentage)
        }))
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
