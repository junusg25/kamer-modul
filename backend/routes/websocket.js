const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const websocketService = require('../services/websocketService');

// GET WebSocket connection statistics (admin only)
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const stats = {
      connectedUsers: websocketService.getConnectedUsers(),
      totalConnections: websocketService.getConnectedUsers().length,
      isServiceActive: websocketService.io !== null,
      timestamp: new Date().toISOString()
    };

    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    console.error('Error getting WebSocket stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get WebSocket statistics'
    });
  }
});

// GET user's WebSocket rooms (for debugging)
router.get('/user/:userId/rooms', authenticateToken, (req, res) => {
  try {
    const { userId } = req.params;
    const userRooms = websocketService.getUserRooms(parseInt(userId));
    
    res.json({
      status: 'success',
      data: {
        userId: parseInt(userId),
        rooms: Array.from(userRooms),
        isOnline: websocketService.isUserOnline(parseInt(userId))
      }
    });
  } catch (error) {
    console.error('Error getting user rooms:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user rooms'
    });
  }
});

// POST emit test message to specific user
router.post('/emit/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { event, data } = req.body;

    if (!event) {
      return res.status(400).json({
        status: 'error',
        message: 'Event name is required'
      });
    }

    websocketService.emitToUser(parseInt(userId), event, data || {});

    res.json({
      status: 'success',
      message: `Event '${event}' emitted to user ${userId}`,
      data: {
        userId: parseInt(userId),
        event,
        data: data || {},
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error emitting test message:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to emit test message'
    });
  }
});

// POST emit test message to room
router.post('/emit/room/:roomName', authenticateToken, async (req, res) => {
  try {
    const { roomName } = req.params;
    const { event, data } = req.body;

    if (!event) {
      return res.status(400).json({
        status: 'error',
        message: 'Event name is required'
      });
    }

    websocketService.emitToRoom(roomName, event, data || {});

    res.json({
      status: 'success',
      message: `Event '${event}' emitted to room '${roomName}'`,
      data: {
        roomName,
        event,
        data: data || {},
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error emitting room message:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to emit room message'
    });
  }
});

// POST emit test message to role
router.post('/emit/role/:role', authenticateToken, async (req, res) => {
  try {
    const { role } = req.params;
    const { event, data } = req.body;

    if (!event) {
      return res.status(400).json({
        status: 'error',
        message: 'Event name is required'
      });
    }

    websocketService.emitToRole(role, event, data || {});

    res.json({
      status: 'success',
      message: `Event '${event}' emitted to role '${role}'`,
      data: {
        role,
        event,
        data: data || {},
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error emitting role message:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to emit role message'
    });
  }
});

// GET WebSocket health check
router.get('/health', (req, res) => {
  try {
    const health = {
      service: 'websocket',
      status: websocketService.io !== null ? 'active' : 'inactive',
      connectedUsers: websocketService.getConnectedUsers().length,
      timestamp: new Date().toISOString()
    };

    const statusCode = health.status === 'active' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Error checking WebSocket health:', error);
    res.status(503).json({
      service: 'websocket',
      status: 'error',
      message: 'WebSocket service error',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
