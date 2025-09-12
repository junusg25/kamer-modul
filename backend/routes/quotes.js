const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// GET all quotes
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { status, search, limit = 50, offset = 0 } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramCount = 0;

    if (status && status !== 'all') {
      paramCount++;
      whereClause += ` AND q.status = $${paramCount}`;
      params.push(status);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (q.title ILIKE $${paramCount} OR q.customer_name ILIKE $${paramCount} OR q.quote_number::text ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    const query = `
      SELECT 
        q.*,
        u.name as created_by_name,
        COUNT(*) OVER() as total_count
      FROM quotes q
      LEFT JOIN users u ON q.created_by = u.id
      ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    params.push(limit, offset);
    const result = await db.query(query, params);
    
    res.json({
      status: 'success',
      data: result.rows,
      pagination: {
        total: result.rows[0]?.total_count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET quote statistics
router.get('/stats', authenticateToken, async (req, res, next) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_quotes,
        COALESCE(SUM(total_amount), 0) as total_value,
        ROUND(
          (CASE 
            WHEN COUNT(*) > 0 THEN 
              (COUNT(CASE WHEN status = 'accepted' THEN 1 END)::FLOAT / COUNT(*)::FLOAT * 100)
            ELSE 0 
          END)::NUMERIC, 2
        ) as acceptance_rate,
        ROUND(
          (CASE 
            WHEN COUNT(*) > 0 THEN 
              (COUNT(CASE WHEN status = 'converted' THEN 1 END)::FLOAT / COUNT(*)::FLOAT * 100)
            ELSE 0 
          END)::NUMERIC, 2
        ) as conversion_rate
      FROM quotes
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;

    const result = await db.query(statsQuery);
    const stats = result.rows[0];

    res.json({
      status: 'success',
      data: {
        totalQuotes: parseInt(stats.total_quotes),
        totalValue: parseFloat(stats.total_value),
        acceptanceRate: parseFloat(stats.acceptance_rate),
        conversionRate: parseFloat(stats.conversion_rate)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET single quote
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        q.*,
        u.name as created_by_name,
        c.name as customer_name_from_db,
        c.email as customer_email_from_db,
        c.phone as customer_phone_from_db
      FROM quotes q
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Quote not found'
      });
    }

    // Get quote items
    const itemsQuery = `
      SELECT * FROM quote_items 
      WHERE quote_id = $1 
      ORDER BY position ASC
    `;
    
    const itemsResult = await db.query(itemsQuery, [id]);
    
    const quote = {
      ...result.rows[0],
      items: itemsResult.rows
    };

    res.json({
      status: 'success',
      data: quote
    });
  } catch (err) {
    next(err);
  }
});

// POST create new quote
router.post('/', 
  authenticateToken,
  [
    body('customer_name').notEmpty().withMessage('Customer name is required'),
    body('title').notEmpty().withMessage('Quote title is required'),
    body('valid_until').isISO8601().withMessage('Valid until date is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.description').notEmpty().withMessage('Item description is required'),
    body('items.*.quantity').isFloat({ min: 0 }).withMessage('Item quantity must be a positive number'),
    body('items.*.unit_price').isFloat({ min: 0 }).withMessage('Item unit price must be a positive number'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        customer_id,
        customer_name,
        customer_email,
        customer_phone,
        title,
        description,
        items,
        subtotal,
        tax_rate,
        tax_amount,
        discount_amount,
        total_amount,
        valid_until,
        notes,
        terms_conditions
      } = req.body;

      // Generate quote number
      const quoteNumberResult = await db.query(
        'SELECT COALESCE(MAX(quote_number), 0) + 1 as next_number FROM quotes'
      );
      const quoteNumber = quoteNumberResult.rows[0].next_number;

      // Insert quote
      const quoteQuery = `
        INSERT INTO quotes (
          quote_number, customer_id, customer_name, customer_email, customer_phone,
          title, description, subtotal, tax_rate, tax_amount, discount_amount, 
          total_amount, valid_until, notes, terms_conditions, status, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) RETURNING *
      `;

      const quoteResult = await db.query(quoteQuery, [
        quoteNumber,
        customer_id || null,
        customer_name,
        customer_email || null,
        customer_phone || null,
        title,
        description || null,
        subtotal || 0,
        tax_rate || 0,
        tax_amount || 0,
        discount_amount || 0,
        total_amount || 0,
        valid_until,
        notes || null,
        terms_conditions || null,
        'draft',
        req.user.id
      ]);

      const quote = quoteResult.rows[0];

      // Insert quote items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await db.query(
          `INSERT INTO quote_items (quote_id, description, quantity, unit_price, total, position)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            quote.id,
            item.description,
            item.quantity,
            item.unit_price,
            item.quantity * item.unit_price,
            i
          ]
        );
      }

      res.status(201).json({
        status: 'success',
        data: quote
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH update quote
router.patch('/:id',
  authenticateToken,
  [
    body('customer_name').optional().notEmpty().withMessage('Customer name cannot be empty'),
    body('title').optional().notEmpty().withMessage('Quote title cannot be empty'),
    body('valid_until').optional().isISO8601().withMessage('Valid until must be a valid date'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const updates = req.body;

      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramCount = 0;

      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined && key !== 'items') {
          paramCount++;
          updateFields.push(`${key} = $${paramCount}`);
          values.push(updates[key]);
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'No fields to update'
        });
      }

      paramCount++;
      values.push(id);

      const query = `
        UPDATE quotes 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'fail',
          message: 'Quote not found'
        });
      }

      // Update items if provided
      if (updates.items) {
        // Delete existing items
        await db.query('DELETE FROM quote_items WHERE quote_id = $1', [id]);

        // Insert new items
        for (let i = 0; i < updates.items.length; i++) {
          const item = updates.items[i];
          await db.query(
            `INSERT INTO quote_items (quote_id, description, quantity, unit_price, total, position)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              id,
              item.description,
              item.quantity,
              item.unit_price,
              item.quantity * item.unit_price,
              i
            ]
          );
        }
      }

      res.json({
        status: 'success',
        data: result.rows[0]
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH update quote status
router.patch('/:id/status',
  authenticateToken,
  [
    body('status').isIn(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted']).withMessage('Invalid status'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { status } = req.body;

      const query = `
        UPDATE quotes 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await db.query(query, [status, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'fail',
          message: 'Quote not found'
        });
      }

      res.json({
        status: 'success',
        data: result.rows[0]
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST send quote
router.post('/:id/send', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Update status to sent
    const updateQuery = `
      UPDATE quotes 
      SET status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(updateQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Quote not found'
      });
    }

    // Here you would typically integrate with an email service
    // For now, we'll just return success
    res.json({
      status: 'success',
      message: 'Quote sent successfully',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// GET quote PDF
router.get('/:id/pdf', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Here you would typically generate a PDF using a library like puppeteer or jsPDF
    // For now, we'll return a placeholder response
    res.json({
      status: 'success',
      message: 'PDF generation would be implemented here',
      pdf_url: `/quotes/${id}/download.pdf`
    });
  } catch (err) {
    next(err);
  }
});

// DELETE quote
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Delete quote items first (cascade should handle this, but being explicit)
    await db.query('DELETE FROM quote_items WHERE quote_id = $1', [id]);

    // Delete quote
    const result = await db.query('DELETE FROM quotes WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Quote not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Quote deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
