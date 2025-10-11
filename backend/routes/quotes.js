const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { logCustomAction } = require('../utils/actionLogger');
const PDFService = require('../services/pdfService');
const fs = require('fs');
const path = require('path');

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

// ============================================
// QUOTE TEMPLATES ROUTES (must come before /:id)
// ============================================
// (Templates routes are defined below)

// ============================================
// CATALOG INTEGRATION ROUTES (must come before /:id)
// ============================================
// (Catalog routes are defined below)

// ============================================
// SPECIFIC QUOTE ROUTES WITH PARAMETERS
// ============================================
// Note: GET /:id is moved to after all specific routes

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

      const quote = result.rows[0];

      // Log action
      await logCustomAction(req, 'update', 'quote', id, `Quote #${quote.quote_number} - ${quote.customer_name}`, {
        updated_fields: Object.keys(updates).filter(k => k !== 'items'),
        items_updated: !!updates.items,
        status: quote.status
      });

      res.json({
        status: 'success',
        data: quote
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

// DELETE quote
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get quote details before deletion
    const quoteResult = await db.query('SELECT * FROM quotes WHERE id = $1', [id]);
    if (quoteResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Quote not found'
      });
    }
    const quote = quoteResult.rows[0];

    // Log action before deletion
    await logCustomAction(req, 'delete', 'quote', id, `Quote #${quote.quote_number} - ${quote.customer_name}`, {
      customer_name: quote.customer_name,
      total_amount: quote.total_amount,
      status: quote.status
    });

    // Delete quote items first (cascade should handle this, but being explicit)
    await db.query('DELETE FROM quote_items WHERE quote_id = $1', [id]);

    // Delete quote
    const result = await db.query('DELETE FROM quotes WHERE id = $1 RETURNING *', [id]);

    res.json({
      status: 'success',
      message: 'Quote deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// QUOTE TEMPLATES ROUTES
// ============================================

// GET all quote templates
router.get('/templates', authenticateToken, async (req, res, next) => {
  try {
    const { template_type, is_active } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramCount = 0;

    if (template_type) {
      paramCount++;
      whereClause += ` AND template_type = $${paramCount}`;
      params.push(template_type);
    }

    if (is_active !== undefined) {
      paramCount++;
      whereClause += ` AND is_active = $${paramCount}`;
      params.push(is_active === 'true');
    }

    const query = `
      SELECT 
        qt.*,
        u.name as created_by_name,
        COUNT(qti.id) as items_count
      FROM quote_templates qt
      LEFT JOIN users u ON qt.created_by = u.id
      LEFT JOIN quote_template_items qti ON qt.id = qti.template_id
      ${whereClause}
      GROUP BY qt.id, u.name
      ORDER BY qt.created_at DESC
    `;

    const result = await db.query(query, params);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET single quote template with items
router.get('/templates/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const templateQuery = `
      SELECT 
        qt.*,
        u.name as created_by_name
      FROM quote_templates qt
      LEFT JOIN users u ON qt.created_by = u.id
      WHERE qt.id = $1
    `;
    
    const templateResult = await db.query(templateQuery, [id]);
    
    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Template not found'
      });
    }

    // Get template items
    const itemsQuery = `
      SELECT * FROM quote_template_items 
      WHERE template_id = $1 
      ORDER BY position ASC
    `;
    
    const itemsResult = await db.query(itemsQuery, [id]);
    
    const template = {
      ...templateResult.rows[0],
      items: itemsResult.rows
    };

    res.json({
      status: 'success',
      data: template
    });
  } catch (err) {
    next(err);
  }
});

// POST create quote template
router.post('/templates', authenticateToken, async (req, res, next) => {
  try {
    const {
      template_name,
      template_type,
      description,
      default_valid_days,
      default_terms_conditions,
      default_payment_terms,
      default_delivery_terms,
      default_discount_percentage,
      items
    } = req.body;

    // Insert template
    const templateQuery = `
      INSERT INTO quote_templates (
        template_name, template_type, description, default_valid_days,
        default_terms_conditions, default_payment_terms, default_delivery_terms,
        default_discount_percentage, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const templateResult = await db.query(templateQuery, [
      template_name,
      template_type,
      description || null,
      default_valid_days || 30,
      default_terms_conditions || null,
      default_payment_terms || null,
      default_delivery_terms || null,
      default_discount_percentage || 0,
      req.user.id
    ]);

    const template = templateResult.rows[0];

    // Insert template items if provided
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await db.query(
          `INSERT INTO quote_template_items (
            template_id, item_type, item_reference_id, item_name, 
            description, quantity, unit_price, category, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            template.id,
            item.item_type,
            item.item_reference_id || null,
            item.item_name,
            item.description || null,
            item.quantity || 1,
            item.unit_price || null,
            item.category || null,
            i
          ]
        );
      }
    }

    res.status(201).json({
      status: 'success',
      data: template
    });
  } catch (err) {
    next(err);
  }
});

// PATCH update quote template
router.patch('/templates/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = [
      'template_name', 'template_type', 'description', 'default_valid_days',
      'default_terms_conditions', 'default_payment_terms', 'default_delivery_terms',
      'default_discount_percentage', 'is_active'
    ];

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined && allowedFields.includes(key)) {
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
      UPDATE quote_templates 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Template not found'
      });
    }

    res.json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// DELETE quote template
router.delete('/templates/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM quote_templates WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Template not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Template deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// CATALOG INTEGRATION ROUTES
// ============================================

// GET available machines for quotes
router.get('/catalog/machines', authenticateToken, async (req, res, next) => {
  try {
    const { search, category, manufacturer } = req.query;
    
    let whereConditions = ['1=1'];
    let params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereConditions.push(`(mm.name ILIKE $${paramCount} OR mm.manufacturer ILIKE $${paramCount} OR mm.catalogue_number ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    if (category) {
      paramCount++;
      whereConditions.push(`mm.category_id = $${paramCount}`);
      params.push(category);
    }

    if (manufacturer) {
      paramCount++;
      whereConditions.push(`mm.manufacturer ILIKE $${paramCount}`);
      params.push(`%${manufacturer}%`);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
      SELECT 
        mm.id,
        mm.name,
        mm.manufacturer,
        mm.catalogue_number,
        mm.description,
        mm.warranty_months,
        mc.name as category_name,
        COUNT(ms.id) as available_serials,
        (SELECT AVG(am.sale_price) 
         FROM assigned_machines am 
         JOIN machine_serials ms2 ON am.serial_id = ms2.id 
         WHERE ms2.model_id = mm.id AND am.is_sale = true) as avg_sale_price
      FROM machine_models mm
      LEFT JOIN machine_categories mc ON mm.category_id = mc.id
      LEFT JOIN machine_serials ms ON mm.id = ms.model_id AND ms.status = 'available'
      ${whereClause}
      GROUP BY mm.id, mc.name
      ORDER BY mm.name ASC
      LIMIT 50
    `;

    const result = await db.query(query, params);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET available parts/inventory for quotes
router.get('/catalog/parts', authenticateToken, async (req, res, next) => {
  try {
    const { search, category, in_stock_only } = req.query;
    
    let whereConditions = ['1=1'];
    let params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereConditions.push(`(i.name ILIKE $${paramCount} OR i.description ILIKE $${paramCount} OR i.sku ILIKE $${paramCount})`);
      params.push(`%${search}%`);
    }

    if (category) {
      paramCount++;
      whereConditions.push(`i.category = $${paramCount}`);
      params.push(category);
    }

    if (in_stock_only === 'true') {
      whereConditions.push(`i.quantity > 0`);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
      SELECT 
        i.id,
        i.name,
        i.description,
        i.category,
        i.quantity,
        i.unit_price,
        i.sku,
        i.supplier,
        CASE 
          WHEN i.quantity = 0 THEN 'out_of_stock'
          WHEN i.quantity <= i.min_stock_level THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM inventory i
      ${whereClause}
      ORDER BY i.name ASC
      LIMIT 100
    `;

    const result = await db.query(query, params);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET service items (predefined services)
router.get('/catalog/services', authenticateToken, async (req, res, next) => {
  try {
    // Return predefined service items
    const services = [
      {
        id: 'service_1',
        name: 'Delivery & Installation',
        description: 'Professional delivery and on-site installation',
        category: 'Installation Services',
        default_price: 500.00
      },
      {
        id: 'service_2',
        name: 'Training Session (2 hours)',
        description: 'Basic operation and maintenance training',
        category: 'Training Services',
        default_price: 200.00
      },
      {
        id: 'service_3',
        name: 'Training Session (4 hours)',
        description: 'Comprehensive operation and maintenance training',
        category: 'Training Services',
        default_price: 350.00
      },
      {
        id: 'service_4',
        name: 'Annual Maintenance Contract',
        description: 'Comprehensive annual maintenance service',
        category: 'Maintenance Services',
        default_price: 1200.00
      },
      {
        id: 'service_5',
        name: 'Quarterly Maintenance',
        description: 'Preventive maintenance service (quarterly)',
        category: 'Maintenance Services',
        default_price: 400.00
      },
      {
        id: 'service_6',
        name: 'Emergency Support (24/7)',
        description: '24/7 emergency support for 1 year',
        category: 'Support Services',
        default_price: 2500.00
      },
      {
        id: 'service_7',
        name: 'Extended Warranty (1 Year)',
        description: 'Extended warranty coverage beyond manufacturer warranty',
        category: 'Warranty Services',
        default_price: 800.00
      },
      {
        id: 'service_8',
        name: 'On-Site Repair Service',
        description: 'Professional on-site repair and troubleshooting',
        category: 'Repair Services',
        default_price: 150.00
      }
    ];
    
    res.json({
      status: 'success',
      data: services
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// QUOTE ITEM ROUTES
// ============================================

// GET quote items for a specific quote
router.get('/:quoteId/items', authenticateToken, async (req, res, next) => {
  try {
    const { quoteId } = req.params;
    
    const query = `
      SELECT * FROM quote_items 
      WHERE quote_id = $1 
      ORDER BY position ASC
    `;
    
    const result = await db.query(query, [quoteId]);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// POST add item to quote
router.post('/:quoteId/items', authenticateToken, async (req, res, next) => {
  try {
    const { quoteId } = req.params;
    const {
      item_type,
      item_reference_id,
      item_name,
      description,
      quantity,
      unit_price,
      category
    } = req.body;

    // Get current max position
    const positionResult = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_position FROM quote_items WHERE quote_id = $1',
      [quoteId]
    );
    const position = positionResult.rows[0].next_position;

    // Calculate total
    const total = quantity * unit_price;

    const query = `
      INSERT INTO quote_items (
        quote_id, item_type, item_reference_id, item_name, 
        description, quantity, unit_price, total_price, category, position
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await db.query(query, [
      quoteId,
      item_type || 'custom',
      item_reference_id || null,
      item_name,
      description || null,
      quantity,
      unit_price,
      total,
      category || null,
      position
    ]);

    // Update quote total
    await updateQuoteTotal(quoteId);

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// PATCH update quote item
router.patch('/:quoteId/items/:itemId', authenticateToken, async (req, res, next) => {
  try {
    const { quoteId, itemId } = req.params;
    const { item_name, description, quantity, unit_price, category } = req.body;

    // Build update query
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    if (item_name !== undefined) {
      paramCount++;
      updateFields.push(`item_name = $${paramCount}`);
      values.push(item_name);
    }

    if (description !== undefined) {
      paramCount++;
      updateFields.push(`description = $${paramCount}`);
      values.push(description);
    }

    if (quantity !== undefined) {
      paramCount++;
      updateFields.push(`quantity = $${paramCount}`);
      values.push(quantity);
    }

    if (unit_price !== undefined) {
      paramCount++;
      updateFields.push(`unit_price = $${paramCount}`);
      values.push(unit_price);
    }

    if (category !== undefined) {
      paramCount++;
      updateFields.push(`category = $${paramCount}`);
      values.push(category);
    }

    // Recalculate total if quantity or unit_price changed
    if (quantity !== undefined || unit_price !== undefined) {
      updateFields.push(`total_price = quantity * unit_price`);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'No fields to update'
      });
    }

    paramCount++;
    values.push(itemId);
    paramCount++;
    values.push(quoteId);

    const query = `
      UPDATE quote_items 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount - 1} AND quote_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Quote item not found'
      });
    }

    // Update quote total
    await updateQuoteTotal(quoteId);

    res.json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// DELETE quote item
router.delete('/:quoteId/items/:itemId', authenticateToken, async (req, res, next) => {
  try {
    const { quoteId, itemId } = req.params;

    const result = await db.query(
      'DELETE FROM quote_items WHERE id = $1 AND quote_id = $2 RETURNING *',
      [itemId, quoteId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Quote item not found'
      });
    }

    // Update quote total
    await updateQuoteTotal(quoteId);

    res.json({
      status: 'success',
      message: 'Quote item deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// QUOTE ACTIONS
// ============================================

// POST duplicate quote
router.post('/:id/duplicate', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get original quote
    const quoteResult = await db.query('SELECT * FROM quotes WHERE id = $1', [id]);
    if (quoteResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Quote not found'
      });
    }

    const originalQuote = quoteResult.rows[0];

    // Generate new quote number for current year
    const currentYear = new Date().getFullYear();
    const quoteNumberResult = await db.query(
      'SELECT COALESCE(MAX(quote_number), 0) + 1 as next_number FROM quotes WHERE year_created = $1',
      [currentYear]
    );
    const quoteNumber = quoteNumberResult.rows[0].next_number;

    // Create new quote
    const newQuoteQuery = `
      INSERT INTO quotes (
        quote_number, year_created, customer_id, customer_name, customer_email, customer_phone,
        title, description, subtotal, tax_rate, tax_amount, discount_amount, discount_percentage,
        total_amount, valid_until, notes, terms_conditions, payment_terms, delivery_terms,
        quote_type, template_id, status, created_by, parent_quote_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      ) RETURNING *
    `;

    // Set valid_until to 30 days from now
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const newQuoteResult = await db.query(newQuoteQuery, [
      quoteNumber,
      currentYear,
      originalQuote.customer_id,
      originalQuote.customer_name,
      originalQuote.customer_email,
      originalQuote.customer_phone,
      `${originalQuote.title} (Copy)`,
      originalQuote.description,
      originalQuote.subtotal,
      originalQuote.tax_rate,
      originalQuote.tax_amount,
      originalQuote.discount_amount,
      originalQuote.discount_percentage,
      originalQuote.total_amount,
      validUntil.toISOString().split('T')[0],
      originalQuote.notes,
      originalQuote.terms_conditions,
      originalQuote.payment_terms,
      originalQuote.delivery_terms,
      originalQuote.quote_type,
      originalQuote.template_id,
      'draft',
      req.user.id,
      id // parent_quote_id
    ]);

    const newQuote = newQuoteResult.rows[0];

    // Copy quote items
    const itemsResult = await db.query(
      'SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY position',
      [id]
    );

    for (const item of itemsResult.rows) {
      await db.query(
        `INSERT INTO quote_items (
          quote_id, item_type, item_reference_id, item_name, description, 
          quantity, unit_price, total_price, category, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          newQuote.id,
          item.item_type,
          item.item_reference_id,
          item.item_name,
          item.description,
          item.quantity,
          item.unit_price,
          item.total_price,
          item.category,
          item.position
        ]
      );
    }

    // Log action
    await logCustomAction(req, 'duplicate', 'quote', newQuote.id, 
      `Quote #${quoteNumber} - ${newQuote.customer_name}`, {
      original_quote_id: id,
      original_quote_number: originalQuote.quote_number
    });

    res.status(201).json({
      status: 'success',
      data: newQuote,
      message: 'Quote duplicated successfully'
    });
  } catch (err) {
    next(err);
  }
});

// POST create quote from template
router.post('/from-template/:templateId', authenticateToken, async (req, res, next) => {
  try {
    const { templateId } = req.params;
    const { customer_id, customer_name, customer_email, customer_phone, title } = req.body;

    // Get template
    const templateResult = await db.query(
      'SELECT * FROM quote_templates WHERE id = $1',
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Template not found'
      });
    }

    const template = templateResult.rows[0];

    // Generate quote number for current year
    const currentYear = new Date().getFullYear();
    const quoteNumberResult = await db.query(
      'SELECT COALESCE(MAX(quote_number), 0) + 1 as next_number FROM quotes WHERE year_created = $1',
      [currentYear]
    );
    const quoteNumber = quoteNumberResult.rows[0].next_number;

    // Calculate valid_until date
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (template.default_valid_days || 30));

    // Create quote
    const quoteQuery = `
      INSERT INTO quotes (
        quote_number, year_created, customer_id, customer_name, customer_email, customer_phone,
        title, terms_conditions, payment_terms, delivery_terms, discount_percentage,
        valid_until, quote_type, template_id, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const quoteResult = await db.query(quoteQuery, [
      quoteNumber,
      currentYear,
      customer_id || null,
      customer_name,
      customer_email || null,
      customer_phone || null,
      title || template.template_name,
      template.default_terms_conditions,
      template.default_payment_terms,
      template.default_delivery_terms,
      template.default_discount_percentage || 0,
      validUntil.toISOString().split('T')[0],
      template.template_type,
      templateId,
      'draft',
      req.user.id
    ]);

    const quote = quoteResult.rows[0];

    // Copy template items to quote
    const templateItemsResult = await db.query(
      'SELECT * FROM quote_template_items WHERE template_id = $1 ORDER BY position',
      [templateId]
    );

    for (const item of templateItemsResult.rows) {
      await db.query(
        `INSERT INTO quote_items (
          quote_id, item_type, item_reference_id, item_name, description, 
          quantity, unit_price, total_price, category, position
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          quote.id,
          item.item_type,
          item.item_reference_id,
          item.item_name,
          item.description,
          item.quantity,
          item.unit_price || 0,
          (item.quantity || 1) * (item.unit_price || 0),
          item.category,
          item.position
        ]
      );
    }

    // Update quote total
    await updateQuoteTotal(quote.id);

    res.status(201).json({
      status: 'success',
      data: quote
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// GENERIC QUOTE ROUTES (must come AFTER all specific routes)
// ============================================

// GET quote PDF (must be before /:id route)
router.get('/:id/pdf', authenticateToken, async (req, res, next) => {
  console.log('========================================');
  console.log('PDF DOWNLOAD REQUEST RECEIVED FOR QUOTE:', req.params.id);
  console.log('========================================');
  try {
    const { id } = req.params;

    // Get quote with all details
    const quoteQuery = `
      SELECT 
        q.*,
        u.name as created_by_name,
        c.company_name as customer_company_from_db,
        c.street_address as customer_address_from_db,
        c.city as customer_city_from_db,
        c.postal_code as customer_postal_code_from_db,
        c.vat_number as customer_vat_from_db
      FROM quotes q
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.id = $1
    `;
    
    const quoteResult = await db.query(quoteQuery, [id]);
    
    if (quoteResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Quote not found'
      });
    }

    const quote = quoteResult.rows[0];

    // Get quote items
    const itemsResult = await db.query(
      'SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY position ASC',
      [id]
    );

    // Prepare quote data for PDF
    const quoteData = {
      ...quote,
      items: itemsResult.rows,
      customer_company: quote.customer_company_from_db || quote.company_name || '',
      customer_address: quote.customer_address_from_db || '',
      customer_city: quote.customer_city_from_db || '',
      customer_postal_code: quote.customer_postal_code_from_db || '',
      customer_vat: quote.customer_vat_from_db || ''
    };

    // Generate PDF using PDFService
    const pdfBuffer = await PDFService.generateQuotePDF(quoteData);

    // Debug: Save PDF to file for inspection (always save for debugging)
    const debugPath = path.join(__dirname, '../debug-quote.pdf');
    fs.writeFileSync(debugPath, pdfBuffer);
    console.log('[DEBUG] PDF saved to:', debugPath);
    console.log('[DEBUG] PDF buffer size:', pdfBuffer.length);
    console.log('[DEBUG] PDF is Buffer:', Buffer.isBuffer(pdfBuffer));

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename=quote-${quote.formatted_number || quote.quote_number || id}.pdf`);
    
    // Send the PDF buffer
    res.end(pdfBuffer, 'binary');
  } catch (err) {
    console.error('PDF generation error:', err);
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

// ============================================
// HELPER FUNCTIONS
// ============================================

// Helper function to update quote total
async function updateQuoteTotal(quoteId) {
  const itemsResult = await db.query(
    'SELECT SUM(total_price) as subtotal FROM quote_items WHERE quote_id = $1',
    [quoteId]
  );

  const subtotal = parseFloat(itemsResult.rows[0].subtotal) || 0;

  // Get quote to calculate discount and tax
  const quoteResult = await db.query(
    'SELECT discount_percentage, tax_rate FROM quotes WHERE id = $1',
    [quoteId]
  );

  if (quoteResult.rows.length > 0) {
    const quote = quoteResult.rows[0];
    const discountPercentage = parseFloat(quote.discount_percentage) || 0;
    const taxRate = parseFloat(quote.tax_rate) || 0;

    const discountAmount = (subtotal * discountPercentage) / 100;
    const subtotalAfterDiscount = subtotal - discountAmount;
    const taxAmount = (subtotalAfterDiscount * taxRate) / 100;
    const totalAmount = subtotalAfterDiscount + taxAmount;

    await db.query(
      `UPDATE quotes 
       SET subtotal = $1, discount_amount = $2, tax_amount = $3, total_amount = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [subtotal, discountAmount, taxAmount, totalAmount, quoteId]
    );
  }
}

// PDF generation is now handled by PDFService

// POST /quotes - Create a new quote
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    // Debug logging
    console.log('Received quote data:', {
      discount_percentage: req.body.discount_percentage,
      discount_amount: req.body.discount_amount,
      tax_rate: req.body.tax_rate,
      tax_amount: req.body.tax_amount,
      subtotal: req.body.subtotal,
      total_amount: req.body.total_amount
    });

    const {
      customer_id,
      customer_name,
      customer_email,
      customer_phone,
      title,
      description,
      subtotal,
      discount_percentage,
      discount_amount,
      tax_rate,
      tax_amount,
      total_amount,
      valid_until,
      notes,
      terms_conditions,
      payment_terms,
      delivery_terms,
      quote_type = 'custom',
      template_id,
      items = []
    } = req.body;

    // Validate required fields
    if (!customer_name || !title) {
      return res.status(400).json({
        status: 'error',
        message: 'Customer name and title are required'
      });
    }

    // Calculate valid_until if not provided
    const validUntil = valid_until ? new Date(valid_until) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    // Generate quote number for current year
    const currentYear = new Date().getFullYear();
    const quoteNumberResult = await db.query(
      'SELECT COALESCE(MAX(quote_number), 0) + 1 as next_number FROM quotes WHERE year_created = $1',
      [currentYear]
    );
    const quoteNumber = quoteNumberResult.rows[0].next_number;

    // Insert quote
    const quoteQuery = `
      INSERT INTO quotes (
        quote_number, year_created, customer_id, customer_name, customer_email, customer_phone,
        title, description, subtotal, discount_percentage, discount_amount,
        tax_rate, tax_amount, total_amount, valid_until, notes,
        terms_conditions, payment_terms, delivery_terms, quote_type,
        template_id, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `;

    const quoteValues = [
      quoteNumber,
      currentYear,
      customer_id || null,
      customer_name,
      customer_email || null,
      customer_phone || null,
      title,
      description || null,
      Number(subtotal) || 0,
      Number(discount_percentage) || 0,
      Number(discount_amount) || 0,
      Number(tax_rate) || 0,
      Number(tax_amount) || 0,
      Number(total_amount) || 0,
      validUntil.toISOString().split('T')[0],
      notes || null,
      terms_conditions || null,
      payment_terms || null,
      delivery_terms || null,
      quote_type,
      template_id || null,
      'draft',
      req.user.id
    ];

    const quoteResult = await db.query(quoteQuery, quoteValues);
    const newQuote = quoteResult.rows[0];

    // Insert quote items if provided
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemQuery = `
          INSERT INTO quote_items (
            quote_id, item_type, item_reference_id, item_name, description,
            quantity, unit_price, total_price, category, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        const itemValues = [
          newQuote.id,
          item.item_type || 'custom',
          item.item_reference_id || null,
          item.item_name || item.description || 'Item',
          item.description || null,
          item.quantity || 1,
          item.unit_price || 0,
          item.total_price || (item.quantity * item.unit_price) || 0,
          item.category || null,
          item.position || i
        ];

        await db.query(itemQuery, itemValues);
      }
    }

    // Log the action
    await logCustomAction(req, 'create', 'quote', newQuote.id, `Quote #${quoteNumber} - ${customer_name}`, {
      customer_name: customer_name,
      total_amount: total_amount,
      items_count: items.length
    });

    res.status(201).json({
      status: 'success',
      message: 'Quote created successfully',
      data: newQuote
    });

  } catch (error) {
    console.error('Error creating quote:', error);
    next(error);
  }
});

module.exports = router;
