const express = require('express');
const router = express.Router();
const schedulerService = require('../services/scheduler');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/scheduler/status - Get scheduler status
router.get('/status', authenticateToken, authorizeRoles('admin', 'manager'), (req, res) => {
  try {
    const status = schedulerService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/scheduler/trigger/reserved-to-active - Manually trigger reserved to active update
router.post('/trigger/reserved-to-active', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const result = await schedulerService.triggerReservedToActiveUpdate();
    res.json({
      success: true,
      message: `Successfully updated ${result.updated} reserved rentals to active`,
      data: result
    });
  } catch (error) {
    console.error('Error triggering reserved to active update:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/scheduler/trigger/overdue - Manually trigger overdue update
router.post('/trigger/overdue', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const result = await schedulerService.triggerOverdueUpdate();
    res.json({
      success: true,
      message: `Successfully updated ${result.updated} rentals to overdue`,
      data: result
    });
  } catch (error) {
    console.error('Error triggering overdue update:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
