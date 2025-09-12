const db = require('../db');
const websocketService = require('../services/websocketService');

/**
 * Create a notification for a user
 * @param {number} userId - The user ID to create notification for
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (info, success, warning, error, work_order, warranty_work_order, repair_ticket, inventory, communication, customer, machine, system)
 * @param {string} relatedEntityType - Type of related entity (optional)
 * @param {number} relatedEntityId - ID of related entity (optional)
 * @returns {Promise<Object>} Created notification
 */
async function createNotification(userId, title, message, type = 'info', relatedEntityType = null, relatedEntityId = null) {
  try {
    const result = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id, title_key, message_key, message_params)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, title, message, type, relatedEntityType, relatedEntityId, '', '', '{}']
    );
    
    const notification = result.rows[0];
    
    // Emit real-time notification via WebSocket
    const wsInstance = websocketService.getInstance();
    await wsInstance.emitNotification(notification);
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Create notifications for multiple users
 * @param {Array<number>} userIds - Array of user IDs
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type
 * @param {string} relatedEntityType - Type of related entity (optional)
 * @param {number} relatedEntityId - ID of related entity (optional)
 * @returns {Promise<Array>} Created notifications
 */
async function createNotificationsForUsers(userIds, title, message, type = 'info', relatedEntityType = null, relatedEntityId = null) {
  try {
    const notifications = [];
    for (const userId of userIds) {
      const notification = await createNotification(userId, title, message, type, relatedEntityType, relatedEntityId);
      notifications.push(notification);
    }
    return notifications;
  } catch (error) {
    console.error('Error creating notifications for users:', error);
    throw error;
  }
}

/**
 * Create notification for all managers
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type
 * @param {string} relatedEntityType - Type of related entity (optional)
 * @param {number} relatedEntityId - ID of related entity (optional)
 * @returns {Promise<Array>} Created notifications
 */
async function createNotificationForManagers(title, message, type = 'info', relatedEntityType = null, relatedEntityId = null) {
  try {
    const result = await db.query(
      'SELECT id FROM users WHERE role IN ($1, $2)',
      ['admin', 'manager']
    );
    
    const managerIds = result.rows.map(row => row.id);
    return await createNotificationsForUsers(managerIds, title, message, type, relatedEntityType, relatedEntityId);
  } catch (error) {
    console.error('Error creating notification for managers:', error);
    throw error;
  }
}

/**
 * Create a simple test notification
 * @param {number} userId - The user ID to create notification for
 * @returns {Promise<Object>} Created notification
 */
async function createTestNotification(userId) {
  return await createNotification(
    userId, 
    'Test Notification', 
    'This is a test notification to verify the system is working correctly.', 
    'info',
    'system',
    null
  );
}

/**
 * Create work order notifications
 * @param {number} workOrderId - Work order ID
 * @param {string} action - Action performed (created, updated, deleted, assigned, completed, status_changed)
 * @param {string} workOrderType - Type of work order (work_order, warranty_work_order)
 * @param {number} currentUserId - ID of the user who performed the action
 * @param {Object} additionalData - Additional data for specific actions
 * @returns {Promise<Array>} Created notifications
 */
async function createWorkOrderNotification(workOrderId, action, workOrderType = 'work_order', currentUserId, additionalData = {}) {
  try {
    console.log(`Creating ${workOrderType} notification: ${action} for work order ${workOrderId}`);
    
    const workOrderQuery = `
      SELECT wo.*, wo.formatted_number, c.name as customer_name, u.name as technician_name
      FROM ${workOrderType === 'warranty_work_order' ? 'warranty_work_orders' : 'work_orders'} wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN users u ON wo.technician_id = u.id
      WHERE wo.id = $1
    `;

    const workOrderResult = await db.query(workOrderQuery, [workOrderId]);
    if (workOrderResult.rows.length === 0) {
      console.error(`${workOrderType} not found for notification:`, workOrderId);
      return [];
    }

    const workOrder = workOrderResult.rows[0];
    const formattedNumber = workOrder.formatted_number || `#${workOrderId}`;
    const workOrderPrefix = workOrderType === 'warranty_work_order' ? 'Warranty ' : '';

    let title, message, type = workOrderType;

    switch (action) {
      case 'created':
        title = `${workOrderPrefix}Work Order Created`;
        message = `New ${workOrderPrefix.toLowerCase()}work order ${formattedNumber} has been created`;
        break;

      case 'updated':
        title = `${workOrderPrefix}Work Order Updated`;
        message = `${workOrderPrefix}Work order ${formattedNumber} has been updated`;
        break;

      case 'deleted':
        title = `${workOrderPrefix}Work Order Deleted`;
        message = `${workOrderPrefix}Work order ${formattedNumber} has been deleted`;
        break;

      case 'assigned':
        const technicianName = additionalData.technicianName || workOrder.technician_name || 'Unknown';
        title = `${workOrderPrefix}Work Order Assigned`;
        message = `${workOrderPrefix}Work order ${formattedNumber} has been assigned to ${technicianName}`;
        break;

      case 'status_changed':
        const oldStatus = additionalData.oldStatus || 'Unknown';
        const newStatus = additionalData.newStatus || 'Unknown';
        title = `${workOrderPrefix}Work Order Status Changed`;
        message = `${workOrderPrefix}Work order ${formattedNumber} status changed from ${oldStatus} to ${newStatus}`;
        break;

      case 'completed':
        title = `${workOrderPrefix}Work Order Completed`;
        message = `${workOrderPrefix}Work order ${formattedNumber} has been completed`;
        break;

      default:
        console.warn(`Unknown ${workOrderType} notification action:`, action);
        return [];
    }

    // Get all users except the one who performed the action
    const result = await db.query('SELECT id FROM users WHERE id != $1', [currentUserId]);
    const userIdsToNotify = result.rows.map(row => row.id);
    
    return await createNotificationsForUsers(userIdsToNotify, title, message, type, workOrderType, workOrderId);
  } catch (error) {
    console.error(`Error creating ${workOrderType} notification:`, error);
    return [];
  }
}

/**
 * Create ticket notifications
 * @param {number} ticketId - Ticket ID
 * @param {string} action - Action performed (created, updated, deleted, converted)
 * @param {string} ticketType - Type of ticket (repair_ticket, warranty_repair_ticket)
 * @param {number} currentUserId - ID of the user who performed the action
 * @returns {Promise<Array>} Created notifications
 */
async function createTicketNotification(ticketId, action, ticketType = 'repair_ticket', currentUserId) {
  try {
    console.log(`Creating ${ticketType} notification: ${action} for ticket ${ticketId}`);
    
    const ticketQuery = `
      SELECT rt.*, rt.formatted_number, c.name as customer_name
      FROM ${ticketType === 'warranty_repair_ticket' ? 'warranty_repair_tickets' : 'repair_tickets'} rt
      LEFT JOIN customers c ON rt.customer_id = c.id
      WHERE rt.id = $1
    `;

    const ticketResult = await db.query(ticketQuery, [ticketId]);
    if (ticketResult.rows.length === 0) {
      console.error(`${ticketType} not found for notification:`, ticketId);
      return [];
    }

    const ticket = ticketResult.rows[0];
    const formattedNumber = ticket.formatted_number || `#${ticketId}`;
    const ticketPrefix = ticketType === 'warranty_repair_ticket' ? 'Warranty ' : '';

    let title, message, type = ticketType;

    switch (action) {
      case 'created':
        title = `${ticketPrefix}Repair Ticket Created`;
        message = `New ${ticketPrefix.toLowerCase()}repair ticket ${formattedNumber} has been created`;
        break;

      case 'updated':
        title = `${ticketPrefix}Repair Ticket Updated`;
        message = `${ticketPrefix}Repair ticket ${formattedNumber} has been updated`;
        break;

      case 'deleted':
        title = `${ticketPrefix}Repair Ticket Deleted`;
        message = `${ticketPrefix}Repair ticket ${formattedNumber} has been deleted`;
        break;

      case 'converted':
        title = `${ticketPrefix}Repair Ticket Converted`;
        message = `${ticketPrefix}Repair ticket ${formattedNumber} has been converted to a work order`;
        break;

      default:
        console.warn(`Unknown ${ticketType} notification action:`, action);
        return [];
    }

    // Get all users except the one who performed the action
    const result = await db.query('SELECT id FROM users WHERE id != $1', [currentUserId]);
    const userIdsToNotify = result.rows.map(row => row.id);
    
    return await createNotificationsForUsers(userIdsToNotify, title, message, type, ticketType, ticketId);
  } catch (error) {
    console.error(`Error creating ${ticketType} notification:`, error);
    return [];
  }
}

/**
 * Create customer notifications
 * @param {number} customerId - Customer ID
 * @param {string} action - Action performed (created, updated, deleted)
 * @param {number} currentUserId - ID of the user who performed the action
 * @returns {Promise<Array>} Created notifications
 */
async function createCustomerNotification(customerId, action, currentUserId) {
  try {
    const customerQuery = 'SELECT * FROM customers WHERE id = $1';
    const customerResult = await db.query(customerQuery, [customerId]);
    
    if (customerResult.rows.length === 0) {
      console.error('Customer not found for notification:', customerId);
      return [];
    }

    const customer = customerResult.rows[0];
    let title, message, type = 'customer';

    switch (action) {
      case 'created':
        title = 'Customer Created';
        message = `New customer "${customer.name}" has been added`;
        break;

      case 'updated':
        title = 'Customer Updated';
        message = `Customer "${customer.name}" has been updated`;
        break;

      case 'deleted':
        title = 'Customer Deleted';
        message = `Customer "${customer.name}" has been deleted`;
        break;

      default:
        console.warn('Unknown customer notification action:', action);
        return [];
    }

    // Get all users except the one who performed the action
    const result = await db.query('SELECT id FROM users WHERE id != $1', [currentUserId]);
    const userIdsToNotify = result.rows.map(row => row.id);
    
    return await createNotificationsForUsers(userIdsToNotify, title, message, type, 'customer', customerId);
  } catch (error) {
    console.error('Error creating customer notification:', error);
    return [];
  }
}

/**
 * Create inventory notifications
 * @param {number} inventoryId - Inventory item ID
 * @param {string} action - Action performed (created, updated, deleted, low_stock)
 * @param {number} currentUserId - ID of the user who performed the action
 * @returns {Promise<Array>} Created notifications
 */
async function createInventoryNotification(inventoryId, action, currentUserId) {
  try {
    const inventoryQuery = 'SELECT * FROM inventory WHERE id = $1';
    const inventoryResult = await db.query(inventoryQuery, [inventoryId]);
    
    if (inventoryResult.rows.length === 0) {
      console.error('Inventory item not found for notification:', inventoryId);
      return [];
    }

    const inventory = inventoryResult.rows[0];
    let title, message, type = 'inventory';

    switch (action) {
      case 'created':
        title = 'Inventory Item Created';
        message = `New inventory item "${inventory.name}" has been added`;
        break;

      case 'updated':
        title = 'Inventory Item Updated';
        message = `Inventory item "${inventory.name}" has been updated`;
        break;

      case 'deleted':
        title = 'Inventory Item Deleted';
        message = `Inventory item "${inventory.name}" has been deleted`;
        break;

      case 'low_stock':
        title = 'Low Stock Alert';
        message = `Inventory item "${inventory.name}" is running low (${inventory.quantity} items remaining)`;
        break;

      default:
        console.warn('Unknown inventory notification action:', action);
        return [];
    }

    // Get all users except the one who performed the action
    const result = await db.query('SELECT id FROM users WHERE id != $1', [currentUserId]);
    const userIdsToNotify = result.rows.map(row => row.id);
    
    return await createNotificationsForUsers(userIdsToNotify, title, message, type, 'inventory', inventoryId);
  } catch (error) {
    console.error('Error creating inventory notification:', error);
    return [];
  }
}

/**
 * Create system notifications
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type
 * @param {Array<number>} userIds - Specific user IDs to notify (optional, if not provided, notify all users)
 * @returns {Promise<Array>} Created notifications
 */
async function createSystemNotification(title, message, type = 'system', userIds = null) {
  try {
    if (userIds) {
      return await createNotificationsForUsers(userIds, title, message, type);
    } else {
      // Notify all users
      const result = await db.query('SELECT id FROM users');
      const allUserIds = result.rows.map(row => row.id);
      return await createNotificationsForUsers(allUserIds, title, message, type);
    }
  } catch (error) {
    console.error('Error creating system notification:', error);
    throw error;
  }
}

module.exports = {
  createNotification,
  createNotificationsForUsers,
  createNotificationForManagers,
  createTestNotification,
  createWorkOrderNotification,
  createTicketNotification,
  createCustomerNotification,
  createInventoryNotification,
  createSystemNotification,
};