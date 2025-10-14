const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../db');
const logger = require('../utils/logger');

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socket
    this.userRooms = new Map(); // userId -> Set of room names
    this.userStatuses = new Map(); // userId -> { name, role, status, connectedAt }
  }

  static getInstance() {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001'
        ],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    
    logger.info('WebSocket service initialized');
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        socket.userName = decoded.name;
        
        next();
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        next(new Error('Invalid authentication token'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`User ${socket.userName} (${socket.userId}) connected`);
      
      this.handleConnection(socket);
      
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

      socket.on('join_room', (roomName) => {
        this.handleJoinRoom(socket, roomName);
      });

      socket.on('leave_room', (roomName) => {
        this.handleLeaveRoom(socket, roomName);
      });

      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      socket.on('user_presence', (data) => {
        this.handleUserPresence(socket, data);
      });

      socket.on('heartbeat', async () => {
        // Update last_activity in database when client sends heartbeat
        try {
          await db.query(
            'UPDATE online_users SET last_activity = CURRENT_TIMESTAMP WHERE user_id = $1',
            [socket.userId]
          );
        } catch (error) {
          logger.error('Error updating heartbeat:', error);
        }
      });
    });
  }

  handleConnection(socket) {
    const userId = socket.userId;
    const userRole = socket.userRole;
    
    // Store connected user
    this.connectedUsers.set(userId, socket);
    
    // Join user-specific room
    socket.join(`user_${userId}`);
    
    // Join role-based rooms
    socket.join(`role_${userRole}`);
    
    // Join admin room if user is admin or manager
    if (userRole === 'admin' || userRole === 'manager') {
      socket.join('admin_room');
    }
    
    // Store user rooms
    this.userRooms.set(userId, new Set([
      `user_${userId}`,
      `role_${userRole}`,
      ...(userRole === 'admin' || userRole === 'manager' ? ['admin_room'] : [])
    ]));
    
    // Emit user online event
    this.io.to(`role_${userRole}`).emit('user_online', {
      userId,
      userName: socket.userName,
      timestamp: new Date().toISOString()
    });
    
    // Store user status in memory for real-time tracking
    this.userStatuses.set(userId, {
      name: socket.userName,
      role: userRole,
      status: 'online',
      connectedAt: new Date().toISOString(),
      actionsCount: 0,
      lastActionAt: new Date().toISOString()
    });
    
    // Emit to all admins that a user came online
    this.io.to('admin_room').emit('user_activity_update', {
      userId,
      userName: socket.userName,
      userRole,
      status: 'online',
      timestamp: new Date().toISOString()
    });
    
    // Update user's online status in database
    this.updateUserOnlineStatus(userId, true);
  }

  handleDisconnection(socket) {
    const userId = socket.userId;
    const userRole = socket.userRole;
    
    logger.info(`User ${socket.userName} (${userId}) disconnected`);
    
    // Remove from connected users and status tracking
    this.connectedUsers.delete(userId);
    this.userRooms.delete(userId);
    this.userStatuses.delete(userId);
    
    // Emit user offline event
    this.io.to(`role_${userRole}`).emit('user_offline', {
      userId,
      userName: socket.userName,
      timestamp: new Date().toISOString()
    });
    
    // Emit to all admins that a user went offline
    this.io.to('admin_room').emit('user_activity_update', {
      userId,
      userName: socket.userName,
      userRole,
      status: 'offline',
      timestamp: new Date().toISOString()
    });
    
    // Update user's online status in database
    this.updateUserOnlineStatus(userId, false);
  }

  handleJoinRoom(socket, roomName) {
    socket.join(roomName);
    const userId = socket.userId;
    
    if (!this.userRooms.has(userId)) {
      this.userRooms.set(userId, new Set());
    }
    this.userRooms.get(userId).add(roomName);
    
    logger.info(`User ${socket.userName} joined room: ${roomName}`);
  }

  handleLeaveRoom(socket, roomName) {
    socket.leave(roomName);
    const userId = socket.userId;
    
    if (this.userRooms.has(userId)) {
      this.userRooms.get(userId).delete(roomName);
    }
    
    logger.info(`User ${socket.userName} left room: ${roomName}`);
  }

  handleTypingStart(socket, data) {
    const { roomName, message } = data;
    socket.to(roomName).emit('user_typing_start', {
      userId: socket.userId,
      userName: socket.userName,
      message
    });
  }

  handleTypingStop(socket, data) {
    const { roomName } = data;
    socket.to(roomName).emit('user_typing_stop', {
      userId: socket.userId,
      userName: socket.userName
    });
  }

  handleUserPresence(socket, data) {
    const { status, workOrderId } = data;
    socket.to(`work_order_${workOrderId}`).emit('user_presence_update', {
      userId: socket.userId,
      userName: socket.userName,
      status,
      workOrderId,
      timestamp: new Date().toISOString()
    });
  }

  async updateUserOnlineStatus(userId, isOnline) {
    try {
      if (isOnline) {
        // User connected - insert into online_users table
        await db.query(`
          INSERT INTO online_users (user_id, connected_at, last_activity)
          VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id) DO UPDATE
          SET connected_at = CURRENT_TIMESTAMP, last_activity = CURRENT_TIMESTAMP
        `, [userId]);
        
        // Also update last_seen in users table
        await db.query(
          'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
          [userId]
        );
      } else {
        // User disconnected - remove from online_users table
        await db.query(
          'DELETE FROM online_users WHERE user_id = $1',
          [userId]
        );
        
        // Update last_seen in users table
        await db.query(
          'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
          [userId]
        );
      }
    } catch (error) {
      logger.error('Error updating user online status:', error);
    }
  }

  // Public methods for emitting events
  emitToUser(userId, event, data) {
    const socket = this.connectedUsers.get(userId);
    if (socket) {
      socket.emit(event, data);
    }
  }

  emitToRoom(roomName, event, data) {
    this.io.to(roomName).emit(event, data);
  }

  emitToRole(role, event, data) {
    this.io.to(`role_${role}`).emit(event, data);
  }

  emitToAdmins(event, data) {
    this.io.to('admin_room').emit(event, data);
  }

  emitToAll(event, data) {
    this.io.emit(event, data);
  }

  // Get all user statuses from memory (real-time)
  getAllUserStatuses() {
    const statuses = [];
    for (const [userId, status] of this.userStatuses) {
      statuses.push({
        id: userId,
        name: status.name,
        role: status.role,
        status: status.status,
        connectedAt: status.connectedAt,
        session_duration: this.calculateSessionDuration(status.connectedAt),
        actions_count: status.actionsCount || 0,
        login_attempts: 0
      });
    }
    return statuses;
  }

  // Track user action (called when user performs any action)
  async trackUserAction(userId) {
    const userStatus = this.userStatuses.get(userId);
    if (userStatus) {
      userStatus.actionsCount = (userStatus.actionsCount || 0) + 1;
      userStatus.lastActionAt = new Date().toISOString();
      this.userStatuses.set(userId, userStatus);
      
      // Update last_activity in database for PM2 cluster compatibility
      try {
        await db.query(
          'UPDATE online_users SET last_activity = CURRENT_TIMESTAMP WHERE user_id = $1',
          [userId]
        );
      } catch (error) {
        logger.error('Error updating user last_activity:', error);
      }
      
      // Emit update to admins
      this.io.to('admin_room').emit('user_activity_update', {
        userId,
        userName: userStatus.name,
        userRole: userStatus.role,
        status: userStatus.status,
        actionsCount: userStatus.actionsCount,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Calculate session duration
  calculateSessionDuration(connectedAt) {
    const now = new Date();
    const connected = new Date(connectedAt);
    const diffMs = now - connected;
    const diffMins = Math.floor(diffMs / 60000);
    return `${diffMins}m`;
  }

  // Notification specific methods
  async emitNotification(notification) {
    try {
      // Emit to specific user
      this.emitToUser(notification.user_id, 'notification_received', {
        notification,
        timestamp: new Date().toISOString()
      });

      // Emit to user's role room for real-time updates
      const userResult = await db.query('SELECT role FROM users WHERE id = $1', [notification.user_id]);
      if (userResult.rows.length > 0) {
        this.emitToRole(userResult.rows[0].role, 'notification_count_updated', {
          userId: notification.user_id,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error emitting notification:', error);
    }
  }

  async emitWorkOrderUpdate(workOrderId, action, data) {
    try {
      // Get work order details
      const result = await db.query(`
        SELECT wo.*, c.name as customer_name, u.name as technician_name
        FROM work_orders wo
        LEFT JOIN customers c ON wo.customer_id = c.id
        LEFT JOIN users u ON wo.technician_id = u.id
        WHERE wo.id = $1
      `, [workOrderId]);

      if (result.rows.length > 0) {
        const workOrder = result.rows[0];
        
        // Emit to work order room
        this.emitToRoom(`work_order_${workOrderId}`, 'work_order_updated', {
          workOrderId,
          action,
          workOrder,
          data,
          timestamp: new Date().toISOString()
        });

        // Emit to technician if assigned
        if (workOrder.technician_id) {
          this.emitToUser(workOrder.technician_id, 'work_order_assignment_update', {
            workOrderId,
            action,
            workOrder,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      logger.error('Error emitting work order update:', error);
    }
  }

  async emitRepairTicketUpdate(ticketId, action, data) {
    try {
      // Get ticket details
      const result = await db.query(`
        SELECT rt.*, c.name as customer_name, u.name as submitted_by_name
        FROM repair_tickets rt
        LEFT JOIN customers c ON rt.customer_id = c.id
        LEFT JOIN users u ON rt.submitted_by = u.id
        WHERE rt.id = $1
      `, [ticketId]);

      if (result.rows.length > 0) {
        const ticket = result.rows[0];
        
        // Emit to ticket room
        this.emitToRoom(`ticket_${ticketId}`, 'repair_ticket_updated', {
          ticketId,
          action,
          ticket,
          data,
          timestamp: new Date().toISOString()
        });

        // Emit to admins/managers
        this.emitToAdmins('repair_ticket_update', {
          ticketId,
          action,
          ticket,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error emitting repair ticket update:', error);
    }
  }

  async emitMachineUpdate(machineId, action, data) {
    try {
      // Get machine details
      const result = await db.query(`
        SELECT mm.*, mc.name as category_name
        FROM machine_models mm
        LEFT JOIN machine_categories mc ON mm.category_id = mc.id
        WHERE mm.id = $1
      `, [machineId]);

      if (result.rows.length > 0) {
        const machine = result.rows[0];
        
        // Emit to machine room
        this.emitToRoom(`machine_${machineId}`, 'machine_updated', {
          machineId,
          action,
          machine,
          data,
          timestamp: new Date().toISOString()
        });

        // Emit to admins/managers
        this.emitToAdmins('machine_update', {
          machineId,
          action,
          machine,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error emitting machine update:', error);
    }
  }

  async emitAssignedMachineUpdate(assignedMachineId, action, data) {
    try {
      // Get assigned machine details
      const result = await db.query(`
        SELECT am.*, c.name as customer_name, mm.name as machine_name, mm.manufacturer
        FROM sold_machines am
        LEFT JOIN customers c ON am.customer_id = c.id
        LEFT JOIN machine_serials ms ON am.serial_id = ms.id
        LEFT JOIN machine_models mm ON ms.model_id = mm.id
        WHERE am.id = $1
      `, [assignedMachineId]);

      if (result.rows.length > 0) {
        const assignedMachine = result.rows[0];
        
        // Emit to assigned machine room
        this.emitToRoom(`assigned_machine_${assignedMachineId}`, 'assigned_machine_updated', {
          assignedMachineId,
          action,
          assignedMachine,
          data,
          timestamp: new Date().toISOString()
        });

        // Emit to admins/managers
        this.emitToAdmins('assigned_machine_update', {
          assignedMachineId,
          action,
          assignedMachine,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error emitting assigned machine update:', error);
    }
  }

  async emitCustomerUpdate(customerId, action, data) {
    try {
      // Get customer details
      const result = await db.query(`
        SELECT * FROM customers WHERE id = $1
      `, [customerId]);

      if (result.rows.length > 0) {
        const customer = result.rows[0];
        
        // Emit to customer room
        this.emitToRoom(`customer_${customerId}`, 'customer_updated', {
          customerId,
          action,
          customer,
          data,
          timestamp: new Date().toISOString()
        });

        // Emit to admins/managers
        this.emitToAdmins('customer_update', {
          customerId,
          action,
          customer,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error emitting customer update:', error);
    }
  }

  async emitUserUpdate(userId, action, data) {
    try {
      // Get user details
      const result = await db.query(`
        SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1
      `, [userId]);

      if (result.rows.length > 0) {
        const user = result.rows[0];
        
        // Emit to user room
        this.emitToRoom(`user_${userId}`, 'user_updated', {
          userId,
          action,
          user,
          data,
          timestamp: new Date().toISOString()
        });

        // Emit to admins/managers
        this.emitToAdmins('user_update', {
          userId,
          action,
          user,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error emitting user update:', error);
    }
  }

  // Get connected users info
  getConnectedUsers() {
    const users = [];
    this.connectedUsers.forEach((socket, userId) => {
      users.push({
        userId,
        userName: socket.userName,
        userRole: socket.userRole,
        connectedAt: socket.connectedAt
      });
    });
    return users;
  }

  // Get user's rooms
  getUserRooms(userId) {
    return this.userRooms.get(userId) || new Set();
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }
}

// Export the class with static getInstance method
module.exports = WebSocketService;
