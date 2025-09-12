const express = require('express');
const router = express.Router();
const db = require('../db');
const PDFService = require('../services/pdfService');
const { param } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validators');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * GET /api/print/repair-ticket/:id
 * Generate and return repair ticket PDF
 */
router.get('/repair-ticket/:id', [
  authenticateToken,
  authorizeRoles('admin', 'technician', 'manager', 'sales'),
  param('id').isInt().withMessage('Invalid ticket ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    console.log('Print route accessed by user:', req.user);
    const ticketId = req.params.id;

    // Get repair ticket data from view
    const result = await db.query(
      'SELECT * FROM repair_tickets_view WHERE id = $1',
      [ticketId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Repair ticket not found'
      });
    }

    const ticketData = result.rows[0];

    // Generate PDF
    const pdfBuffer = await PDFService.generateRepairTicketPDF(ticketData, 'repair');

    // Set response headers
    const filename = PDFService.generateFilename(ticketData, 'repair');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.end(pdfBuffer);

  } catch (error) {
    console.error('Error generating repair ticket PDF:', error);
    next(error);
  }
});

/**
 * GET /api/print/warranty-ticket/:id
 * Generate and return warranty repair ticket PDF
 */
router.get('/warranty-ticket/:id', [
  authenticateToken,
  authorizeRoles('admin', 'technician', 'manager', 'sales'),
  param('id').isInt().withMessage('Invalid ticket ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const ticketId = req.params.id;

    // Get warranty repair ticket data from view
    const result = await db.query(
      'SELECT * FROM warranty_repair_tickets_view WHERE id = $1',
      [ticketId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Warranty repair ticket not found'
      });
    }

    const ticketData = result.rows[0];

    // Generate PDF
    const pdfBuffer = await PDFService.generateRepairTicketPDF(ticketData, 'warranty');

    // Set response headers
    const filename = PDFService.generateFilename(ticketData, 'warranty');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.end(pdfBuffer);

  } catch (error) {
    console.error('Error generating warranty ticket PDF:', error);
    next(error);
  }
});

/**
 * GET /api/print/work-order/:id
 * Generate and return work order PDF
 */
router.get('/work-order/:id', [
  authenticateToken,
  authorizeRoles('admin', 'technician', 'manager', 'sales'),
  param('id').isInt().withMessage('Invalid work order ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const workOrderId = req.params.id;

    // Get work order data from view
    const result = await db.query(
      'SELECT * FROM work_orders_view WHERE id = $1',
      [workOrderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Work order not found'
      });
    }

    const workOrderData = result.rows[0];

    // Generate PDF
    const pdfBuffer = await PDFService.generateWorkOrderPDF(workOrderData, 'work_order');

    // Set response headers
    const filename = PDFService.generateWorkOrderFilename(workOrderData, 'work_order');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.end(pdfBuffer);

  } catch (error) {
    console.error('Error generating work order PDF:', error);
    next(error);
  }
});

/**
 * GET /api/print/warranty-work-order/:id
 * Generate and return warranty work order PDF
 */
router.get('/warranty-work-order/:id', [
  authenticateToken,
  authorizeRoles('admin', 'technician', 'manager', 'sales'),
  param('id').isInt().withMessage('Invalid warranty work order ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const workOrderId = req.params.id;

    // Get warranty work order data from view
    const result = await db.query(
      'SELECT * FROM warranty_work_orders_view WHERE id = $1',
      [workOrderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Warranty work order not found'
      });
    }

    const workOrderData = result.rows[0];

    // Generate PDF
    const pdfBuffer = await PDFService.generateWorkOrderPDF(workOrderData, 'warranty_work_order');

    // Set response headers
    const filename = PDFService.generateWorkOrderFilename(workOrderData, 'warranty_work_order');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.end(pdfBuffer);

  } catch (error) {
    console.error('Error generating warranty work order PDF:', error);
    next(error);
  }
});

/**
 * GET /api/print/repair-ticket/:id/preview
 * Generate and return repair ticket PDF for preview (inline display)
 */
router.get('/repair-ticket/:id/preview', [
  authenticateToken,
  authorizeRoles('admin', 'technician', 'manager', 'sales'),
  param('id').isInt().withMessage('Invalid ticket ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const ticketId = req.params.id;

    // Get repair ticket data from view
    const result = await db.query(
      'SELECT * FROM repair_tickets_view WHERE id = $1',
      [ticketId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Repair ticket not found'
      });
    }

    const ticketData = result.rows[0];

    // Generate PDF
    const pdfBuffer = await PDFService.generateRepairTicketPDF(ticketData, 'repair');

    // Set response headers for inline display
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating repair ticket PDF preview:', error);
    next(error);
  }
});

/**
 * GET /api/print/warranty-ticket/:id/preview
 * Generate and return warranty repair ticket PDF for preview (inline display)
 */
router.get('/warranty-ticket/:id/preview', [
  authenticateToken,
  authorizeRoles('admin', 'technician', 'manager', 'sales'),
  param('id').isInt().withMessage('Invalid ticket ID format'),
  handleValidationErrors
], async (req, res, next) => {
  try {
    const ticketId = req.params.id;

    // Get warranty repair ticket data from view
    const result = await db.query(
      'SELECT * FROM warranty_repair_tickets_view WHERE id = $1',
      [ticketId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Warranty repair ticket not found'
      });
    }

    const ticketData = result.rows[0];

    // Generate PDF
    const pdfBuffer = await PDFService.generateRepairTicketPDF(ticketData, 'warranty');

    // Set response headers for inline display
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating warranty ticket PDF preview:', error);
    next(error);
  }
});

module.exports = router;