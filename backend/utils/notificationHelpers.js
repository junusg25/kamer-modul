const db = require('../db');
const websocketService = require('../services/websocketService');

/**
 * Translate work order status to translation key
 * @param {string} status - Raw status value
 * @returns {string} Translation key
 */
function translateStatus(status) {
  const statusKeys = {
    'intake': 'status.intake',
    'quoted': 'status.quoted',
    'awaiting_approval': 'status.awaiting_approval',
    'declined': 'status.declined',
    'pending': 'status.pending',
    'in_progress': 'status.in_progress',
    'completed': 'status.completed',
    'ready_for_pickup': 'status.ready_for_pickup',
    'cancelled': 'status.cancelled',
    'converted': 'status.converted',
    'all': 'status.all',
    'testing': 'status.testing',
    'parts_ordered': 'status.partsOrdered',
    'waiting_supplier_intervention': 'status.waitingSupplier',
    'service_cancelled': 'status.serviceCancelled',
    'warranty_rejected': 'status.warrantyRejected'
  };
  
  return statusKeys[status] || status;
}

/**
 * Create a notification for a user
 * @param {number} userId - The user ID to create notification for
 * @param {string} titleKey - Notification title translation key
 * @param {string} messageKey - Notification message translation key
 * @param {Object} messageParams - Parameters for message translation (optional)
 * @param {string} type - Notification type (info, success, warning, error, work_order, warranty_work_order, repair_ticket, inventory, communication, customer, machine, system)
 * @param {string} relatedEntityType - Type of related entity (optional)
 * @param {number} relatedEntityId - ID of related entity (optional)
 * @returns {Promise<Object>} Created notification
 */
async function createNotification(userId, titleKey, messageKey, messageParams = {}, type = 'info', relatedEntityType = null, relatedEntityId = null) {
  try {
    const result = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id, title_key, message_key, message_params)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, '', '', type, relatedEntityType, relatedEntityId, titleKey, messageKey, JSON.stringify(messageParams)]
    );
    
    const notification = result.rows[0];
    
    // Emit real-time notification via WebSocket
    await websocketService.emitNotification(notification);
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Create notifications for multiple users
 * @param {Array<number>} userIds - Array of user IDs
 * @param {string} titleKey - Notification title translation key
 * @param {string} messageKey - Notification message translation key
 * @param {Object} messageParams - Parameters for message translation (optional)
 * @param {string} type - Notification type
 * @param {string} relatedEntityType - Type of related entity (optional)
 * @param {number} relatedEntityId - ID of related entity (optional)
 * @returns {Promise<Array>} Created notifications
 */
async function createNotificationsForUsers(userIds, titleKey, messageKey, messageParams = {}, type = 'info', relatedEntityType = null, relatedEntityId = null) {
  try {
    const notifications = [];
    for (const userId of userIds) {
      const notification = await createNotification(userId, titleKey, messageKey, messageParams, type, relatedEntityType, relatedEntityId);
      notifications.push(notification);
    }
    return notifications;
  } catch (error) {
    console.error('Error creating notifications for users:', error);
    throw error;
  }
}

/**
 * Create notifications for all admins and managers
 * @param {string} titleKey - Notification title translation key
 * @param {string} messageKey - Notification message translation key
 * @param {Object} messageParams - Parameters for message translation (optional)
 * @param {string} type - Notification type
 * @param {string} relatedEntityType - Type of related entity (optional)
 * @param {number} relatedEntityId - ID of related entity (optional)
 * @returns {Promise<Array>} Created notifications
 */
async function createNotificationForManagers(titleKey, messageKey, messageParams = {}, type = 'info', relatedEntityType = null, relatedEntityId = null) {
  try {
    const result = await db.query(
      'SELECT id FROM users WHERE role IN ($1, $2)',
      ['admin', 'manager']
    );
    
    const managerIds = result.rows.map(row => row.id);
    return await createNotificationsForUsers(managerIds, titleKey, messageKey, messageParams, type, relatedEntityType, relatedEntityId);
  } catch (error) {
    console.error('Error creating notification for managers:', error);
    throw error;
  }
}

/**
 * Create comprehensive ticket notifications (repair and warranty)
 * @param {number} ticketId - Ticket ID
 * @param {string} action - Action performed (created, updated, deleted, converted)
 * @param {string} ticketType - Type of ticket (repair_ticket, warranty_repair_ticket)
 * @param {number} currentUserId - ID of the user who performed the action
 * @returns {Promise<Array>} Created notifications
 */
async function createTicketNotification(ticketId, action, ticketType = 'repair_ticket', currentUserId) {
  try {
    console.log(`createTicketNotification called with: ticketId=${ticketId}, action=${action}, ticketType=${ticketType}, currentUserId=${currentUserId}`);
    
    // Get ticket details based on type
    let ticketQuery;
    if (ticketType === 'warranty_repair_ticket') {
      ticketQuery = `
        SELECT wrt.*, wrt.formatted_number, c.name as customer_name, u.name as submitted_by_name
        FROM warranty_repair_tickets wrt
        LEFT JOIN customers c ON wrt.customer_id = c.id
        LEFT JOIN users u ON wrt.submitted_by = u.id
        WHERE wrt.id = $1
      `;
    } else {
      ticketQuery = `
        SELECT rt.*, rt.formatted_number, c.name as customer_name, u.name as submitted_by_name
        FROM repair_tickets rt
        LEFT JOIN customers c ON rt.customer_id = c.id
        LEFT JOIN users u ON rt.submitted_by = u.id
        WHERE rt.id = $1
      `;
    }

    const ticketResult = await db.query(ticketQuery, [ticketId]);
    if (ticketResult.rows.length === 0) {
      console.error(`${ticketType} not found for notification:`, ticketId);
      return [];
    }

    const ticket = ticketResult.rows[0];
    const formattedNumber = ticket.formatted_number || `#${ticketId}`;

    let titleKey, messageKey, messageParams, type;

    switch (action) {
      case 'created':
        titleKey = ticketType === 'warranty_repair_ticket' ? 'notifications.warrantyTicketCreated' : 'notifications.ticketCreated';
        messageKey = ticketType === 'warranty_repair_ticket' ? 'notifications.warrantyTicketCreatedMessage' : 'notifications.ticketCreatedMessage';
        messageParams = { number: formattedNumber };
        type = ticketType;
        break;

      case 'updated':
        titleKey = ticketType === 'warranty_repair_ticket' ? 'notifications.warrantyTicketUpdated' : 'notifications.ticketUpdated';
        messageKey = ticketType === 'warranty_repair_ticket' ? 'notifications.warrantyTicketUpdatedMessage' : 'notifications.ticketUpdatedMessage';
        messageParams = { number: formattedNumber };
        type = ticketType;
        break;

      case 'deleted':
        titleKey = ticketType === 'warranty_repair_ticket' ? 'notifications.warrantyTicketDeleted' : 'notifications.ticketDeleted';
        messageKey = ticketType === 'warranty_repair_ticket' ? 'notifications.warrantyTicketDeletedMessage' : 'notifications.ticketDeletedMessage';
        messageParams = { number: formattedNumber };
        type = ticketType;
        break;

      case 'converted':
        titleKey = ticketType === 'warranty_repair_ticket' ? 'notifications.warrantyTicketConverted' : 'notifications.ticketConverted';
        messageKey = ticketType === 'warranty_repair_ticket' ? 'notifications.warrantyTicketConvertedMessage' : 'notifications.ticketConvertedMessage';
        messageParams = { number: formattedNumber };
        type = ticketType;
        break;

      default:
        console.warn(`Unknown ${ticketType} notification action:`, action);
        return [];
    }

    return await createNotificationForEveryoneExcept(currentUserId, titleKey, messageKey, messageParams, type, ticketType, ticketId);
  } catch (error) {
    console.error(`Error creating ${ticketType} notification:`, error);
    return [];
  }
}

/**
 * Create comprehensive work order notifications (regular and warranty)
 * @param {number} workOrderId - Work order ID
 * @param {string} action - Action performed (created, updated, deleted, assigned, completed, status_changed)
 * @param {string} workOrderType - Type of work order (work_order, warranty_work_order)
 * @param {number} currentUserId - ID of the user who performed the action
 * @param {Object} additionalData - Additional data for specific actions
 * @returns {Promise<Array>} Created notifications
 */
async function createWorkOrderNotification(workOrderId, action, workOrderType = 'work_order', currentUserId, additionalData = {}) {
  try {
    console.log(`createWorkOrderNotification called with: workOrderId=${workOrderId}, action=${action}, workOrderType=${workOrderType}, currentUserId=${currentUserId}`);
    
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

    let titleKey, messageKey, messageParams, type;

    switch (action) {
      case 'created':
        titleKey = workOrderType === 'warranty_work_order' ? 'notifications.warrantyWorkOrderCreated' : 'notifications.workOrderCreated';
        messageKey = workOrderType === 'warranty_work_order' ? 'notifications.warrantyWorkOrderCreatedMessage' : 'notifications.workOrderCreatedMessage';
        messageParams = { number: formattedNumber };
        type = workOrderType;
        break;

      case 'updated':
        titleKey = workOrderType === 'warranty_work_order' ? 'notifications.warrantyWorkOrderUpdated' : 'notifications.workOrderUpdated';
        messageKey = workOrderType === 'warranty_work_order' ? 'notifications.warrantyWorkOrderUpdatedMessage' : 'notifications.workOrderUpdatedMessage';
        messageParams = { number: formattedNumber };
        type = workOrderType;
        break;

      case 'deleted':
        titleKey = workOrderType === 'warranty_work_order' ? 'notifications.warrantyWorkOrderDeleted' : 'notifications.workOrderDeleted';
        messageKey = workOrderType === 'warranty_work_order' ? 'notifications.warrantyWorkOrderDeletedMessage' : 'notifications.workOrderDeletedMessage';
        messageParams = { number: formattedNumber };
        type = workOrderType;
        break;

      case 'assigned':
        // For assignment notifications, use actual technician name
        const technicianName = additionalData.technicianName || workOrder.technician_name || 'Unknown';
        titleKey = workOrderType === 'warranty_work_order' ? 'notifications.warrantyWorkOrderAssigned' : 'notifications.workOrderAssigned';
        messageKey = workOrderType === 'warranty_work_order' ? 'notifications.warrantyWorkOrderAssignedMessage' : 'notifications.workOrderAssignedMessage';
        messageParams = { number: formattedNumber, technician: technicianName };
        type = workOrderType;
        break;

      case 'status_changed':
        const oldStatus = additionalData.oldStatus || 'Unknown';
        const newStatus = additionalData.newStatus || 'Unknown';
        titleKey = workOrderType === 'warranty_work_order' ? 'notifications.warrantyWorkOrderStatusChanged' : 'notifications.workOrderStatusChanged';
        messageKey = workOrderType === 'warranty_work_order' ? 'notifications.warrantyWorkOrderStatusChangedMessage' : 'notifications.workOrderStatusChangedMessage';
        messageParams = { 
          number: formattedNumber, 
          oldStatus: translateStatus(oldStatus), 
          newStatus: translateStatus(newStatus) 
        };
        type = workOrderType;
        break;

      case 'completed':
        titleKey = workOrderType === 'warranty_work_order' ? 'notifications.warrantyWorkOrderCompleted' : 'notifications.workOrderCompleted';
        messageKey = workOrderType === 'warranty_work_order' ? 'notifications.warrantyWorkOrderCompletedMessage' : 'notifications.workOrderCompletedMessage';
        messageParams = { number: formattedNumber };
        type = workOrderType;
        break;

      default:
        console.warn(`Unknown ${workOrderType} notification action:`, action);
        return [];
    }

    return await createNotificationForEveryoneExcept(currentUserId, titleKey, messageKey, messageParams, type, workOrderType, workOrderId);
  } catch (error) {
    console.error(`Error creating ${workOrderType} notification:`, error);
    return [];
  }
}

/**
 * Create machine notifications
 * @param {number} machineId - Machine ID
 * @param {string} action - Action performed (created, updated, deleted)
 * @param {number} currentUserId - ID of the user who performed the action
 * @returns {Promise<Array>} Created notifications
 */
async function createMachineNotification(machineId, action, currentUserId) {
  try {
    const machineQuery = `
      SELECT mm.*, mc.name as category_name
      FROM machine_models mm
      LEFT JOIN machine_categories mc ON mm.category_id = mc.id
      WHERE mm.id = $1
    `;

    const machineResult = await db.query(machineQuery, [machineId]);
    if (machineResult.rows.length === 0) {
      console.error('Machine not found for notification:', machineId);
      return [];
    }

    const machine = machineResult.rows[0];
    const machineName = `${machine.manufacturer} ${machine.name}`;

    let titleKey, messageKey, messageParams;

    switch (action) {
      case 'created':
        titleKey = 'notifications.machineCreated';
        messageKey = 'notifications.machineCreatedMessage';
        messageParams = { name: machineName };
        break;

      case 'updated':
        titleKey = 'notifications.machineUpdated';
        messageKey = 'notifications.machineUpdatedMessage';
        messageParams = { name: machineName };
        break;

      case 'deleted':
        titleKey = 'notifications.machineDeleted';
        messageKey = 'notifications.machineDeletedMessage';
        messageParams = { name: machineName };
        break;

      default:
        console.warn('Unknown machine notification action:', action);
        return [];
    }

    return await createNotificationForEveryoneExcept(currentUserId, titleKey, messageKey, messageParams, 'machine', 'machine', machineId);
  } catch (error) {
    console.error('Error creating machine notification:', error);
    return [];
  }
}

/**
 * Create assigned machine notifications
 * @param {number} assignedMachineId - Assigned machine ID
 * @param {string} action - Action performed (created, updated, deleted)
 * @param {number} currentUserId - ID of the user who performed the action
 * @returns {Promise<Array>} Created notifications
 */
async function createAssignedMachineNotification(assignedMachineId, action, currentUserId) {
  try {
    const assignedMachineQuery = `
      SELECT am.*, c.name as customer_name, mm.name as machine_name, mm.manufacturer
      FROM assigned_machines am
      LEFT JOIN customers c ON am.customer_id = c.id
      LEFT JOIN machine_serials ms ON am.serial_id = ms.id
      LEFT JOIN machine_models mm ON ms.model_id = mm.id
      WHERE am.id = $1
    `;

    const assignedMachineResult = await db.query(assignedMachineQuery, [assignedMachineId]);
    if (assignedMachineResult.rows.length === 0) {
      console.error('Assigned machine not found for notification:', assignedMachineId);
      return [];
    }

    const assignedMachine = assignedMachineResult.rows[0];
    const machineName = `${assignedMachine.manufacturer} ${assignedMachine.machine_name}`;
    const customerName = assignedMachine.customer_name || 'Unknown Customer';

    let titleKey, messageKey, messageParams;

    switch (action) {
      case 'created':
        titleKey = 'notifications.assignedMachineCreated';
        messageKey = 'notifications.assignedMachineCreatedMessage';
        messageParams = { machine: machineName, customer: customerName };
        break;

      case 'updated':
        titleKey = 'notifications.assignedMachineUpdated';
        messageKey = 'notifications.assignedMachineUpdatedMessage';
        messageParams = { machine: machineName, customer: customerName };
        break;

      case 'deleted':
        titleKey = 'notifications.assignedMachineDeleted';
        messageKey = 'notifications.assignedMachineDeletedMessage';
        messageParams = { machine: machineName, customer: customerName };
        break;

      default:
        console.warn('Unknown assigned machine notification action:', action);
        return [];
    }

    return await createNotificationForEveryoneExcept(currentUserId, titleKey, messageKey, messageParams, 'machine', 'assigned_machine', assignedMachineId);
  } catch (error) {
    console.error('Error creating assigned machine notification:', error);
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
    const customerName = customer.name || customer.company_name || 'Unknown Customer';

    let titleKey, messageKey, messageParams;

    switch (action) {
      case 'created':
        titleKey = 'notifications.customerCreated';
        messageKey = 'notifications.customerCreatedMessage';
        messageParams = { name: customerName };
        break;

      case 'updated':
        titleKey = 'notifications.customerUpdated';
        messageKey = 'notifications.customerUpdatedMessage';
        messageParams = { name: customerName };
        break;

      case 'deleted':
        titleKey = 'notifications.customerDeleted';
        messageKey = 'notifications.customerDeletedMessage';
        messageParams = { name: customerName };
        break;

      default:
        console.warn('Unknown customer notification action:', action);
        return [];
    }

    return await createNotificationForEveryoneExcept(currentUserId, titleKey, messageKey, messageParams, 'customer', 'customer', customerId);
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
    const itemName = inventory.name || 'Unknown Item';

    let titleKey, messageKey, messageParams;

    switch (action) {
      case 'created':
        titleKey = 'notifications.inventoryCreated';
        messageKey = 'notifications.inventoryCreatedMessage';
        messageParams = { name: itemName };
        break;

      case 'updated':
        titleKey = 'notifications.inventoryUpdated';
        messageKey = 'notifications.inventoryUpdatedMessage';
        messageParams = { name: itemName };
        break;

      case 'deleted':
        titleKey = 'notifications.inventoryDeleted';
        messageKey = 'notifications.inventoryDeletedMessage';
        messageParams = { name: itemName };
        break;

      case 'low_stock':
        titleKey = 'notifications.inventoryLowStock';
        messageKey = 'notifications.inventoryLowStockMessage';
        messageParams = { name: itemName, quantity: inventory.quantity };
        break;

      default:
        console.warn('Unknown inventory notification action:', action);
        return [];
    }

    return await createNotificationForEveryoneExcept(currentUserId, titleKey, messageKey, messageParams, 'inventory', 'inventory', inventoryId);
  } catch (error) {
    console.error('Error creating inventory notification:', error);
    return [];
  }
}

/**
 * Create user assignment notifications
 * @param {number} userId - User ID being assigned
 * @param {string} action - Action performed (assigned_to_work_order, role_changed, etc.)
 * @param {Object} details - Additional details about the assignment
 * @returns {Promise<Array>} Created notifications
 */
async function createUserAssignmentNotification(userId, action, details = {}) {
  try {
    let titleKey, messageKey, messageParams, type = 'info';
    let notifications = [];

    switch (action) {
      case 'work_order_assigned':
        titleKey = 'notifications.workOrderAssignment';
        const formattedNumber = details.formattedNumber || `#${details.workOrderId}`;
        messageKey = 'notifications.workOrderAssignmentMessage';
        messageParams = { number: formattedNumber };
        type = 'work_order';
        notifications = await createNotification(userId, titleKey, messageKey, messageParams, type, 'work_order', details.workOrderId);
        break;
      
      case 'role_changed':
        titleKey = 'notifications.roleUpdated';
        messageKey = 'notifications.roleUpdatedMessage';
        messageParams = { role: details.newRole };
        type = 'info';
        notifications = await createNotification(userId, titleKey, messageKey, messageParams, type);
        break;
      
      case 'bulk_assigned':
        titleKey = 'notifications.multipleWorkOrdersAssigned';
        messageKey = 'notifications.multipleWorkOrdersAssignedMessage';
        messageParams = { count: details.count };
        type = 'work_order';
        notifications = await createNotification(userId, titleKey, messageKey, messageParams, type);
        break;
      
      default:
        throw new Error(`Unknown user assignment action: ${action}`);
    }

    return notifications;
  } catch (error) {
    console.error('Error creating user assignment notification:', error);
  }
}

/**
 * Create system notifications
 * @param {string} titleKey - Notification title translation key
 * @param {string} messageKey - Notification message translation key
 * @param {Object} messageParams - Parameters for message translation (optional)
 * @param {string} type - Notification type
 * @param {Array<number>} userIds - Specific user IDs to notify (optional, if not provided, notify all)
 * @returns {Promise<Array>} Created notifications
 */
async function createSystemNotification(titleKey, messageKey, messageParams = {}, type = 'info', userIds = null) {
  try {
    if (userIds) {
      return await createNotificationsForUsers(userIds, titleKey, messageKey, messageParams, type);
    } else {
      // Notify all users
      const result = await db.query('SELECT id FROM users');
      const allUserIds = result.rows.map(row => row.id);
      return await createNotificationsForUsers(allUserIds, titleKey, messageKey, messageParams, type);
    }
  } catch (error) {
    console.error('Error creating system notification:', error);
    throw error;
  }
}

/**
 * Helper to create notifications for everyone except a specific user.
 * @param {number} excludeUserId - The user ID to exclude from notifications.
 * @param {string} titleKey - Notification title translation key.
 * @param {string} messageKey - Notification message translation key.
 * @param {Object} messageParams - Parameters for message translation (optional).
 * @param {string} type - Notification type.
 * @param {string} relatedEntityType - Type of related entity (optional).
 * @param {number} relatedEntityId - ID of related entity (optional).
 * @returns {Promise<Array>} Created notifications for everyone except the excluded user.
 */
async function createNotificationForEveryoneExcept(excludeUserId, titleKey, messageKey, messageParams = {}, type = 'info', relatedEntityType = null, relatedEntityId = null) {
  try {
    const result = await db.query('SELECT id FROM users WHERE id != $1', [excludeUserId]);
    const userIdsToNotify = result.rows.map(row => row.id);
    return await createNotificationsForUsers(userIdsToNotify, titleKey, messageKey, messageParams, type, relatedEntityType, relatedEntityId);
  } catch (error) {
    console.error('Error creating notification for everyone except:', error);
    return [];
  }
}

module.exports = {
  createNotification,
  createNotificationsForUsers,
  createNotificationForManagers,
  createTicketNotification,
  createWorkOrderNotification,
  createMachineNotification,
  createAssignedMachineNotification,
  createCustomerNotification,
  createInventoryNotification,
  createUserAssignmentNotification,
  createSystemNotification,
};
