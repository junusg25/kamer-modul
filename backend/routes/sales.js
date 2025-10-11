const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles, authorizePermission } = require('../middleware/auth');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validators');

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
        dateFilter = ''; // No date filter for year to show all historical data
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
    const { target_type = 'monthly' } = req.query;
    
    // Validate target_type
    if (!['monthly', 'quarterly', 'yearly'].includes(target_type)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid target_type. Must be monthly, quarterly, or yearly.'
      });
    }

    const teamQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        COALESCE(sm.total_machines_sold, 0) as total_sales,
        COALESCE(sm.total_sales_revenue, 0) as total_revenue,
        COALESCE(sm.avg_sale_price, 0) as avg_sale_price,
        COALESCE(sm.customers_served, 0) as customers_served,
        COALESCE(st.target_amount, 0) as target,
        CASE 
          WHEN COALESCE(st.target_amount, 0) > 0 AND COALESCE(sm.total_sales_revenue, 0) > 0 THEN 
            ROUND((COALESCE(sm.total_sales_revenue, 0) / st.target_amount * 100)::NUMERIC, 2)
          ELSE 0 
        END as completion_rate
      FROM users u
      LEFT JOIN sales_metrics sm ON u.id = sm.sales_user_id
      LEFT JOIN sales_targets st ON u.id = st.user_id 
        AND st.is_active = true 
        AND st.target_type = $1
        AND st.target_period_start <= CURRENT_DATE 
        AND st.target_period_end >= CURRENT_DATE
      WHERE u.role = 'sales' AND u.status = 'active'
      ORDER BY COALESCE(sm.total_sales_revenue, 0) DESC
    `;

    const result = await db.query(teamQuery, [target_type]);

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
        dateFilter = ''; // No date filter for year to show all historical data
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
    const { time_period = 'month', sales_person, start_date, end_date, group_by = 'month' } = req.query;
    
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

    // Determine grouping based on group_by parameter
    let groupByClause = 'DATE_TRUNC(\'day\', am.sale_date)';
    let dateFormat = 'YYYY-MM-DD';
    
    if (group_by === 'month') {
      groupByClause = 'DATE_TRUNC(\'month\', am.sale_date)';
      dateFormat = 'YYYY-MM';
    } else if (group_by === 'week') {
      groupByClause = 'DATE_TRUNC(\'week\', am.sale_date)';
      dateFormat = 'YYYY-"W"WW';
    } else if (group_by === 'quarter') {
      groupByClause = 'DATE_TRUNC(\'quarter\', am.sale_date)';
      dateFormat = 'YYYY-"Q"Q';
    }

    const query = `
      SELECT 
        ${groupByClause} as date,
        COUNT(*) as sales,
        COALESCE(SUM(am.sale_price), 0) as revenue,
        COUNT(DISTINCT am.customer_id) as customers
      FROM assigned_machines am
      WHERE am.is_sale = true 
        AND am.sale_date IS NOT NULL
        ${dateFilter}
        ${salesPersonFilter}
      GROUP BY ${groupByClause}
      ORDER BY date ASC
    `;

    const result = await db.query(query, params);
    
    // Process results based on grouping
    const trends = result.rows.map(row => ({
      date: row.date,
      month: group_by === 'month' ? new Date(row.date).toLocaleDateString('en-US', { month: 'short' }) : null,
      sales: parseInt(row.sales),
      revenue: parseFloat(row.revenue),
      customers: parseInt(row.customers),
      // Calculate leads and quotes from existing data (these would need separate queries in a real implementation)
      leads: parseInt(row.sales) * 2, // Estimated ratio
      quotes: Math.round(parseInt(row.sales) * 1.5), // Estimated ratio
      deals: parseInt(row.sales)
    }));
    
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
        dateFilter = ''; // No date filter for year to show all historical data
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
      INNER JOIN assigned_machines am ON c.id = am.customer_id 
        AND am.is_sale = true 
        AND am.sale_price > 0
        ${dateFilter}
      GROUP BY c.id, c.name, c.company_name
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
    const { months = 6, sales_person } = req.query;
    
    // Get historical sales data for the last 12 months to use for forecasting
    const historicalQuery = `
      SELECT 
        DATE_TRUNC('month', am.sale_date) as month,
        COALESCE(SUM(am.sale_price), 0) as revenue,
        COUNT(*) as sales_count
      FROM assigned_machines am
      WHERE am.is_sale = true 
        AND am.sale_date IS NOT NULL
        AND am.sale_date >= CURRENT_DATE - INTERVAL '12 months'
        ${sales_person ? 'AND am.sold_by_user_id = $1' : ''}
      GROUP BY DATE_TRUNC('month', am.sale_date)
      ORDER BY month ASC
    `;
    
    const historicalParams = sales_person ? [sales_person] : [];
    const historicalResult = await db.query(historicalQuery, historicalParams);
    
    // Simple linear regression for forecasting
    const forecasts = [];
    const forecastMonths = parseInt(months);
    
    if (historicalResult.rows.length >= 3) {
      // Calculate average monthly revenue and growth rate
      const revenues = historicalResult.rows.map(row => parseFloat(row.revenue));
      const avgRevenue = revenues.reduce((sum, rev) => sum + rev, 0) / revenues.length;
      
      // Calculate growth rate (simple linear trend)
      let growthRate = 0;
      if (revenues.length >= 2) {
        const firstHalf = revenues.slice(0, Math.floor(revenues.length / 2));
        const secondHalf = revenues.slice(Math.floor(revenues.length / 2));
        const firstAvg = firstHalf.reduce((sum, rev) => sum + rev, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, rev) => sum + rev, 0) / secondHalf.length;
        growthRate = secondAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
      }
      
      // Generate forecasts for the next N months
      const currentDate = new Date();
      for (let i = 1; i <= forecastMonths; i++) {
        const forecastDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        const monthName = forecastDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        // Apply growth rate to forecast
        const baseForecast = avgRevenue;
        const growthFactor = 1 + (growthRate / 100) * (i / 12); // Annualized growth
        const forecastedRevenue = Math.max(0, baseForecast * growthFactor);
        
        // Add some seasonal variation (simplified)
        const seasonalFactor = 1 + 0.1 * Math.sin((i * Math.PI) / 6); // 10% seasonal variation
        const finalForecast = forecastedRevenue * seasonalFactor;
        
        // Calculate confidence based on historical data consistency
        const variance = revenues.length > 1 ? 
          revenues.reduce((sum, rev) => sum + Math.pow(rev - avgRevenue, 2), 0) / revenues.length : 0;
        const coefficientOfVariation = avgRevenue > 0 ? Math.sqrt(variance) / avgRevenue : 0;
        const confidence = Math.max(50, Math.min(95, 90 - (coefficientOfVariation * 100)));
        
        forecasts.push({
          month: monthName,
          date: forecastDate.toISOString().split('T')[0],
          forecasted: Math.round(finalForecast),
          actual: 0, // Future months don't have actual data yet
          confidence: Math.round(confidence)
        });
      }
    } else {
      // Not enough historical data, use simple average
      const avgRevenue = historicalResult.rows.length > 0 ? 
        historicalResult.rows.reduce((sum, row) => sum + parseFloat(row.revenue), 0) / historicalResult.rows.length : 0;
      
      const currentDate = new Date();
      for (let i = 1; i <= forecastMonths; i++) {
        const forecastDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        const monthName = forecastDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        forecasts.push({
          month: monthName,
          date: forecastDate.toISOString().split('T')[0],
          forecasted: Math.round(avgRevenue),
          actual: 0,
          confidence: 60 // Lower confidence with limited data
        });
      }
    }
    
    res.json({
      status: 'success',
      data: forecasts
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

// ==================== SALES TARGETS MANAGEMENT ====================

// GET all sales targets
router.get('/targets', authenticateToken, authorizePermission('sales_targets:read'), async (req, res, next) => {
  try {
    const { user_id, target_type, is_active } = req.query;
    
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    if (user_id) {
      paramCount++;
      whereConditions.push(`st.user_id = $${paramCount}`);
      params.push(user_id);
    }

    if (target_type) {
      paramCount++;
      whereConditions.push(`st.target_type = $${paramCount}`);
      params.push(target_type);
    }

    if (is_active !== undefined) {
      paramCount++;
      whereConditions.push(`st.is_active = $${paramCount}`);
      params.push(is_active === 'true');
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const targetsQuery = `
      SELECT 
        st.*,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        cb.name as created_by_name
      FROM sales_targets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users cb ON st.created_by = cb.id
      ${whereClause}
      ORDER BY st.created_at DESC
    `;

    const result = await db.query(targetsQuery, params);

    res.json({
      status: 'success',
      data: {
        targets: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET targets for a specific user
router.get('/targets/user/:userId', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { target_type, is_active } = req.query;
    
    let whereConditions = ['st.user_id = $1'];
    let params = [userId];
    let paramCount = 1;

    if (target_type) {
      paramCount++;
      whereConditions.push(`st.target_type = $${paramCount}`);
      params.push(target_type);
    }

    if (is_active !== undefined) {
      paramCount++;
      whereConditions.push(`st.is_active = $${paramCount}`);
      params.push(is_active === 'true');
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const targetsQuery = `
      SELECT 
        st.*,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        cb.name as created_by_name
      FROM sales_targets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users cb ON st.created_by = cb.id
      ${whereClause}
      ORDER BY st.target_period_start DESC
    `;

    const result = await db.query(targetsQuery, params);

    res.json({
      status: 'success',
      data: {
        targets: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST create new sales target
router.post('/targets', authenticateToken, authorizeRoles('admin', 'manager'), [
  body('user_id').isInt().withMessage('User ID must be a valid integer'),
  body('target_type').isIn(['monthly', 'quarterly', 'yearly']).withMessage('Target type must be monthly, quarterly, or yearly'),
  body('target_amount').isDecimal().withMessage('Target amount must be a valid decimal'),
  body('target_period_start').isISO8601().withMessage('Target period start must be a valid date'),
  body('target_period_end').isISO8601().withMessage('Target period end must be a valid date'),
  body('description').optional().isString().withMessage('Description must be a string'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { user_id, target_type, target_amount, target_period_start, target_period_end, description } = req.body;
    const created_by = req.user.id;

    // Validate that the user exists and is a sales user
    const userCheck = await db.query('SELECT id, role FROM users WHERE id = $1 AND status = $2', [user_id, 'active']);
    if (userCheck.rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'User not found or inactive'
      });
    }

    if (userCheck.rows[0].role !== 'sales') {
      return res.status(400).json({
        status: 'error',
        message: 'Targets can only be set for sales users'
      });
    }

    // Deactivate any existing targets for this user and target type in the same period
    await db.query(
      'UPDATE sales_targets SET is_active = false WHERE user_id = $1 AND target_type = $2 AND target_period_start = $3',
      [user_id, target_type, target_period_start]
    );

    // Create new target
    const createTargetQuery = `
      INSERT INTO sales_targets (user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await db.query(createTargetQuery, [
      user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by
    ]);

    // Get the created target with user information
    const targetWithDetails = await db.query(`
      SELECT 
        st.*,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        cb.name as created_by_name
      FROM sales_targets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users cb ON st.created_by = cb.id
      WHERE st.id = $1
    `, [result.rows[0].id]);

    res.status(201).json({
      status: 'success',
      data: {
        target: targetWithDetails.rows[0]
      }
    });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        status: 'error',
        message: 'A target already exists for this user, type, and period'
      });
    }
    next(err);
  }
});

// PUT update sales target
router.put('/targets/:targetId', authenticateToken, authorizeRoles('admin', 'manager'), [
  body('target_amount').optional().isDecimal().withMessage('Target amount must be a valid decimal'),
  body('target_period_start').optional().isISO8601().withMessage('Target period start must be a valid date'),
  body('target_period_end').optional().isISO8601().withMessage('Target period end must be a valid date'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('is_active').optional().isBoolean().withMessage('Is active must be a boolean'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const { targetId } = req.params;
    const updates = req.body;
    const updated_by = req.user.id;

    // Check if target exists
    const targetCheck = await db.query('SELECT * FROM sales_targets WHERE id = $1', [targetId]);
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Target not found'
      });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        paramCount++;
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update'
      });
    }

    updateValues.push(targetId);
    paramCount++;

    const updateQuery = `
      UPDATE sales_targets 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(updateQuery, updateValues);

    // Get the updated target with user information
    const targetWithDetails = await db.query(`
      SELECT 
        st.*,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        cb.name as created_by_name
      FROM sales_targets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users cb ON st.created_by = cb.id
      WHERE st.id = $1
    `, [targetId]);

    res.json({
      status: 'success',
      data: {
        target: targetWithDetails.rows[0]
      }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE sales target (deactivate)
router.delete('/targets/:targetId', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    const { targetId } = req.params;

    // Check if target exists
    const targetCheck = await db.query('SELECT * FROM sales_targets WHERE id = $1', [targetId]);
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Target not found'
      });
    }

    // Deactivate the target instead of deleting
    await db.query('UPDATE sales_targets SET is_active = false WHERE id = $1', [targetId]);

    res.json({
      status: 'success',
      message: 'Target deactivated successfully'
    });
  } catch (err) {
    next(err);
  }
});

// GET current active targets for sales team performance
router.get('/targets/current', authenticateToken, async (req, res, next) => {
  try {
    const { user_id } = req.query;
    
    let whereConditions = ['st.is_active = true'];
    let params = [];
    let paramCount = 0;

    if (user_id) {
      paramCount++;
      whereConditions.push(`st.user_id = $${paramCount}`);
      params.push(user_id);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const currentTargetsQuery = `
      SELECT 
        st.*,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        cb.name as created_by_name
      FROM sales_targets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN users cb ON st.created_by = cb.id
      ${whereClause}
      ORDER BY st.user_id, st.target_type
    `;

    const result = await db.query(currentTargetsQuery, params);

    res.json({
      status: 'success',
      data: {
        targets: result.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
