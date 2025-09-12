const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const { authenticateToken } = require('../middleware/auth');
const { generateTokens, verifyRefreshToken } = require('../utils/generateTokens');

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

    // Handle both plain text and bcrypt hashed passwords
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

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Update last login and clear last_logout (user is now logged in)
    await db.query('UPDATE users SET last_login = NOW(), last_logout = NULL WHERE id = $1', [user.id]);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token in database
    await db.query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [refreshToken, user.id]
    );

    // Return user data without password
    const { password: _, refresh_token: __, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token: accessToken,
      refreshToken: refreshToken
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      error: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    
    // Verify refresh token exists in database
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1 AND refresh_token = $2',
      [decoded.userId, refreshToken]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const user = userResult.rows[0];
    
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive' });
    }
    
    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    
    // Update refresh token in database
    await db.query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [newRefreshToken, user.id]
    );
    
    res.json({
      token: accessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Logout user
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Clear the refresh token and set last_logout timestamp on logout
    await db.query(
      'UPDATE users SET refresh_token = NULL, last_logout = NOW() WHERE id = $1',
      [req.user.id]
    );
    
    // Emit WebSocket disconnect event to immediately update user status
    const websocketService = require('../services/websocketService');
    const wsInstance = websocketService.getInstance();
    
    // Emit to all admins that user went offline
    wsInstance.emitToAdmins('user_activity_update', {
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      status: 'offline',
      timestamp: new Date().toISOString()
    });
    
    // Remove user from WebSocket memory
    wsInstance.userStatuses.delete(req.user.id);
    
    res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ 
      error: 'Logout failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, phone, department, status, last_login, created_at, updated_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get current user error:', err);
    res.status(500).json({ 
      error: 'Failed to get user data',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;
