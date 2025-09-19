const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const DynamicPricingService = require('../services/dynamicPricingService');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Dynamic pricing validation errors:', errors.array());
    console.log('Request body:', req.body);
    return res.status(400).json({ 
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }
  next();
};

// POST /api/dynamic-pricing/calculate - Calculate dynamic pricing
router.post('/calculate', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), [
  body('rental_machine_id').isInt().withMessage('Valid rental machine ID is required'),
  body('start_date').isISO8601().withMessage('Valid start date is required'),
  body('end_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Valid end date is required'),
  body('customer_id').optional().isInt().withMessage('Valid customer ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { rental_machine_id, start_date, end_date, customer_id } = req.body;
    
    const pricing = await DynamicPricingService.calculatePricing(
      rental_machine_id,
      start_date,
      end_date,
      customer_id
    );

    res.json(pricing);
  } catch (error) {
    console.error('Error calculating dynamic pricing:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// GET /api/dynamic-pricing/base - Get all base pricing
router.get('/base', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const pricing = await DynamicPricingService.getAllBasePricing();
    res.json(pricing);
  } catch (error) {
    console.error('Error fetching base pricing:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/dynamic-pricing/base/:id - Get base pricing for a machine
router.get('/base/:id', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), [
  param('id').isInt().withMessage('Valid machine ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const pricing = await DynamicPricingService.getBasePricing(id);
    
    if (!pricing) {
      return res.status(404).json({ message: 'No pricing found for this machine' });
    }

    res.json(pricing);
  } catch (error) {
    console.error('Error fetching base pricing:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/dynamic-pricing/base/:id - Set base pricing for a machine
router.put('/base/:id', authenticateToken, authorizeRoles('admin', 'manager'), [
  param('id').isInt({ min: 1 }).withMessage('Valid machine ID is required'),
  body('base_price_daily').isNumeric().withMessage('Valid daily price is required'),
  body('base_price_weekly').optional({ nullable: true, checkFalsy: true }).isNumeric().withMessage('Valid weekly price is required'),
  body('base_price_monthly').optional({ nullable: true, checkFalsy: true }).isNumeric().withMessage('Valid monthly price is required'),
  body('minimum_rental_days').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Valid minimum rental days is required'),
  body('maximum_rental_days').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('Valid maximum rental days is required'),
  body('currency').optional({ nullable: true, checkFalsy: true }).isLength({ min: 2, max: 3 }).withMessage('Valid currency code is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const pricingData = req.body;
    const userId = req.user.id;

    const result = await DynamicPricingService.setBasePricing(id, pricingData, userId);
    res.json(result);
  } catch (error) {
    console.error('Error setting base pricing:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// GET /api/dynamic-pricing/rules - Get all pricing rules
router.get('/rules', authenticateToken, authorizeRoles('admin', 'manager', 'technician'), async (req, res) => {
  try {
    const rules = await DynamicPricingService.getPricingRules();
    res.json(rules);
  } catch (error) {
    console.error('Error fetching pricing rules:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/dynamic-pricing/rules - Create a new pricing rule
router.post('/rules', authenticateToken, authorizeRoles('admin', 'manager'), [
  body('name').notEmpty().withMessage('Rule name is required'),
  body('description').optional().isString(),
  body('rule_type').isIn(['demand', 'seasonal', 'availability', 'customer_tier', 'duration']).withMessage('Valid rule type is required'),
  body('is_active').optional().isBoolean(),
  body('priority').isInt().withMessage('Valid priority is required'),
  body('conditions').isObject().withMessage('Valid conditions object is required'),
  body('adjustments').isObject().withMessage('Valid adjustments object is required')
], handleValidationErrors, async (req, res) => {
  try {
    const ruleData = req.body;
    const userId = req.user.id;

    const result = await DynamicPricingService.savePricingRule(ruleData, userId);
    res.json(result);
  } catch (error) {
    console.error('Error creating pricing rule:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// PUT /api/dynamic-pricing/rules/:id - Update a pricing rule
router.put('/rules/:id', authenticateToken, authorizeRoles('admin', 'manager'), [
  param('id').isInt().withMessage('Valid rule ID is required'),
  body('name').notEmpty().withMessage('Rule name is required'),
  body('description').optional().isString(),
  body('rule_type').isIn(['demand', 'seasonal', 'availability', 'customer_tier', 'duration']).withMessage('Valid rule type is required'),
  body('is_active').optional().isBoolean(),
  body('priority').isInt().withMessage('Valid priority is required'),
  body('conditions').isObject().withMessage('Valid conditions object is required'),
  body('adjustments').isObject().withMessage('Valid adjustments object is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const ruleData = { ...req.body, id: parseInt(id) };
    const userId = req.user.id;

    const result = await DynamicPricingService.savePricingRule(ruleData, userId);
    res.json(result);
  } catch (error) {
    console.error('Error updating pricing rule:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// DELETE /api/dynamic-pricing/rules/:id - Delete a pricing rule
router.delete('/rules/:id', authenticateToken, authorizeRoles('admin', 'manager'), [
  param('id').isInt().withMessage('Valid rule ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await DynamicPricingService.deletePricingRule(id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting pricing rule:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// GET /api/dynamic-pricing/customer-tiers - Get customer pricing tiers
router.get('/customer-tiers', authenticateToken, authorizeRoles('admin', 'manager', 'technician'), async (req, res) => {
  try {
    const tiers = await DynamicPricingService.getCustomerTiers();
    res.json(tiers);
  } catch (error) {
    console.error('Error fetching customer tiers:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/dynamic-pricing/customer-tiers - Create a new customer tier
router.post('/customer-tiers', authenticateToken, authorizeRoles('admin', 'manager'), [
  body('name').notEmpty().withMessage('Tier name is required'),
  body('description').optional().isString(),
  body('discount_percentage').isDecimal().withMessage('Valid discount percentage is required'),
  body('minimum_rentals').isInt().withMessage('Valid minimum rentals is required'),
  body('minimum_total_spent').isDecimal().withMessage('Valid minimum total spent is required'),
  body('is_active').optional().isBoolean()
], handleValidationErrors, async (req, res) => {
  try {
    const tierData = req.body;
    const result = await DynamicPricingService.createCustomerTier(tierData);
    res.json(result);
  } catch (error) {
    console.error('Error creating customer tier:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// PUT /api/dynamic-pricing/customer-tiers/:id - Update a customer tier
router.put('/customer-tiers/:id', authenticateToken, authorizeRoles('admin', 'manager'), [
  param('id').isInt().withMessage('Valid tier ID is required'),
  body('name').notEmpty().withMessage('Tier name is required'),
  body('description').optional().isString(),
  body('discount_percentage').isDecimal().withMessage('Valid discount percentage is required'),
  body('minimum_rentals').isInt().withMessage('Valid minimum rentals is required'),
  body('minimum_total_spent').isDecimal().withMessage('Valid minimum total spent is required'),
  body('is_active').optional().isBoolean()
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const tierData = req.body;
    const result = await DynamicPricingService.updateCustomerTier(id, tierData);
    res.json(result);
  } catch (error) {
    console.error('Error updating customer tier:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// DELETE /api/dynamic-pricing/customer-tiers/:id - Delete a customer tier
router.delete('/customer-tiers/:id', authenticateToken, authorizeRoles('admin', 'manager'), [
  param('id').isInt().withMessage('Valid tier ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await DynamicPricingService.deleteCustomerTier(id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting customer tier:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// POST /api/dynamic-pricing/customer-tiers/assign - Assign customer to tier
router.post('/customer-tiers/assign', authenticateToken, authorizeRoles('admin', 'manager'), [
  body('customer_id').isInt().withMessage('Valid customer ID is required'),
  body('tier_id').isInt().withMessage('Valid tier ID is required'),
  body('expires_at').optional().isISO8601().withMessage('Valid expiration date is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { customer_id, tier_id, expires_at } = req.body;
    const userId = req.user.id;

    const result = await DynamicPricingService.assignCustomerTier(customer_id, tier_id, userId, expires_at);
    res.json(result);
  } catch (error) {
    console.error('Error assigning customer tier:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// GET /api/dynamic-pricing/customer-tiers/:customerId - Get customer's current tier
router.get('/customer-tiers/:customerId', authenticateToken, authorizeRoles('admin', 'manager', 'technician'), [
  param('customerId').isInt().withMessage('Valid customer ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { customerId } = req.params;
    const tier = await DynamicPricingService.getCustomerTier(customerId);
    res.json(tier);
  } catch (error) {
    console.error('Error fetching customer tier:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/dynamic-pricing/demand-tracking - Update demand tracking
router.post('/demand-tracking', authenticateToken, authorizeRoles('admin', 'manager'), [
  body('rental_machine_id').isInt().withMessage('Valid rental machine ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('demand_level').isIn(['low', 'medium', 'high', 'peak']).withMessage('Valid demand level is required'),
  body('utilization_percentage').optional().isDecimal().withMessage('Valid utilization percentage is required'),
  body('booking_requests').optional().isInt().withMessage('Valid booking requests count is required'),
  body('completed_rentals').optional().isInt().withMessage('Valid completed rentals count is required'),
  body('cancelled_rentals').optional().isInt().withMessage('Valid cancelled rentals count is required'),
  body('average_rental_duration').optional().isDecimal().withMessage('Valid average rental duration is required')
], handleValidationErrors, async (req, res) => {
  try {
    const demandData = req.body;
    const result = await DynamicPricingService.updateDemandTracking(
      demandData.rental_machine_id,
      demandData.date,
      demandData
    );
    res.json(result);
  } catch (error) {
    console.error('Error updating demand tracking:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// GET /api/dynamic-pricing/demand-analytics - Get demand analytics
router.get('/demand-analytics', authenticateToken, authorizeRoles('admin', 'manager', 'technician'), [
  query('dateRange').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Valid date range is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const analytics = await DynamicPricingService.getDemandAnalytics(dateRange);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching demand analytics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/dynamic-pricing/history/:machineId - Get pricing history for a machine
router.get('/history/:machineId', authenticateToken, authorizeRoles('admin', 'manager', 'technician'), [
  param('machineId').isInt().withMessage('Valid machine ID is required'),
  query('limit').optional().isInt().withMessage('Valid limit is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { machineId } = req.params;
    const { limit = 50 } = req.query;
    const history = await DynamicPricingService.getPricingHistory(machineId, limit);
    res.json(history);
  } catch (error) {
    console.error('Error fetching pricing history:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/dynamic-pricing/simulation - Run pricing simulation
router.post('/simulation', authenticateToken, authorizeRoles('admin', 'manager'), [
  body('rental_machine_id').isInt().withMessage('Valid rental machine ID is required'),
  body('scenarios').isArray().withMessage('Valid scenarios array is required'),
  body('scenarios.*.start_date').isISO8601().withMessage('Valid start date is required'),
  body('scenarios.*.end_date').isISO8601().withMessage('Valid end date is required'),
  body('scenarios.*.customer_id').optional().isInt().withMessage('Valid customer ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { rental_machine_id, scenarios } = req.body;
    const results = await DynamicPricingService.getPricingSimulation(rental_machine_id, scenarios);
    res.json(results);
  } catch (error) {
    console.error('Error running pricing simulation:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// POST /api/dynamic-pricing/auto-assign-tiers - Auto-assign customer tiers
router.post('/auto-assign-tiers', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const result = await DynamicPricingService.autoAssignCustomerTiers();
    res.json(result);
  } catch (error) {
    console.error('Error auto-assigning customer tiers:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

module.exports = router;
