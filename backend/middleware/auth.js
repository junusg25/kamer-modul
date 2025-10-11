const jwt = require('jsonwebtoken');
const db = require('../db');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'fail', message: 'Authentication required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ status: 'fail', message: 'Invalid or expired token' });
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    console.log('Authorization check - User:', req.user, 'Required roles:', roles);
    if (!req.user || !roles.includes(req.user.role)) {
      console.log('Authorization failed - User role:', req.user?.role, 'Required roles:', roles);
      return res.status(403).json({ status: 'fail', message: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}

function authorizeAny(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ status: 'fail', message: 'Authentication required' });
    if (!roles.length || roles.includes(req.user.role)) return next();
    return res.status(403).json({ status: 'fail', message: 'Forbidden' });
  }
}

function authorizeSelfOrRoles(selfField, ...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ status: 'fail', message: 'Authentication required' });
    if (roles.includes(req.user.role)) return next();
    if (req.params[selfField] && String(req.user.id) === String(req.params[selfField])) return next();
    return res.status(403).json({ status: 'fail', message: 'Forbidden' });
  }
}

// Middleware to check permission with user-specific overrides
function authorizePermission(permissionKey) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'fail', message: 'Authentication required' });
    }

    try {
      // First, check if user has a specific permission override
      const overrideQuery = `
        SELECT granted 
        FROM user_permissions 
        WHERE user_id = $1 
          AND permission_key = $2 
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `;
      
      const overrideResult = await db.query(overrideQuery, [req.user.id, permissionKey]);
      
      // If there's an override, use that
      if (overrideResult.rows.length > 0) {
        if (overrideResult.rows[0].granted) {
          return next();
        } else {
          return res.status(403).json({ 
            status: 'fail', 
            message: 'Forbidden: permission explicitly denied' 
          });
        }
      }

      // If no override, check role-based permissions
      // This is a simplified version - ideally you'd have a permissions mapping
      const rolePermissions = {
        'admin': ['*'], // Admin has all permissions
        'manager': [
          'work_orders:read', 'work_orders:write', 'work_orders:delete',
          'repair_tickets:read', 'repair_tickets:write', 'repair_tickets:delete',
          'inventory:read', 'inventory:write', 'inventory:delete',
          'customers:read', 'customers:write', 'customers:delete',
          'machines:read', 'machines:write', 'machines:assign',
          'reports:read', 'analytics:read',
          'pipeline:read', 'pipeline:write', 'pipeline:delete',
          'quotes:read', 'quotes:write', 'quotes:delete',
          'sales_reports:read', 'sales_reports:write', 'sales_reports:delete',
          'sales_targets:read', 'sales_targets:write',
          'users:read', 'settings:read'
        ],
        'technician': [
          'work_orders:read', 'work_orders:write', 'work_orders:delete',
          'repair_tickets:read', 'repair_tickets:write', 'repair_tickets:delete',
          'inventory:read', 'inventory:write', 'inventory:delete',
          'customers:read', 'customers:write', 'customers:delete',
          'machines:read',
          'reports:read', 'analytics:read'
        ],
        'sales': [
          'work_orders:read',
          'repair_tickets:read',
          'inventory:read', 'inventory:write', 'inventory:delete',
          'customers:read', 'customers:write', 'customers:delete',
          'machines:read', 'machines:write', 'machines:assign',
          'reports:read', 'analytics:read',
          'pipeline:read', 'pipeline:write', 'pipeline:delete',
          'quotes:read', 'quotes:write', 'quotes:delete',
          'sales_reports:read', 'sales_reports:write', 'sales_reports:delete'
          // NOTE: sales_targets:read can be granted via user_permissions table
        ]
      };

      const userRole = req.user.role;
      const userPermissions = rolePermissions[userRole] || [];

      if (userPermissions.includes('*') || userPermissions.includes(permissionKey)) {
        return next();
      }

      return res.status(403).json({ 
        status: 'fail', 
        message: 'Forbidden: insufficient permissions' 
      });
    } catch (err) {
      console.error('Error checking permissions:', err);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Error checking permissions' 
      });
    }
  };
}

// Middleware to update user's last_seen timestamp and track actions
async function updateLastSeen(req, res, next) {
  if (req.user && req.user.id) {
    try {
      // Update last_seen timestamp (non-blocking)
      db.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [req.user.id])
        .catch(err => console.error('Error updating last_seen:', err));
      
      // Track user action in WebSocket service (for real-time admin dashboard)
      try {
        const websocketService = require('../services/websocketService');
        const wsInstance = websocketService.getInstance();
        wsInstance.trackUserAction(req.user.id);
      } catch (wsErr) {
        // Don't fail if WebSocket tracking fails
        console.debug('WebSocket action tracking skipped:', wsErr.message);
      }
    } catch (err) {
      console.error('Error in updateLastSeen middleware:', err);
    }
  }
  next();
}

module.exports = { 
  authenticateToken, 
  authorizeRoles, 
  authorizeAny, 
  authorizeSelfOrRoles, 
  authorizePermission,
  updateLastSeen 
};