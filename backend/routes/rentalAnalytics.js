const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const RentalAnalyticsService = require('../services/rentalAnalyticsService');

// GET /api/rental-analytics/overview - Get comprehensive rental analytics overview
router.get('/overview', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const overview = await RentalAnalyticsService.getRentalOverview(dateRange);
    res.json(overview);
  } catch (error) {
    console.error('Error fetching rental overview:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-analytics/fleet - Get fleet statistics
router.get('/fleet', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const fleetStats = await RentalAnalyticsService.getFleetStatistics();
    res.json(fleetStats);
  } catch (error) {
    console.error('Error fetching fleet statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-analytics/revenue - Get revenue statistics
router.get('/revenue', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const dateFilter = RentalAnalyticsService.getDateFilter(dateRange);
    const revenueStats = await RentalAnalyticsService.getRevenueStatistics(dateFilter);
    res.json(revenueStats);
  } catch (error) {
    console.error('Error fetching revenue statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-analytics/utilization - Get utilization statistics
router.get('/utilization', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const dateFilter = RentalAnalyticsService.getDateFilter(dateRange);
    const utilizationStats = await RentalAnalyticsService.getUtilizationStatistics(dateFilter);
    res.json(utilizationStats);
  } catch (error) {
    console.error('Error fetching utilization statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-analytics/customers - Get customer statistics
router.get('/customers', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const dateFilter = RentalAnalyticsService.getDateFilter(dateRange);
    const customerStats = await RentalAnalyticsService.getCustomerStatistics(dateFilter);
    res.json(customerStats);
  } catch (error) {
    console.error('Error fetching customer statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-analytics/status - Get status distribution
router.get('/status', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const statusStats = await RentalAnalyticsService.getStatusStatistics();
    res.json(statusStats);
  } catch (error) {
    console.error('Error fetching status statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-analytics/overdue - Get overdue rental statistics
router.get('/overdue', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const overdueStats = await RentalAnalyticsService.getOverdueStatistics();
    res.json(overdueStats);
  } catch (error) {
    console.error('Error fetching overdue statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-analytics/trends - Get rental trends over time
router.get('/trends', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const { dateRange = '30d', groupBy = 'day' } = req.query;
    const trends = await RentalAnalyticsService.getRentalTrends(dateRange, groupBy);
    res.json(trends);
  } catch (error) {
    console.error('Error fetching rental trends:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-analytics/machine-performance - Get machine performance analytics
router.get('/machine-performance', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const performance = await RentalAnalyticsService.getMachinePerformance(dateRange);
    res.json(performance);
  } catch (error) {
    console.error('Error fetching machine performance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-analytics/duration - Get rental duration analytics
router.get('/duration', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const durationAnalytics = await RentalAnalyticsService.getRentalDurationAnalytics(dateRange);
    res.json(durationAnalytics);
  } catch (error) {
    console.error('Error fetching duration analytics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-analytics/billing - Get billing period analytics
router.get('/billing', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const billingAnalytics = await RentalAnalyticsService.getBillingPeriodAnalytics(dateRange);
    res.json(billingAnalytics);
  } catch (error) {
    console.error('Error fetching billing analytics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/rental-analytics/realtime - Get real-time dashboard data
router.get('/realtime', authenticateToken, authorizeRoles('admin', 'manager', 'technician', 'sales'), async (req, res) => {
  try {
    const realTimeData = await RentalAnalyticsService.getRealTimeDashboard();
    res.json(realTimeData);
  } catch (error) {
    console.error('Error fetching real-time dashboard:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
