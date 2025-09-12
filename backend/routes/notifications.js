const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validators');
const db = require('../db');
const { createTestNotification } = require('../utils/notificationHelpers');

// Get all notifications for the authenticated user
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('type').optional().isIn(['info', 'success', 'warning', 'error', 'work_order', 'warranty_work_order', 'repair_ticket', 'inventory', 'communication', 'customer', 'machine', 'system']).withMessage('Invalid notification type'),
  query('is_read').optional().isBoolean().withMessage('is_read must be a boolean'),
  query('search').optional().isString().withMessage('Search query must be a string'),
  handleValidationErrors
], async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE user_id = $1';
    let params = [userId];
    let paramCount = 1;

    // Add filters
    if (req.query.type) {
      paramCount++;
      whereClause += ` AND type = $${paramCount}`;
      params.push(req.query.type);
    }

    if (req.query.is_read !== undefined) {
      paramCount++;
      whereClause += ` AND is_read = $${paramCount}`;
      params.push(req.query.is_read === 'true');
    }

    // Add search filter
    if (req.query.search) {
      paramCount++;
      whereClause += ` AND (title ILIKE $${paramCount} OR message ILIKE $${paramCount} OR title_key ILIKE $${paramCount} OR message_key ILIKE $${paramCount})`;
      params.push(`%${req.query.search}%`);
    }

    // Get notifications with pagination
    const notificationsQuery = `
      SELECT id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, title_key, message_key, message_params
      FROM notifications 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications 
      ${whereClause}
    `;

    const [notificationsResult, countResult] = await Promise.all([
      db.query(notificationsQuery, [...params, limit, offset]),
      db.query(countQuery, params)
    ]);

    const notifications = notificationsResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread notifications count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({ unreadCount: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark notification as read
router.patch('/:id/mark-read', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Invalid notification ID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const result = await db.query(
      'UPDATE notifications SET is_read = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *',
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark notification as read (alternative endpoint for compatibility)
router.patch('/:id/read', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Invalid notification ID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const result = await db.query(
      'UPDATE notifications SET is_read = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *',
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Update all unread notifications and get the count of affected rows
    const result = await db.query(
      'UPDATE notifications SET is_read = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({ 
      message: 'All notifications marked as read',
      updatedCount: result.rowCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete a notification
router.delete('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Invalid notification ID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const result = await db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Delete all read notifications
router.delete('/delete-read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      'DELETE FROM notifications WHERE user_id = $1 AND is_read = true',
      [userId]
    );

    res.json({ 
      message: 'All read notifications deleted',
      deletedCount: result.rowCount
    });
  } catch (error) {
    console.error('Error deleting read notifications:', error);
    res.status(500).json({ error: 'Failed to delete read notifications' });
  }
});

// Delete multiple notifications
router.post('/delete-multiple', authenticateToken, [
  body('ids').isArray({ min: 1 }).withMessage('IDs must be a non-empty array'),
  body('ids.*').isInt({ min: 1 }).withMessage('Each ID must be a positive integer'),
  handleValidationErrors
], async (req, res) => {
  try {
    const userId = req.user.id;
    const { ids } = req.body;

    // Delete notifications that belong to the user
    const result = await db.query(
      'DELETE FROM notifications WHERE id = ANY($1) AND user_id = $2',
      [ids, userId]
    );

    res.json({ 
      message: `${result.rowCount} notifications deleted successfully`,
      deletedCount: result.rowCount
    });
  } catch (error) {
    console.error('Error deleting multiple notifications:', error);
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
});

// Get notification by ID
router.get('/:id', authenticateToken, [
  param('id').isInt({ min: 1 }).withMessage('Invalid notification ID'),
  handleValidationErrors
], async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.id;

    const result = await db.query(
      'SELECT * FROM notifications WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({ error: 'Failed to fetch notification' });
  }
});

// Test endpoint to create a warranty repair ticket notification (for debugging)
router.post('/test-warranty-ticket', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('Creating test warranty repair ticket notification...');
    
    // Create a test notification for warranty repair ticket
    const result = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id, title_key, message_key, message_params)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        '', // title (empty, will use translation key)
        '', // message (empty, will use translation key)
        'warranty_repair_ticket',
        'warranty_repair_ticket', // related_entity_type
        999, // related_entity_id (test ID)
        'notifications.warrantyTicketCreated',
        'notifications.warrantyTicketCreatedMessage',
        JSON.stringify({ number: 'WRT-TEST-001' })
      ]
    );
    
    const notification = result.rows[0];
    console.log('Test notification created:', notification);
    
    // Try to emit via WebSocket
    try {
      const websocketService = require('../services/websocketService');
      await websocketService.emitNotification(notification);
      console.log('WebSocket notification emitted successfully');
    } catch (wsError) {
      console.error('WebSocket error:', wsError);
    }
    
    res.json({
      message: 'Test warranty repair ticket notification created',
      notification
    });
  } catch (error) {
    console.error('Error creating test warranty repair ticket notification:', error);
    res.status(500).json({ error: 'Failed to create test notification' });
  }
});

// Test endpoint to create a simple notification
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const notification = await createTestNotification(userId);
    
    res.json({
      status: 'success',
      message: 'Test notification created successfully',
      notification
    });
  } catch (error) {
    console.error('Error creating test notification:', error);
    res.status(500).json({ error: 'Failed to create test notification' });
  }
});

// Create multiple test notifications
router.post('/test-multiple', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { createNotification } = require('../utils/notificationHelpers');
    
    const testNotifications = [
      {
        title: 'Work Order Created',
        message: 'A new work order #WO-2024-001 has been created for customer John Doe.',
        type: 'work_order',
        relatedEntityType: 'work_order',
        relatedEntityId: 1
      },
      {
        title: 'Repair Ticket Updated',
        message: 'Repair ticket #RT-2024-002 status has been updated to "In Progress".',
        type: 'repair_ticket',
        relatedEntityType: 'repair_ticket',
        relatedEntityId: 2
      },
      {
        title: 'Customer Added',
        message: 'New customer "ABC Company" has been added to the system.',
        type: 'customer',
        relatedEntityType: 'customer',
        relatedEntityId: 3
      },
      {
        title: 'Low Stock Alert',
        message: 'Inventory item "Screw Driver Set" is running low (5 items remaining).',
        type: 'inventory',
        relatedEntityType: 'inventory',
        relatedEntityId: 4
      },
      {
        title: 'System Maintenance',
        message: 'Scheduled system maintenance will occur tonight at 2:00 AM.',
        type: 'system',
        relatedEntityType: null,
        relatedEntityId: null
      }
    ];
    
    const notifications = [];
    for (const notif of testNotifications) {
      const notification = await createNotification(
        userId, 
        notif.title, 
        notif.message, 
        notif.type,
        notif.relatedEntityType,
        notif.relatedEntityId
      );
      notifications.push(notification);
    }
    
    res.json({
      status: 'success',
      message: 'Test notifications created successfully',
      notifications
    });
  } catch (error) {
    console.error('Error creating test notifications:', error);
    res.status(500).json({ error: 'Failed to create test notifications' });
  }
});

module.exports = router;
