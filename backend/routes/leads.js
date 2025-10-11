const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { logCustomAction } = require('../utils/actionLogger');

// GET all leads with filtering and search
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { 
      search, 
      status, 
      quality, 
      assigned_to, 
      source,
      created_by,
      page = 1, 
      limit = 50
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    let params = [];
    let paramCount = 0;

    // Search filter
    if (search) {
      paramCount++;
      whereConditions.push(`(
        customer_name ILIKE $${paramCount} OR 
        company_name ILIKE $${paramCount} OR 
        email ILIKE $${paramCount} OR 
        phone ILIKE $${paramCount}
      )`);
      params.push(`%${search}%`);
    }

    // Sales stage filter
    if (status && status !== 'all') {
      paramCount++;
      whereConditions.push(`sales_stage = $${paramCount}`);
      params.push(status);
    }

    // Lead quality filter
    if (quality && quality !== 'all') {
      paramCount++;
      whereConditions.push(`lead_quality = $${paramCount}`);
      params.push(quality);
    }

    // Assigned user filter
    if (assigned_to && assigned_to !== 'all') {
      if (assigned_to === 'unassigned') {
        whereConditions.push(`assigned_to IS NULL`);
      } else {
        paramCount++;
        whereConditions.push(`assigned_to = $${paramCount}`);
        params.push(assigned_to);
      }
    }

    // Source filter
    if (source && source !== 'all') {
      paramCount++;
      whereConditions.push(`source = $${paramCount}`);
      params.push(source);
    }

    // Created by filter
    if (created_by && created_by !== 'all') {
      paramCount++;
      whereConditions.push(`created_by = $${paramCount}`);
      params.push(created_by);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM leads l
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Get leads with pagination
    paramCount++;
    const query = `
      SELECT 
        l.*,
        u.name as assigned_to_name,
        u.email as assigned_to_email,
        uc.name as created_by_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      LEFT JOIN users uc ON l.created_by = uc.id
      ${whereClause}
      ORDER BY 
        CASE l.lead_quality 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          ELSE 3 
        END,
        l.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      status: 'success',
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET lead statistics
router.get('/statistics', authenticateToken, async (req, res, next) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN sales_stage IN ('qualified', 'proposal', 'negotiation') THEN 1 END) as qualified_leads,
        COUNT(CASE WHEN sales_stage = 'won' THEN 1 END) as won_leads,
        COUNT(CASE WHEN sales_stage = 'lost' THEN 1 END) as lost_leads,
        COALESCE(SUM(potential_value), 0) as total_potential_value,
        COALESCE(AVG(potential_value), 0) as avg_potential_value,
        ROUND(
          (CASE 
            WHEN COUNT(*) > 0 THEN 
              (COUNT(CASE WHEN sales_stage = 'won' THEN 1 END)::FLOAT / COUNT(*)::FLOAT * 100)
            ELSE 0 
          END)::NUMERIC, 2
        ) as conversion_rate
      FROM leads
    `;

    const result = await db.query(statsQuery);
    const stats = result.rows[0];

    res.json({
      status: 'success',
      data: {
        totalLeads: parseInt(stats.total_leads),
        qualifiedLeads: parseInt(stats.qualified_leads),
        wonLeads: parseInt(stats.won_leads),
        lostLeads: parseInt(stats.lost_leads),
        totalPotentialValue: parseFloat(stats.total_potential_value),
        avgPotentialValue: parseFloat(stats.avg_potential_value),
        conversionRate: parseFloat(stats.conversion_rate)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET leads grouped by pipeline stage
router.get('/pipeline', authenticateToken, async (req, res, next) => {
  try {
    const { assigned_to } = req.query;
    
    let whereClause = '';
    let params = [];
    
    if (assigned_to && assigned_to !== 'all') {
      whereClause = 'WHERE l.assigned_to = $1';
      params.push(assigned_to);
    }

    const query = `
      SELECT 
        l.*,
        u.name as assigned_to_name,
        u.email as assigned_to_email
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      ${whereClause}
      ORDER BY 
        CASE l.sales_stage 
          WHEN 'new' THEN 1 
          WHEN 'contacted' THEN 2 
          WHEN 'qualified' THEN 3 
          WHEN 'proposal' THEN 4 
          WHEN 'negotiation' THEN 5 
          WHEN 'won' THEN 6 
          WHEN 'lost' THEN 7 
          ELSE 8 
        END,
        l.pipeline_position ASC NULLS LAST,
        l.created_at DESC
    `;

    const result = await db.query(query, params);
    
    // Group leads by stage
    const groupedLeads = {
      new: [],
      contacted: [],
      qualified: [],
      proposal: [],
      negotiation: [],
      won: [],
      lost: []
    };

    result.rows.forEach(lead => {
      if (groupedLeads[lead.sales_stage]) {
        groupedLeads[lead.sales_stage].push(lead);
      }
    });

    res.json({
      status: 'success',
      data: groupedLeads
    });
  } catch (err) {
    next(err);
  }
});

// GET pipeline statistics
router.get('/pipeline-stats', authenticateToken, async (req, res, next) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_leads,
        COALESCE(SUM(potential_value), 0) as total_value,
        COUNT(CASE WHEN next_follow_up < CURRENT_DATE THEN 1 END) as overdue_follow_ups,
        ROUND(
          (CASE 
            WHEN COUNT(*) > 0 THEN 
              (COUNT(CASE WHEN sales_stage = 'won' THEN 1 END)::FLOAT / COUNT(*)::FLOAT * 100)
            ELSE 0 
          END)::NUMERIC, 2
        ) as conversion_rate
      FROM leads
      WHERE sales_stage NOT IN ('won', 'lost')
    `;

    const result = await db.query(statsQuery);
    const stats = result.rows[0];

    res.json({
      status: 'success',
      data: {
        totalLeads: parseInt(stats.total_leads),
        totalValue: parseFloat(stats.total_value),
        overdueFollowUps: parseInt(stats.overdue_follow_ups),
        conversionRate: parseFloat(stats.conversion_rate)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET filter options for leads
router.get('/filter-options', authenticateToken, async (req, res, next) => {
  try {
    // Get unique sources
    const sourcesQuery = `
      SELECT DISTINCT source 
      FROM leads 
      WHERE source IS NOT NULL AND source != ''
      ORDER BY source
    `;
    const sourcesResult = await db.query(sourcesQuery);

    // Get unique sales stages
    const stagesQuery = `
      SELECT DISTINCT sales_stage 
      FROM leads 
      WHERE sales_stage IS NOT NULL
      ORDER BY sales_stage
    `;
    const stagesResult = await db.query(stagesQuery);

    // Get unique lead qualities
    const qualitiesQuery = `
      SELECT DISTINCT lead_quality 
      FROM leads 
      WHERE lead_quality IS NOT NULL
      ORDER BY lead_quality
    `;
    const qualitiesResult = await db.query(qualitiesQuery);

    // Get users for assignment filter
    const usersQuery = `
      SELECT id, name, email 
      FROM users 
      WHERE status = 'active'
      ORDER BY name
    `;
    const usersResult = await db.query(usersQuery);

    res.json({
      status: 'success',
      data: {
        sources: sourcesResult.rows.map(row => row.source),
        stages: stagesResult.rows.map(row => row.sales_stage),
        qualities: qualitiesResult.rows.map(row => row.lead_quality),
        users: usersResult.rows
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET lead by ID
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        l.*,
        u.name as assigned_to_name,
        u.email as assigned_to_email
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      WHERE l.id = $1
    `;
    
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Lead not found'
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


// POST create new lead
router.post('/', 
  authenticateToken,
  [
    body('customer_name').notEmpty().withMessage('Customer name is required'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('lead_quality').isIn(['high', 'medium', 'low']).withMessage('Invalid lead quality'),
    body('sales_stage').isIn(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).withMessage('Invalid sales stage'),
    body('potential_value').optional().isNumeric().withMessage('Potential value must be a number'),
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
        customer_name,
        company_name,
        email,
        phone,
        source,
        lead_quality = 'medium',
        sales_stage = 'new',
        potential_value,
        sales_notes,
        next_follow_up,
        assigned_to
      } = req.body;

      const query = `
        INSERT INTO leads (
          customer_name, company_name, email, phone, source, 
          lead_quality, sales_stage, potential_value, sales_notes, 
          next_follow_up, assigned_to, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const result = await db.query(query, [
        customer_name,
        company_name || null,
        email || null,
        phone || null,
        source || null,
        lead_quality,
        sales_stage,
        potential_value || null,
        sales_notes || null,
        next_follow_up || null,
        assigned_to || req.user.id, // Auto-assign to current user if not specified
        req.user.id
      ]);

      const lead = result.rows[0];

      // Log action
      await logCustomAction(req, 'create', 'lead', lead.id, customer_name, {
        lead_quality: lead_quality,
        sales_stage: sales_stage,
        potential_value: potential_value,
        source: source
      });

      res.status(201).json({
        status: 'success',
        data: lead
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH update lead
router.patch('/:id', 
  authenticateToken,
  [
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('lead_quality').optional().isIn(['high', 'medium', 'low']).withMessage('Invalid lead quality'),
    body('sales_stage').optional().isIn(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).withMessage('Invalid sales stage'),
    body('potential_value').optional().isNumeric().withMessage('Potential value must be a number'),
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
      const updateFields = req.body;

      // Build dynamic update query
      const setClause = Object.keys(updateFields)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const values = [id, ...Object.values(updateFields)];

      const query = `
        UPDATE leads 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'fail',
          message: 'Lead not found'
        });
      }

      const lead = result.rows[0];

      // Log action
      await logCustomAction(req, 'update', 'lead', id, lead.customer_name, {
        updated_fields: Object.keys(updateFields),
        sales_stage: lead.sales_stage,
        lead_quality: lead.lead_quality
      });

      res.json({
        status: 'success',
        data: lead
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE lead
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get lead details before deletion
    const leadResult = await db.query('SELECT * FROM leads WHERE id = $1', [id]);
    if (leadResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Lead not found'
      });
    }
    const lead = leadResult.rows[0];

    // Log action before deletion
    await logCustomAction(req, 'delete', 'lead', id, lead.customer_name, {
      sales_stage: lead.sales_stage,
      lead_quality: lead.lead_quality,
      potential_value: lead.potential_value
    });
    
    const result = await db.query('DELETE FROM leads WHERE id = $1 RETURNING id', [id]);

    res.json({
      status: 'success',
      message: 'Lead deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

// POST add follow-up to lead
router.post('/:id/follow-ups',
  authenticateToken,
  [
    body('notes').notEmpty().withMessage('Notes are required'),
    body('follow_up_date').notEmpty().withMessage('Follow-up date is required'),
    body('follow_up_type').notEmpty().withMessage('Follow-up type is required'),
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

      const { id: leadId } = req.params;
      const { notes, follow_up_date, follow_up_type, next_follow_up } = req.body;

      // First, add the follow-up record
      const followUpQuery = `
        INSERT INTO lead_follow_ups (
          lead_id, notes, follow_up_date, follow_up_type, created_by
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const followUpResult = await db.query(followUpQuery, [
        leadId,
        notes,
        follow_up_date,
        follow_up_type,
        req.user.id
      ]);

      // Update the lead's next follow-up date if provided
      if (next_follow_up) {
        await db.query(
          'UPDATE leads SET next_follow_up = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [next_follow_up, leadId]
        );
      }

      res.status(201).json({
        status: 'success',
        data: followUpResult.rows[0]
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET follow-ups for a lead
router.get('/:id/follow-ups', authenticateToken, async (req, res, next) => {
  try {
    const { id: leadId } = req.params;
    
    const query = `
      SELECT 
        lf.*,
        u.name as created_by_name
      FROM lead_follow_ups lf
      LEFT JOIN users u ON lf.created_by = u.id
      WHERE lf.lead_id = $1
      ORDER BY lf.created_at DESC
    `;
    
    const result = await db.query(query, [leadId]);
    
    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET all follow-ups
router.get('/follow-ups/all', authenticateToken, async (req, res, next) => {
  try {
    const query = `
      SELECT 
        lf.*,
        u.name as created_by_name,
        l.customer_name,
        l.company_name
      FROM lead_follow_ups lf
      LEFT JOIN users u ON lf.created_by = u.id
      LEFT JOIN leads l ON lf.lead_id = l.id
      ORDER BY lf.created_at DESC
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



// PATCH update lead stage and position
router.patch('/:id/stage', 
  authenticateToken,
  [
    body('sales_stage').isIn(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).withMessage('Invalid sales stage'),
    body('pipeline_position').optional().isNumeric().withMessage('Pipeline position must be a number'),
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
      const { sales_stage, pipeline_position } = req.body;

      const query = `
        UPDATE leads 
        SET 
          sales_stage = $1,
          pipeline_position = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;

      const result = await db.query(query, [sales_stage, pipeline_position || null, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'fail',
          message: 'Lead not found'
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

// PATCH update follow-up completion status
router.patch('/:leadId/follow-ups/:followUpId', authenticateToken, async (req, res, next) => {
  try {
    const { leadId, followUpId } = req.params;
    const { completed } = req.body;

    const query = `
      UPDATE lead_follow_ups 
      SET completed = $1, completed_at = $2
      WHERE id = $3 AND lead_id = $4
      RETURNING *
    `;

    const result = await db.query(query, [
      completed,
      completed ? new Date() : null,
      followUpId,
      leadId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Follow-up not found'
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

// PUT update follow-up
router.put('/:leadId/follow-ups/:followUpId', authenticateToken, async (req, res, next) => {
  try {
    const { leadId, followUpId } = req.params;
    const { follow_up_date, follow_up_type, notes, completed } = req.body;

    // Validate required fields
    if (!follow_up_date || !follow_up_type) {
      return res.status(400).json({
        status: 'error',
        message: 'Follow-up date and type are required'
      });
    }

    const query = `
      UPDATE lead_follow_ups 
      SET 
        follow_up_date = $1,
        follow_up_type = $2,
        notes = $3,
        completed = $4,
        completed_at = CASE 
          WHEN $4 = true AND completed = false THEN NOW()
          WHEN $4 = false THEN NULL
          ELSE completed_at
        END,
        updated_at = NOW()
      WHERE id = $5 AND lead_id = $6
      RETURNING *
    `;

    const result = await db.query(query, [
      follow_up_date,
      follow_up_type,
      notes || '',
      completed || false,
      followUpId,
      leadId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Follow-up not found'
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

// DELETE follow-up
router.delete('/:leadId/follow-ups/:followUpId', authenticateToken, async (req, res, next) => {
  try {
    const { leadId, followUpId } = req.params;

    const query = `
      DELETE FROM lead_follow_ups 
      WHERE id = $1 AND lead_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [followUpId, leadId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Follow-up not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Follow-up deleted successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
