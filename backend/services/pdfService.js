const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class PDFService {
  /**
   * Generate repair ticket PDF
   * @param {Object} ticketData - Ticket data from database
   * @param {string} type - 'repair' or 'warranty'
   * @returns {Buffer} PDF buffer
   */
  static async generateRepairTicketPDF(ticketData, type = 'repair') {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Load HTML template
      const templatePath = path.join(__dirname, `../templates/${type}-ticket.html`);
      console.log('Template path:', templatePath);
      let html = fs.readFileSync(templatePath, 'utf8');
      console.log('Template loaded, length:', html.length);
      
      // Replace placeholders with actual data
      html = this.replaceTemplatePlaceholders(html, ticketData, type);
      console.log('Template processed, length:', html.length);
      console.log('Sample of processed HTML:', html.substring(0, 500));
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      console.log('Page content set successfully');
      
      // Generate PDF
      console.log('Starting PDF generation with Puppeteer...');
      try {
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm'
          },
          displayHeaderFooter: false
        });
        console.log('PDF generated successfully, buffer size:', pdf.length);
        return pdf;
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError);
        throw pdfError;
      }
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate work order PDF
   * @param {Object} workOrderData - Work order data from database
   * @param {string} type - 'work_order' or 'warranty_work_order'
   * @returns {Buffer} PDF buffer
   */
  static async generateWorkOrderPDF(workOrderData, type = 'work_order') {
    console.log('Generating work order PDF for:', workOrderData.id, 'type:', type);
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Load HTML template
      const templatePath = path.join(__dirname, `../templates/${type === 'warranty_work_order' ? 'warranty-work-order' : 'work-order'}.html`);
      console.log('Template path:', templatePath);
      let html = fs.readFileSync(templatePath, 'utf8');
      console.log('Template loaded, length:', html.length);
      
      // Replace placeholders with actual data
      html = this.replaceWorkOrderTemplatePlaceholders(html, workOrderData, type);
      console.log('Template processed, length:', html.length);
      console.log('Sample of processed HTML:', html.substring(0, 500));
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm'
        }
      });
      
      console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes');
      return pdfBuffer;
      
    } catch (error) {
      console.error('Error generating work order PDF:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * Replace template placeholders with actual data
   * @param {string} html - HTML template
   * @param {Object} ticketData - Ticket data
   * @param {string} type - Ticket type
   * @returns {string} Processed HTML
   */
  static replaceTemplatePlaceholders(html, ticketData, type) {
    console.log('Replacing placeholders for ticket data:', JSON.stringify(ticketData, null, 2));
    const replacements = {
      // Header
      '{{TICKET_TYPE}}': type === 'repair' ? 'REPAIR TICKET' : 'WARRANTY REPAIR TICKET',
      '{{FORMATTED_NUMBER}}': ticketData.formatted_number || `#${ticketData.id}`,
      '{{CREATED_AT}}': this.formatDate(ticketData.created_at),
      '{{CURRENT_DATE}}': this.formatDate(new Date()),
      
      // Customer Information
      '{{CUSTOMER_NAME}}': ticketData.customer_name || 'N/A',
      '{{CUSTOMER_TYPE}}': ticketData.customer_type || 'private',
      '{{CUSTOMER_TYPE_BADGE}}': ticketData.customer_type === 'company' ? 'Company' : 'Private',
      '{{COMPANY_NAME}}': ticketData.company_name || 'N/A',
      '{{CONTACT_PERSON}}': ticketData.contact_person || 'N/A',
      '{{PHONE1}}': ticketData.phone1 || 'N/A',
      '{{PHONE2}}': ticketData.phone2 || 'N/A',
      '{{EMAIL}}': ticketData.email || 'N/A',
      '{{CITY}}': ticketData.city || 'N/A',
      '{{POSTAL_CODE}}': ticketData.postal_code || 'N/A',
      '{{STREET_ADDRESS}}': ticketData.street_address || 'N/A',
      
      // Machine Information
      '{{MANUFACTURER}}': ticketData.manufacturer || 'N/A',
      '{{MODEL_NAME}}': ticketData.model_name || 'N/A',
      '{{SERIAL_NUMBER}}': ticketData.serial_number || 'N/A',
      '{{CATEGORY_NAME}}': ticketData.category_name || 'N/A',
      '{{CATALOGUE_NUMBER}}': ticketData.catalogue_number || 'N/A',
      '{{BOUGHT_AT}}': this.formatDate(ticketData.bought_at),
      '{{PURCHASE_DATE}}': this.formatDate(ticketData.purchase_date),
      
      // Problem Description
      '{{PROBLEM_DESCRIPTION}}': ticketData.problem_description || 'N/A',
      '{{ADDITIONAL_EQUIPMENT}}': ticketData.additional_equipment || 'N/A',
      '{{BROUGHT_BY}}': ticketData.brought_by || 'N/A',
      '{{NOTES}}': ticketData.notes || 'N/A',
      
      // Service Information
      '{{STATUS}}': this.formatStatus(ticketData.status),
      '{{PRIORITY}}': this.formatPriority(ticketData.priority),
      '{{SUBMITTED_BY_NAME}}': ticketData.submitted_by_name || 'N/A',
      '{{OWNER_NAME}}': ticketData.owner_name || 'N/A',
      
      // Warranty Information (for warranty tickets)
      '{{WARRANTY_EXPIRY_DATE}}': this.formatDate(ticketData.warranty_expiry_date),
      '{{WARRANTY_STATUS}}': ticketData.warranty_active ? 'Aktivna' : 'Neaktivna',
      '{{WARRANTY_ACTIVE}}': ticketData.warranty_active ? 'DA' : 'NE',
      
      // Footer
      '{{GENERATION_TIMESTAMP}}': new Date().toLocaleString('bs-BA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    // Replace all placeholders
    let processedHtml = html;
    for (const [placeholder, value] of Object.entries(replacements)) {
      processedHtml = processedHtml.replace(new RegExp(placeholder, 'g'), value);
    }

    console.log('Placeholder replacement completed. Sample replacements:');
    console.log('TICKET_TYPE:', replacements['{{TICKET_TYPE}}']);
    console.log('CUSTOMER_NAME:', replacements['{{CUSTOMER_NAME}}']);
    console.log('PROBLEM_DESCRIPTION:', replacements['{{PROBLEM_DESCRIPTION}}']);

    return processedHtml;
  }

  /**
   * Format date for display
   * @param {string|Date} date - Date to format
   * @returns {string} Formatted date
   */
  static formatDate(date) {
    if (!date) return 'N/A';
    
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString('bs-BA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  /**
   * Format status for display
   * @param {string} status - Status value
   * @returns {string} Formatted status
   */
  static formatStatus(status) {
    if (!status) return 'N/A';
    
    const statusMap = {
      'pending': 'Pending',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'on_hold': 'On Hold'
    };
    
    return statusMap[status] || status;
  }

  /**
   * Format priority for display
   * @param {string} priority - Priority value
   * @returns {string} Formatted priority
   */
  static formatPriority(priority) {
    if (!priority) return 'N/A';
    
    const priorityMap = {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
      'urgent': 'Urgent'
    };
    
    return priorityMap[priority] || priority;
  }

  /**
   * Generate filename for PDF
   * @param {Object} ticketData - Ticket data
   * @param {string} type - Ticket type
   * @returns {string} Filename
   */
  static generateFilename(ticketData, type) {
    const ticketNumber = ticketData.formatted_number || ticketData.id;
    const date = new Date().toISOString().split('T')[0];
    return `${type}-ticket-${ticketNumber}-${date}.pdf`;
  }

  /**
   * Replace work order template placeholders with actual data
   * @param {string} html - HTML template
   * @param {Object} workOrderData - Work order data
   * @param {string} type - Type of work order
   * @returns {string} Processed HTML
   */
  static replaceWorkOrderTemplatePlaceholders(html, workOrderData, type) {
    console.log('Replacing work order placeholders for data:', JSON.stringify(workOrderData, null, 2));
    const replacements = {
      // Header
      '{{WORK_ORDER_TYPE}}': type === 'warranty_work_order' ? 'WARRANTY WORK ORDER' : 'WORK ORDER',
      '{{FORMATTED_NUMBER}}': workOrderData.formatted_number || `#${workOrderData.id}`,
      '{{CREATED_AT}}': this.formatDate(workOrderData.created_at),
      '{{CURRENT_DATE}}': this.formatDate(new Date()),
      
      // Customer Information
      '{{CUSTOMER_NAME}}': workOrderData.customer_name || 'N/A',
      '{{CUSTOMER_PHONE}}': workOrderData.customer_phone || 'N/A',
      '{{CUSTOMER_EMAIL}}': workOrderData.customer_email || 'N/A',
      '{{CUSTOMER_COMPANY}}': workOrderData.customer_company || 'N/A',
      '{{CUSTOMER_ADDRESS}}': workOrderData.customer_address || 'N/A',
      '{{CUSTOMER_CITY}}': workOrderData.customer_city || 'N/A',
      
      // Machine Information
      '{{MACHINE_NAME}}': workOrderData.model_name || 'N/A',
      '{{CATALOGUE_NUMBER}}': workOrderData.catalogue_number || 'N/A',
      '{{SERIAL_NUMBER}}': workOrderData.serial_number || 'N/A',
      '{{TECHNICIAN_NAME}}': workOrderData.technician_name || 'N/A',
      '{{OWNER_TECHNICIAN_NAME}}': workOrderData.owner_technician_name || 'N/A',
      
      // Work Order Details
      '{{DESCRIPTION}}': workOrderData.description || 'N/A',
      '{{STARTED_AT}}': this.formatDate(workOrderData.started_at),
      '{{COMPLETED_AT}}': this.formatDate(workOrderData.completed_at),
      '{{LABOR_HOURS}}': workOrderData.labor_hours || 'N/A',
      '{{LABOR_RATE}}': workOrderData.labor_rate ? `${workOrderData.labor_rate}` : 'N/A',
      '{{TROUBLESHOOTING_FEE}}': workOrderData.troubleshooting_fee ? `${workOrderData.troubleshooting_fee}` : '0',
      '{{TOTAL_COST}}': workOrderData.total_cost ? `${workOrderData.total_cost}` : '0',
      '{{NOTES}}': workOrderData.notes || 'N/A',
      '{{INVENTORY_ITEMS}}': this.formatInventoryItems(workOrderData.inventory_items),
      
      // Warranty Information (for warranty work orders)
      '{{WARRANTY_EXPIRY_DATE}}': this.formatDate(workOrderData.warranty_expiry_date),
      '{{WARRANTY_STATUS}}': workOrderData.warranty_active ? 'Aktivna' : 'Neaktivna',
      
      // Footer
      '{{GENERATION_TIMESTAMP}}': new Date().toLocaleString('bs-BA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    // Replace all placeholders
    let processedHtml = html;
    for (const [placeholder, value] of Object.entries(replacements)) {
      processedHtml = processedHtml.replace(new RegExp(placeholder, 'g'), value);
    }

    console.log('Work order placeholder replacement completed. Sample replacements:');
    console.log('WORK_ORDER_TYPE:', replacements['{{WORK_ORDER_TYPE}}']);
    console.log('CUSTOMER_NAME:', replacements['{{CUSTOMER_NAME}}']);
    console.log('DESCRIPTION:', replacements['{{DESCRIPTION}}']);

    return processedHtml;
  }

  /**
   * Generate filename for work order PDF
   * @param {Object} workOrderData - Work order data
   * @param {string} type - Type of work order
   * @returns {string} Generated filename
   */
  static generateWorkOrderFilename(workOrderData, type) {
    const prefix = type === 'warranty_work_order' ? 'warranty-work-order' : 'work-order';
    const number = workOrderData.formatted_number || workOrderData.id;
    const date = new Date().toISOString().split('T')[0];
    return `${prefix}-${number}-${date}.pdf`;
  }

  static formatInventoryItems(inventoryItems) {
    if (!inventoryItems || !Array.isArray(inventoryItems) || inventoryItems.length === 0) {
      return 'Nema korištenih dijelova';
    }

    return inventoryItems.map(item => {
      const sku = item.sku || item.part_number || 'N/A';
      return `${item.name} (${item.quantity}x) - SKU: ${sku}`;
    }).join('\n');
  }
}

module.exports = PDFService;
