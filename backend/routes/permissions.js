const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// All permission routes are admin-only
router.use(authenticateToken);

// GET /api/permissions/available - Get all available permissions
router.get('/available', authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    // This returns the permission structure from the permissions.ts file
    // In a real-world scenario, this would be stored in the database
    const permissions = {
      'work_orders': {
        'work_orders:read': { description: 'View work orders', defaultRoles: ['admin', 'manager', 'technician', 'sales'] },
        'work_orders:write': { description: 'Create and edit work orders', defaultRoles: ['admin', 'manager', 'technician'] },
        'work_orders:delete': { description: 'Delete work orders', defaultRoles: ['admin', 'manager', 'technician'] }
      },
      'repair_tickets': {
        'repair_tickets:read': { description: 'View repair tickets', defaultRoles: ['admin', 'manager', 'technician', 'sales'] },
        'repair_tickets:write': { description: 'Create and edit repair tickets', defaultRoles: ['admin', 'manager', 'technician'] },
        'repair_tickets:delete': { description: 'Delete repair tickets', defaultRoles: ['admin', 'manager', 'technician'] }
      },
      'inventory': {
        'inventory:read': { description: 'View inventory', defaultRoles: ['admin', 'manager', 'technician', 'sales'] },
        'inventory:write': { description: 'Create and edit inventory', defaultRoles: ['admin', 'manager', 'technician', 'sales'] },
        'inventory:delete': { description: 'Delete inventory', defaultRoles: ['admin', 'manager', 'technician', 'sales'] }
      },
      'customers': {
        'customers:read': { description: 'View customers', defaultRoles: ['admin', 'manager', 'technician', 'sales'] },
        'customers:write': { description: 'Create and edit customers', defaultRoles: ['admin', 'manager', 'technician', 'sales'] },
        'customers:delete': { description: 'Delete customers', defaultRoles: ['admin', 'manager', 'technician', 'sales'] }
      },
      'machines': {
        'machines:read': { description: 'View machines', defaultRoles: ['admin', 'manager', 'technician', 'sales'] },
        'machines:write': { description: 'Create and edit machines', defaultRoles: ['admin', 'manager', 'sales'] },
        'machines:assign': { description: 'Assign machines to customers', defaultRoles: ['admin', 'manager', 'sales'] }
      },
      'reports': {
        'reports:read': { description: 'View reports', defaultRoles: ['admin', 'manager', 'technician', 'sales'] },
        'analytics:read': { description: 'View analytics', defaultRoles: ['admin', 'manager', 'technician', 'sales'] }
      },
      'sales': {
        'pipeline:read': { description: 'View sales pipeline', defaultRoles: ['admin', 'manager', 'sales'] },
        'pipeline:write': { description: 'Manage sales pipeline', defaultRoles: ['admin', 'manager', 'sales'] },
        'pipeline:delete': { description: 'Delete pipeline items', defaultRoles: ['admin', 'manager', 'sales'] },
        'quotes:read': { description: 'View quotes', defaultRoles: ['admin', 'manager', 'sales'] },
        'quotes:write': { description: 'Create and edit quotes', defaultRoles: ['admin', 'manager', 'sales'] },
        'quotes:delete': { description: 'Delete quotes', defaultRoles: ['admin', 'manager', 'sales'] },
        'sales_reports:read': { description: 'View sales reports', defaultRoles: ['admin', 'manager', 'sales'] },
        'sales_reports:write': { description: 'Manage sales reports', defaultRoles: ['admin', 'manager', 'sales'] },
        'sales_reports:delete': { description: 'Delete sales reports', defaultRoles: ['admin', 'manager', 'sales'] },
        'sales_targets:read': { description: 'View sales targets', defaultRoles: ['admin', 'manager'] },
        'sales_targets:write': { description: 'Manage sales targets', defaultRoles: ['admin', 'manager'] }
      },
      'admin': {
        'users:read': { description: 'View users', defaultRoles: ['admin', 'manager'] },
        'users:write': { description: 'Create and edit users', defaultRoles: ['admin'] },
        'users:delete': { description: 'Delete users', defaultRoles: ['admin'] },
        'settings:read': { description: 'View settings', defaultRoles: ['admin', 'manager'] },
        'settings:write': { description: 'Manage settings', defaultRoles: ['admin'] },
        'permissions:manage': { description: 'Manage user permissions', defaultRoles: ['admin'] }
      }
    };

    res.json({
      status: 'success',
      data: permissions
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/permissions/user/:userId - Get all permissions for a specific user
// Users can fetch their own permissions, admins can fetch anyone's
router.get('/user/:userId', authenticateToken, [
  param('userId').isInt().withMessage('Valid user ID is required')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;

    // Check if user is requesting their own permissions or is an admin
    if (parseInt(userId) !== requestingUserId && requestingUserRole !== 'admin') {
      return res.status(403).json({
        status: 'fail',
        message: 'You can only view your own permissions'
      });
    }

    // Get user's role-based permissions
    const userQuery = 'SELECT id, name, email, role FROM users WHERE id = $1';
    const userResult = await db.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Get user-specific permission overrides
    const permissionsQuery = `
      SELECT 
        up.id,
        up.permission_key,
        up.granted,
        up.granted_at,
        up.expires_at,
        up.reason,
        u.name as granted_by_name
      FROM user_permissions up
      LEFT JOIN users u ON up.granted_by = u.id
      WHERE up.user_id = $1
      ORDER BY up.granted_at DESC
    `;
    const permissionsResult = await db.query(permissionsQuery, [userId]);

    res.json({
      status: 'success',
      data: {
        user,
        overrides: permissionsResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/permissions/audit/:userId - Get permission audit log for a user
router.get('/audit/:userId', authorizeRoles('admin'), [
  param('userId').isInt().withMessage('Valid user ID is required')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const auditQuery = `
      SELECT 
        upa.id,
        upa.permission_key,
        upa.action,
        upa.granted,
        upa.performed_at,
        upa.reason,
        u.name as performed_by_name
      FROM user_permissions_audit upa
      LEFT JOIN users u ON upa.performed_by = u.id
      WHERE upa.user_id = $1
      ORDER BY upa.performed_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(auditQuery, [userId, limit, offset]);

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/permissions/grant - Grant a permission to a user
router.post('/grant', authorizeRoles('admin'), [
  body('user_id').isInt().withMessage('Valid user ID is required'),
  body('permission_key').matches(/^[a-z_]+:[a-z_]+$/).withMessage('Valid permission key is required'),
  body('expires_at').optional({ nullable: true }).isISO8601().withMessage('Valid expiry date is required'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { user_id, permission_key, expires_at, reason } = req.body;
    const granted_by = req.user.id;

    // Check if user exists
    const userCheck = await db.query('SELECT id, role FROM users WHERE id = $1', [user_id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Insert or update permission
    const query = `
      INSERT INTO user_permissions (user_id, permission_key, granted, granted_by, expires_at, reason)
      VALUES ($1, $2, true, $3, $4, $5)
      ON CONFLICT (user_id, permission_key) 
      DO UPDATE SET 
        granted = true,
        granted_by = $3,
        granted_at = CURRENT_TIMESTAMP,
        expires_at = $4,
        reason = $5
      RETURNING *
    `;

    const result = await db.query(query, [user_id, permission_key, granted_by, expires_at, reason]);

    res.status(201).json({
      status: 'success',
      message: 'Permission granted successfully',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/permissions/revoke - Revoke a permission from a user
router.post('/revoke', authorizeRoles('admin'), [
  body('user_id').isInt().withMessage('Valid user ID is required'),
  body('permission_key').matches(/^[a-z_]+:[a-z_]+$/).withMessage('Valid permission key is required'),
  body('reason').optional().isString().withMessage('Reason must be a string')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { user_id, permission_key, reason } = req.body;

    // Delete the permission (trigger will log to audit)
    const query = `
      DELETE FROM user_permissions 
      WHERE user_id = $1 AND permission_key = $2
      RETURNING *
    `;

    const result = await db.query(query, [user_id, permission_key]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Permission override not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Permission revoked successfully'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/permissions/users-with-overrides - Get all users who have permission overrides
router.get('/users-with-overrides', authorizeRoles('admin'), async (req, res, next) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        COUNT(up.id) as override_count,
        json_agg(
          json_build_object(
            'permission_key', up.permission_key,
            'granted', up.granted,
            'granted_at', up.granted_at,
            'expires_at', up.expires_at
          )
        ) as overrides
      FROM users u
      INNER JOIN user_permissions up ON u.id = up.user_id
      GROUP BY u.id, u.name, u.email, u.role
      ORDER BY u.name
    `;

    const result = await db.query(query);

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/permissions/:permissionId - Delete a specific permission override
router.delete('/:permissionId', authorizeRoles('admin'), [
  param('permissionId').isInt().withMessage('Valid permission ID is required')
], handleValidationErrors, async (req, res, next) => {
  try {
    const { permissionId } = req.params;

    const query = 'DELETE FROM user_permissions WHERE id = $1 RETURNING *';
    const result = await db.query(query, [permissionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Permission not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Permission deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

