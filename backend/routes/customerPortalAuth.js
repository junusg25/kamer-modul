const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { logAction } = require('../utils/actionLogger');

// Generate JWT token for customer portal
const generateCustomerToken = (user) => {
  return jwt.sign(
    { 
      id: user.id,
      customerId: user.customer_id,
      email: user.email,
      type: 'customer_portal'
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// Middleware to authenticate customer portal users
const authenticateCustomer = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        status: 'fail',
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (decoded.type !== 'customer_portal') {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid token type'
      });
    }

    req.customerUser = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid token'
    });
  }
};

// Register new customer portal account
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, customer_id } = req.body;

    // Validation
    if (!email || !password || !customer_id) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email, password, and customer ID are required'
      });
    }

    // Check if customer exists
    const customerResult = await db.query(
      'SELECT id, name, email as customer_email FROM customers WHERE id = $1',
      [customer_id]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Customer not found'
      });
    }

    // Check if email already registered
    const existingUser = await db.query(
      'SELECT id FROM customer_portal_users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email already registered'
      });
    }

    // Check if customer already has a portal account
    const existingCustomerAccount = await db.query(
      'SELECT id FROM customer_portal_users WHERE customer_id = $1',
      [customer_id]
    );

    if (existingCustomerAccount.rows.length > 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'This customer already has a portal account'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate verification token
    const verificationToken = require('crypto').randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create portal user
    const result = await db.query(
      `INSERT INTO customer_portal_users 
       (customer_id, email, password_hash, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, customer_id, email, is_verified, created_at`,
      [customer_id, email.toLowerCase(), passwordHash, verificationToken, verificationExpires]
    );

    const newUser = result.rows[0];

    // Log activity
    await db.query(
      `INSERT INTO customer_portal_activity 
       (customer_id, portal_user_id, action, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        customer_id,
        newUser.id,
        'register',
        req.ip,
        req.get('user-agent')
      ]
    );

    // TODO: Send verification email with verificationToken
    // For now, we'll auto-verify for development
    await db.query(
      'UPDATE customer_portal_users SET is_verified = true WHERE id = $1',
      [newUser.id]
    );

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully',
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          customer_id: newUser.customer_id,
          is_verified: true
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Login to customer portal
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email and password are required'
      });
    }

    // Find user
    const result = await db.query(
      `SELECT 
        cpu.id, cpu.customer_id, cpu.email, cpu.password_hash, 
        cpu.is_verified, cpu.is_active,
        c.name as customer_name, c.company_name
       FROM customer_portal_users cpu
       JOIN customers c ON cpu.customer_id = c.id
       WHERE cpu.email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        status: 'fail',
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Check if email is verified
    if (!user.is_verified) {
      return res.status(403).json({
        status: 'fail',
        message: 'Please verify your email before logging in'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await db.query(
      'UPDATE customer_portal_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Log activity
    await db.query(
      `INSERT INTO customer_portal_activity 
       (customer_id, portal_user_id, action, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.customer_id,
        user.id,
        'login',
        req.ip,
        req.get('user-agent')
      ]
    );

    // Generate token
    const token = generateCustomerToken(user);

    res.json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          customer_id: user.customer_id,
          customer_name: user.customer_name,
          company_name: user.company_name
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get current user info
router.get('/me', authenticateCustomer, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT 
        cpu.id, cpu.customer_id, cpu.email, cpu.is_verified, 
        cpu.is_active, cpu.last_login, cpu.created_at,
        c.name as customer_name, c.company_name, c.phone, 
        c.street_address, c.city, c.postal_code
       FROM customer_portal_users cpu
       JOIN customers c ON cpu.customer_id = c.id
       WHERE cpu.id = $1`,
      [req.customerUser.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      data: { user: result.rows[0] }
    });
  } catch (error) {
    next(error);
  }
});

// Change password
router.post('/change-password', authenticateCustomer, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    // Validation
    if (!current_password || !new_password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Current password and new password are required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        status: 'fail',
        message: 'Password must be at least 6 characters long'
      });
    }

    // Get current password hash
    const result = await db.query(
      'SELECT password_hash FROM customer_portal_users WHERE id = $1',
      [req.customerUser.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(current_password, result.rows[0].password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'fail',
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await db.query(
      'UPDATE customer_portal_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, req.customerUser.id]
    );

    // Log activity
    await db.query(
      `INSERT INTO customer_portal_activity 
       (customer_id, portal_user_id, action, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.customerUser.customerId,
        req.customerUser.id,
        'change_password',
        req.ip,
        req.get('user-agent')
      ]
    );

    res.json({
      status: 'success',
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.authenticateCustomer = authenticateCustomer;

