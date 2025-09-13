const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const WebSocketService = require('../services/websocketService');

// GET all feedback (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const { status, type, priority, user_id, page = 1, limit = 50 } = req.query;
    
    let query = `
      SELECT 
        f.*,
        u.name as user_name,
        u.role as user_role
      FROM feedback f
      LEFT JOIN users u ON f.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (status) {
      query += ` AND f.status = $${++paramCount}`;
      params.push(status);
    }
    
    if (type) {
      query += ` AND f.type = $${++paramCount}`;
      params.push(type);
    }
    
    if (priority) {
      query += ` AND f.priority = $${++paramCount}`;
      params.push(priority);
    }
    
    if (user_id) {
      query += ` AND f.user_id = $${++paramCount}`;
      params.push(user_id);
    }
    
    query += ` ORDER BY f.created_at DESC`;
    
    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), offset);
    
    const result = await db.query(query, params);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM feedback f
      WHERE 1=1
    `;
    
    const countParams = [];
    let countParamCount = 0;
    
    if (status) {
      countQuery += ` AND f.status = $${++countParamCount}`;
      countParams.push(status);
    }
    
    if (type) {
      countQuery += ` AND f.type = $${++countParamCount}`;
      countParams.push(type);
    }
    
    if (priority) {
      countQuery += ` AND f.priority = $${++countParamCount}`;
      countParams.push(priority);
    }
    
    if (user_id) {
      countQuery += ` AND f.user_id = $${++countParamCount}`;
      countParams.push(user_id);
    }
    
    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    // Format the response
    const feedback = result.rows.map(row => ({
      id: row.id,
      message: row.message,
      type: row.type,
      priority: row.priority,
      status: row.status,
      page_url: row.page_url,
      user_agent: row.user_agent,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at,
      admin_notes: row.admin_notes,
      user: {
        id: row.user_id,
        name: row.user_name,
        role: row.user_role
      }
    }));
    
    res.json({
      status: 'success',
      data: feedback,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// POST create new feedback
router.post('/', authenticateToken, [
  body('message').trim().isLength({ min: 1, max: 1000 }).withMessage('Message is required and must be less than 1000 characters'),
  body('type').isIn(['bug', 'feature', 'improvement', 'complaint', 'other']).withMessage('Invalid feedback type'),
  body('priority').isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('page_url').optional().isString(),
  body('user_agent').optional().isString(),
  body('timestamp').optional().isISO8601()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { message, type, priority, page_url, user_agent, timestamp } = req.body;
    
    const result = await db.query(`
      INSERT INTO feedback (
        user_id, message, type, priority, status, 
        page_url, user_agent, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $7)
      RETURNING *
    `, [
      req.user.id,
      message,
      type,
      priority,
      page_url || req.get('Referer') || 'unknown',
      user_agent || req.get('User-Agent') || 'unknown',
      timestamp ? new Date(timestamp) : new Date()
    ]);
    
    const feedback = result.rows[0];
    
    // Log the feedback submission
    console.log(`New feedback submitted by ${req.user.name} (${req.user.role}):`, {
      type,
      priority,
      message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
      page_url: feedback.page_url
    });
    
    // Emit WebSocket notification to admin users
    try {
      const wsService = WebSocketService.getInstance();
      if (wsService && wsService.io) {
        const connectedClients = wsService.io.engine.clientsCount;
        
        console.log('\n🔔 FEEDBACK NOTIFICATION');
        console.log('═'.repeat(30));
        console.log(`📝 New feedback from ${req.user.name}`);
        console.log(`📊 Type: ${type} | Priority: ${priority}`);
        console.log(`📄 Message: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
        console.log(`🌐 Page: ${feedback.page_url}`);
        console.log(`📡 Broadcasting to ${connectedClients} client(s)`);
        console.log('═'.repeat(30));
        
        // Emit to all connected clients (admins will filter on frontend)
        wsService.io.emit('feedback_submitted', {
          id: feedback.id,
          message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
          type,
          priority,
          page_url: feedback.page_url,
          user: {
            id: req.user.id,
            name: req.user.name,
            role: req.user.role
          },
          created_at: feedback.created_at,
          timestamp: new Date().toISOString()
        });
      }
    } catch (wsError) {
      console.error('❌ Failed to emit feedback notification:', wsError);
    }
    
    res.status(201).json({
      status: 'success',
      data: feedback,
      message: 'Feedback submitted successfully'
    });
    
  } catch (error) {
    next(error);
  }
});

// PATCH update feedback status (admin only)
router.patch('/:id', authenticateToken, authorizeRoles('admin'), [
  body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']).withMessage('Invalid status'),
  body('admin_notes').optional().isString().isLength({ max: 1000 }).withMessage('Admin notes must be less than 1000 characters')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { id } = req.params;
    const { status, admin_notes } = req.body;
    
    let updateFields = [];
    let params = [];
    let paramCount = 0;
    
    if (status) {
      updateFields.push(`status = $${++paramCount}`);
      params.push(status);
      
      if (status === 'resolved') {
        updateFields.push(`resolved_at = $${++paramCount}`);
        params.push(new Date());
      }
    }
    
    if (admin_notes !== undefined) {
      updateFields.push(`admin_notes = $${++paramCount}`);
      params.push(admin_notes);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update'
      });
    }
    
    updateFields.push(`updated_at = $${++paramCount}`);
    params.push(new Date());
    
    params.push(id);
    
    const result = await db.query(`
      UPDATE feedback 
      SET ${updateFields.join(', ')}
      WHERE id = $${++paramCount}
      RETURNING *
    `, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Feedback not found'
      });
    }
    
    const feedback = result.rows[0];
    
    console.log(`Feedback ${id} updated by admin ${req.user.name}:`, {
      status: feedback.status,
      admin_notes: admin_notes ? admin_notes.substring(0, 100) + '...' : 'none'
    });
    
    res.json({
      status: 'success',
      data: feedback,
      message: 'Feedback updated successfully'
    });
    
  } catch (error) {
    next(error);
  }
});

// DELETE feedback (admin only)
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM feedback WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Feedback not found'
      });
    }
    
    console.log(`Feedback ${id} deleted by admin ${req.user.name}`);
    
    res.json({
      status: 'success',
      message: 'Feedback deleted successfully'
    });
    
  } catch (error) {
    next(error);
  }
});

// GET current user info (for debugging)
router.get('/debug-user', authenticateToken, async (req, res, next) => {
  try {
    res.json({
      status: 'success',
      data: {
        user: req.user,
        role: req.user.role,
        id: req.user.id
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET feedback statistics (admin only)
router.get('/stats', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_feedback,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_count,
        COUNT(CASE WHEN type = 'bug' THEN 1 END) as bug_count,
        COUNT(CASE WHEN type = 'feature' THEN 1 END) as feature_count,
        COUNT(CASE WHEN type = 'improvement' THEN 1 END) as improvement_count,
        COUNT(CASE WHEN type = 'complaint' THEN 1 END) as complaint_count,
        COUNT(CASE WHEN type = 'other' THEN 1 END) as other_count,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_count,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_count
      FROM feedback
    `);
    
    const stats = result.rows[0];
    
    res.json({
      status: 'success',
      data: {
        total: parseInt(stats.total_feedback),
        by_status: {
          open: parseInt(stats.open_count),
          in_progress: parseInt(stats.in_progress_count),
          resolved: parseInt(stats.resolved_count),
          closed: parseInt(stats.closed_count)
        },
        by_type: {
          bug: parseInt(stats.bug_count),
          feature: parseInt(stats.feature_count),
          improvement: parseInt(stats.improvement_count),
          complaint: parseInt(stats.complaint_count),
          other: parseInt(stats.other_count)
        },
        by_priority: {
          urgent: parseInt(stats.urgent_count),
          high: parseInt(stats.high_count)
        }
      }
    });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;
