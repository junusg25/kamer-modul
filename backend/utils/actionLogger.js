const db = require('../db');
const logger = require('./logger');

/**
 * Log user action to database for audit trail
 * @param {Object} params - Action parameters
 * @param {number} params.userId - User ID performing the action
 * @param {string} params.userName - User name
 * @param {string} params.userRole - User role
 * @param {string} params.actionType - Type of action (create, update, delete, convert, assign, etc.)
 * @param {string} params.entityType - Type of entity (customer, work_order, machine, inventory, etc.)
 * @param {number} params.entityId - ID of the entity
 * @param {string} params.entityName - Name/description of the entity
 * @param {Object} params.actionDetails - Additional details (before/after values, etc.)
 * @param {string} params.ipAddress - IP address of the user
 * @param {string} params.userAgent - User agent string
 */
async function logUserAction({
  userId,
  userName,
  userRole,
  actionType,
  entityType,
  entityId = null,
  entityName = null,
  actionDetails = null,
  ipAddress = null,
  userAgent = null
}) {
  try {
    await db.query(
      `INSERT INTO user_action_logs 
       (user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [userId, userName, userRole, actionType, entityType, entityId, entityName, actionDetails, ipAddress, userAgent]
    );
    
    logger.info('User action logged', {
      userId,
      userName,
      actionType,
      entityType,
      entityId,
      entityName
    });
  } catch (error) {
    // Don't fail the request if logging fails
    logger.error('Failed to log user action', {
      error: error.message,
      userId,
      actionType,
      entityType
    });
  }
}

/**
 * Express middleware to automatically log actions
 * Usage: router.post('/', logAction('create', 'customer'), async (req, res) => { ... })
 */
function logAction(actionType, entityType, getEntityInfo = null) {
  return async (req, res, next) => {
    // Store original res.json to intercept successful responses
    const originalJson = res.json.bind(res);
    
    res.json = function(body) {
      // Only log if the request was successful
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        // Get entity info from response or custom function
        let entityId = null;
        let entityName = null;
        
        if (getEntityInfo && typeof getEntityInfo === 'function') {
          const info = getEntityInfo(req, body);
          entityId = info.entityId;
          entityName = info.entityName;
        } else if (body.data) {
          entityId = body.data.id || req.params.id;
          entityName = body.data.name || body.data.description || body.data.formatted_number;
        } else {
          entityId = req.params.id;
        }
        
        // Get action details based on action type
        let actionDetails = {};
        if (actionType === 'update' && req.body) {
          actionDetails = {
            updated_fields: Object.keys(req.body),
            changes: req.body
          };
        } else if (actionType === 'delete') {
          actionDetails = {
            deleted_id: entityId
          };
        } else if (actionType === 'create' && body.data) {
          actionDetails = {
            created_data: body.data
          };
        }
        
        // Log the action (non-blocking)
        logUserAction({
          userId: req.user.id,
          userName: req.user.name,
          userRole: req.user.role,
          actionType,
          entityType,
          entityId,
          entityName,
          actionDetails,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent')
        }).catch(err => {
          logger.error('Action logging failed', { error: err.message });
        });
      }
      
      return originalJson(body);
    };
    
    next();
  };
}

/**
 * Log action with custom details
 */
async function logCustomAction(req, actionType, entityType, entityId, entityName, details = {}) {
  if (!req.user) return;
  
  return logUserAction({
    userId: req.user.id,
    userName: req.user.name,
    userRole: req.user.role,
    actionType,
    entityType,
    entityId,
    entityName,
    actionDetails: details,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')
  });
}

module.exports = {
  logUserAction,
  logAction,
  logCustomAction
};
