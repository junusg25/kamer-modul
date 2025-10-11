const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { query, param } = require('express-validator');

// Middleware to ensure only admins can access these endpoints
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// GET /api/action-logs - Get all action logs with filters
router.get('/', async (req, res, next) => {
  try {
    const {
      user_id,
      action_type,
      entity_type,
      start_date,
      end_date,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (user_id) {
      whereConditions.push(`user_id = $${paramIndex}`);
      queryParams.push(user_id);
      paramIndex++;
    }

    if (action_type) {
      whereConditions.push(`action_type = $${paramIndex}`);
      queryParams.push(action_type);
      paramIndex++;
    }

    if (entity_type) {
      whereConditions.push(`entity_type = $${paramIndex}`);
      queryParams.push(entity_type);
      paramIndex++;
    }

    if (start_date) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(user_name ILIKE $${paramIndex} OR entity_name ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM user_action_logs ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Get logs with pagination
    const logsQuery = `
      SELECT 
        id,
        user_id,
        user_name,
        user_role,
        action_type,
        entity_type,
        entity_id,
        entity_name,
        action_details,
        ip_address,
        user_agent,
        created_at
      FROM user_action_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await db.query(logsQuery, [...queryParams, parseInt(limit), offset]);

    res.json({
      status: 'success',
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/action-logs/user/:userId - Get action logs for specific user
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const {
      action_type,
      entity_type,
      start_date,
      end_date,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let whereConditions = [`user_id = $1`];
    let queryParams = [userId];
    let paramIndex = 2;

    if (action_type) {
      whereConditions.push(`action_type = $${paramIndex}`);
      queryParams.push(action_type);
      paramIndex++;
    }

    if (entity_type) {
      whereConditions.push(`entity_type = $${paramIndex}`);
      queryParams.push(entity_type);
      paramIndex++;
    }

    if (start_date) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM user_action_logs ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Get logs with pagination
    const logsQuery = `
      SELECT 
        id,
        user_id,
        user_name,
        user_role,
        action_type,
        entity_type,
        entity_id,
        entity_name,
        action_details,
        ip_address,
        user_agent,
        created_at
      FROM user_action_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const result = await db.query(logsQuery, [...queryParams, parseInt(limit), offset]);

    // Get user info
    const userQuery = `SELECT id, name, email, role, status FROM users WHERE id = $1`;
    const userResult = await db.query(userQuery, [userId]);
    const userInfo = userResult.rows[0];

    // Get statistics for this user
    const statsQuery = `
      SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT entity_type) as entity_types_count,
        COUNT(CASE WHEN action_type = 'create' THEN 1 END) as creates,
        COUNT(CASE WHEN action_type = 'update' THEN 1 END) as updates,
        COUNT(CASE WHEN action_type = 'delete' THEN 1 END) as deletes,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_actions,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_actions,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as month_actions,
        MIN(created_at) as first_action,
        MAX(created_at) as last_action
      FROM user_action_logs
      WHERE user_id = $1
    `;
    const statsResult = await db.query(statsQuery, [userId]);
    const stats = statsResult.rows[0];

    // Get action breakdown by entity type
    const breakdownQuery = `
      SELECT 
        entity_type,
        COUNT(*) as count,
        COUNT(CASE WHEN action_type = 'create' THEN 1 END) as creates,
        COUNT(CASE WHEN action_type = 'update' THEN 1 END) as updates,
        COUNT(CASE WHEN action_type = 'delete' THEN 1 END) as deletes
      FROM user_action_logs
      WHERE user_id = $1
      GROUP BY entity_type
      ORDER BY count DESC
    `;
    const breakdownResult = await db.query(breakdownQuery, [userId]);

    res.json({
      status: 'success',
      data: {
        user: userInfo,
        logs: result.rows,
        statistics: stats,
        breakdown: breakdownResult.rows
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/action-logs/stats - Get overall action statistics
router.get('/stats', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (start_date) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    const statsQuery = `
      SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(DISTINCT entity_type) as entity_types,
        COUNT(CASE WHEN action_type = 'create' THEN 1 END) as total_creates,
        COUNT(CASE WHEN action_type = 'update' THEN 1 END) as total_updates,
        COUNT(CASE WHEN action_type = 'delete' THEN 1 END) as total_deletes,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_actions,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_actions,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as month_actions
      FROM user_action_logs
      ${whereClause}
    `;

    const result = await db.query(statsQuery, queryParams);

    // Get most active users
    const activeUsersQuery = `
      SELECT 
        user_id,
        user_name,
        user_role,
        COUNT(*) as action_count,
        MAX(created_at) as last_action
      FROM user_action_logs
      ${whereClause}
      GROUP BY user_id, user_name, user_role
      ORDER BY action_count DESC
      LIMIT 10
    `;
    const activeUsersResult = await db.query(activeUsersQuery, queryParams);

    // Get most common actions
    const actionsQuery = `
      SELECT 
        action_type,
        entity_type,
        COUNT(*) as count
      FROM user_action_logs
      ${whereClause}
      GROUP BY action_type, entity_type
      ORDER BY count DESC
      LIMIT 20
    `;
    const actionsResult = await db.query(actionsQuery, queryParams);

    res.json({
      status: 'success',
      data: {
        overall: result.rows[0],
        most_active_users: activeUsersResult.rows,
        common_actions: actionsResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/action-logs/entity/:entityType/:entityId - Get logs for specific entity
router.get('/entity/:entityType/:entityId', async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countQuery = `
      SELECT COUNT(*) 
      FROM user_action_logs 
      WHERE entity_type = $1 AND entity_id = $2
    `;
    const countResult = await db.query(countQuery, [entityType, entityId]);
    const total = parseInt(countResult.rows[0].count);

    const logsQuery = `
      SELECT 
        id,
        user_id,
        user_name,
        user_role,
        action_type,
        entity_type,
        entity_id,
        entity_name,
        action_details,
        ip_address,
        created_at
      FROM user_action_logs
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await db.query(logsQuery, [entityType, entityId, parseInt(limit), offset]);

    res.json({
      status: 'success',
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
