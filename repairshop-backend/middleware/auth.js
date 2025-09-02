const jwt = require('jsonwebtoken');

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
    if (!req.user || !roles.includes(req.user.role)) {
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

module.exports = { authenticateToken, authorizeRoles, authorizeAny, authorizeSelfOrRoles };