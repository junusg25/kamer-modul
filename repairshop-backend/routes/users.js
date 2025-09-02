const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { generateTokens, verifyRefreshToken } = require('../utils/generateTokens');
const { createUserAssignmentNotification } = require('../utils/notificationHelpers');
const websocketService = require('../services/websocketService');

// Password reset
router.post('/reset-password', async (req, res) => {
  const { user_id, new_password } = req.body;

  if (!user_id || !new_password) {
    return res.status(400).json({ error: 'user_id and new_password are required.' });
  }

  try {
    const hashed = await bcrypt.hash(new_password, 12); // Increased salt rounds
    await db.query(
      'UPDATE users SET password = $1, requires_password_reset = FALSE WHERE id = $2 RETURNING id, name, email, role',
      [hashed, user_id]
    );
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ 
      error: 'Failed to reset password',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.password === 'temporary_password') {
      return res.status(403).json({
        error: 'Password reset required',
        requires_reset: true,
        user_id: user.id
      });
    }

    // Temporary fix: Handle both plain text and bcrypt hashed passwords
    let isMatch = false;
    
    // First try plain text comparison (for testing)
    if (user.password === password) {
      isMatch = true;
    } else {
      // Then try bcrypt comparison (for production)
      try {
        isMatch = await bcrypt.compare(password, user.password);
      } catch (bcryptError) {
        console.log('Bcrypt comparison failed, trying plain text');
        isMatch = (user.password === password);
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    
    // Store refresh token and update last login in database
    await db.query(
      'UPDATE users SET refresh_token = $1, last_login = CURRENT_TIMESTAMP WHERE id = $2',
      [refreshToken, user.id]
    );

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      accessToken,
      refreshToken
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      error: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  try {
    // Verify the refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    // Check if token exists in database (optional security measure)
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1 AND refresh_token = $2',
      [decoded.id, refreshToken]
    );
    
    if (!userResult.rows[0]) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const user = userResult.rows[0];
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    
    // Update the refresh token in DB
    await db.query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [newRefreshToken, user.id]
    );

    res.json({ 
      accessToken,
      refreshToken: newRefreshToken
    });

  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Clear the refresh token from database
    await db.query(
      'UPDATE users SET refresh_token = NULL WHERE id = $1',
      [req.user.id]
    );
    res.json({ message: 'Successfully logged out' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET all users (admin only)
router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, name, email, role, phone, department, status, last_login, created_at, updated_at FROM users');
    res.json({ status: 'success', data: result.rows });
  } catch (err) { next(err); }
});

// GET all technicians (any authenticated user)
router.get('/technicians', authenticateToken, async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, name, email, phone, department FROM users WHERE role = $1 AND status = $2 ORDER BY name', ['technician', 'active']);
    res.json({ status: 'success', data: result.rows });
  } catch (err) { next(err); }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, phone, department, status, last_login, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// GET user by id
router.get('/:id', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT id, name, email, role, phone, department, status, last_login, created_at, updated_at FROM users WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'User not found' });
    res.json({ status: 'success', data: result.rows[0] });
  } catch (err) { next(err); }
});

// PATCH update user (admin only)
router.patch('/:id', 
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone format'),
    body('department').optional(),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status'),
    body('role').optional().isIn(['admin', 'manager', 'technician']).withMessage('Invalid role')
  ],
  authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  const { id } = req.params;
  const { name, email, role, phone, department, status } = req.body;
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      status: 'fail', 
      message: errors.array().map(err => `${err.param}: ${err.msg}`).join(', ')
    });
  }
  
  try {
          const result = await db.query(
        `UPDATE users SET
          name = COALESCE($1, name),
          email = COALESCE($2, email),
          role = COALESCE($3, role),
          phone = COALESCE($4, phone),
          department = COALESCE($5, department),
          status = COALESCE($6, status),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING id, name, email, role, phone, department, status, last_login, created_at, updated_at`,
        [name, email, role, phone, department, status, id]
      );
    if (!result.rows.length) return res.status(404).json({ status: 'fail', message: 'User not found' });
    
    const updatedUser = result.rows[0];

    // Create notification for user update
    try {
      await createUserAssignmentNotification(updatedUser.id, 'user_updated', {
        userName: updatedUser.name,
        userRole: updatedUser.role
      });
      
      // Emit real-time WebSocket update
      await websocketService.emitUserUpdate(updatedUser.id, 'updated', {
        updatedBy: req.user?.id
      });
    } catch (notificationError) {
      console.error('Error creating user notification:', notificationError);
      // Don't fail the request if notification fails
    }
    
    res.json({ status: 'success', data: updatedUser });
  } catch (err) { next(err); }
});

// POST register (admin only)
router.post('/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('phone').optional().isMobilePhone().withMessage('Invalid phone format'),
    body('department').optional(),
    body('role').optional().isIn(['admin', 'manager', 'technician']).withMessage('Invalid role')
  ],
  authenticateToken,
  authorizeRoles('admin'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        status: 'fail', 
        message: errors.array().map(err => `${err.param}: ${err.msg}`).join(', ')
      });
    }
    try {
      const { name, email, password, role, phone, department } = req.body;
      const hashed = await bcrypt.hash(password, 12);
      const result = await db.query(
        'INSERT INTO users (name, email, password, role, phone, department) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, phone, department, status, created_at, updated_at',
        [name, email, hashed, role || 'technician', phone, department]
      );
      
      const newUser = result.rows[0];

      // Create notification for new user
      try {
        await createUserAssignmentNotification(newUser.id, 'user_created', {
          userName: newUser.name,
          userRole: newUser.role
        });
        
        // Emit real-time WebSocket update
        await websocketService.emitUserUpdate(newUser.id, 'created', {
          createdBy: req.user?.id
        });
      } catch (notificationError) {
        console.error('Error creating user notification:', notificationError);
        // Don't fail the request if notification fails
      }
      
      res.status(201).json(newUser);
    } catch (err) { 
      if (err.code === '23505') { // Unique constraint violation
        return res.status(400).json({ status: 'fail', message: 'Email already exists' });
      }
      next(err); 
    }
  }
);

module.exports = router;