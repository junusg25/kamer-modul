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

// Middleware to update user's last_seen timestamp
async function updateLastSeen(req, res, next) {
  if (req.user && req.user.id) {
    try {
      // Update last_seen timestamp (non-blocking)
      db.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [req.user.id])
        .catch(err => console.error('Error updating last_seen:', err));
    } catch (err) {
      console.error('Error in updateLastSeen middleware:', err);
    }
  }
  next();
}

module.exports = { authenticateToken, authorizeRoles, authorizeAny, authorizeSelfOrRoles, updateLastSeen };