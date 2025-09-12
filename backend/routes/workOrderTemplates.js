const express = require('express');
const router = express.Router();
const db = require('../db');
const { body, validationResult } = require('express-validator');

// GET /api/work-order-templates - Get all templates
router.get('/', async (req, res, next) => {
  try {
    const { category, search } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (category) {
      whereConditions.push(`category = $${paramIndex}`);
      queryParams.push(category);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT 
        id, name, description, category, 
        required_parts, steps, created_at, updated_at
       FROM work_order_templates
       ${whereClause}
       ORDER BY name`,
      queryParams
    );

    res.json({
      status: 'success',
      data: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/work-order-templates/categories - Get all categories
router.get('/categories', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT DISTINCT category FROM work_order_templates ORDER BY category'
    );

    const categories = result.rows.map(row => row.category);

    res.json({
      status: 'success',
      data: categories
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/work-order-templates/:id - Get template by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT 
        id, name, description, category, 
        required_parts, steps, created_at, updated_at
       FROM work_order_templates
       WHERE id = $1`,
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
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/work-order-templates - Create new template
router.post('/', [
  body('name').notEmpty().withMessage('Name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('steps').isArray().withMessage('Steps must be an array')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'fail',
        message: errors.array().map(err => `${err.param}: ${err.msg}`).join(', ')
      });
    }

    const { name, description, category, required_parts, steps } = req.body;

    const result = await db.query(
      `INSERT INTO work_order_templates 
       (name, description, category, required_parts, steps)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, category, required_parts, steps, created_at`,
      [name, description, category, required_parts || [], steps]
    );

    res.status(201).json({
      status: 'success',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/work-order-templates/:id - Update template
router.patch('/:id', [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty'),
  body('category').optional().notEmpty().withMessage('Category cannot be empty'),
  body('steps').optional().isArray().withMessage('Steps must be an array')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'fail',
        message: errors.array().map(err => `${err.param}: ${err.msg}`).join(', ')
      });
    }

    const { id } = req.params;
    const { name, description, category, required_parts, steps } = req.body;

    const result = await db.query(
      `UPDATE work_order_templates 
       SET 
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         category = COALESCE($4, category),
         required_parts = COALESCE($5, required_parts),
         steps = COALESCE($6, steps),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, description, category, required_parts, steps, updated_at`,
      [id, name, description, category, required_parts, steps]
    );

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

// DELETE /api/work-order-templates/:id - Delete template
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM work_order_templates WHERE id = $1 RETURNING id',
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

// POST /api/work-order-templates/:id/apply - Apply template to work order
router.post('/:id/apply', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { work_order_id } = req.body;
    
    if (!work_order_id) {
      return res.status(400).json({
        status: 'fail',
        message: 'work_order_id is required'
      });
    }

    // Get template
    const templateResult = await db.query(
      'SELECT * FROM work_order_templates WHERE id = $1',
      [id]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Template not found'
      });
    }

    const template = templateResult.rows[0];

    // Verify work order exists
    const workOrderResult = await db.query(
      'SELECT id, description FROM work_orders WHERE id = $1',
      [work_order_id]
    );

    if (workOrderResult.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Work order not found'
      });
    }

    // Update work order with template data
    const updateResult = await db.query(
      `UPDATE work_orders 
       SET 
         description = $2,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, description`,
      [work_order_id, template.description]
    );

    // Add template steps as notes
    if (template.steps && template.steps.length > 0) {
      for (const step of template.steps) {
        await db.query(
          `INSERT INTO work_order_notes (work_order_id, content)
           VALUES ($1, $2)`,
          [work_order_id, `Template Step: ${step}`]
        );
      }
    }

    res.json({
      status: 'success',
      message: 'Template applied successfully',
      data: {
        work_order: updateResult.rows[0],
        template_applied: template.name,
        steps_added: template.steps?.length || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
