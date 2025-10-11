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

  /**
   * Generate quote PDF
   * @param {Object} quoteData - Quote data from database
   * @returns {Buffer} PDF buffer
   */
  static async generateQuotePDF(quoteData) {
    console.log('[PDF Service] Generating quote PDF for:', quoteData.id);
    
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Capture console logs and errors from the page
      page.on('console', msg => console.log('[PDF Page Console]:', msg.text()));
      page.on('pageerror', error => console.error('[PDF Page Error]:', error));
      
      // Load HTML template
      const templatePath = path.join(__dirname, '../templates/quote.html');
      console.log('[PDF Service] Template path:', templatePath);
      let html = fs.readFileSync(templatePath, 'utf8');
      console.log('[PDF Service] Template loaded, length:', html.length);
      
      // Replace placeholders with actual data
      html = this.replaceQuoteTemplatePlaceholders(html, quoteData);
      console.log('[PDF Service] Template processed');
      
      // Debug: Save processed HTML (always save for debugging)
      const debugHtmlPath = path.join(__dirname, '../debug-quote.html');
      fs.writeFileSync(debugHtmlPath, html, 'utf8');
      console.log('[PDF Service] Debug HTML saved to:', debugHtmlPath);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      console.log('[PDF Service] Page content set');
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      console.log('[PDF Service] PDF generated successfully, buffer size:', pdfBuffer.length);
      
      // Validate PDF buffer is not empty
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Generated PDF buffer is empty');
      }
      
      console.log('[PDF Service] PDF validation passed!');
      return pdfBuffer;
    } catch (error) {
      console.error('[PDF Service] Error generating quote PDF:', error);
      console.error('[PDF Service] Error stack:', error.stack);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * Replace placeholders in quote template
   */
  static replaceQuoteTemplatePlaceholders(html, quoteData) {
    // Company information
    const companyInfo = {
      COMPANY_NAME: 'Kamer BA',
      COMPANY_ADDRESS: 'Your Company Address',
      COMPANY_CITY: 'Your City',
      COMPANY_POSTAL_CODE: '71000',
      COMPANY_PHONE: '+387 XX XXX XXX',
      COMPANY_EMAIL: 'info@kamerba.com',
      COMPANY_VAT: 'VAT: XXXXXXXXXX'
    };

    // Format items HTML
    let itemsHTML = '';
    if (quoteData.items && Array.isArray(quoteData.items)) {
      quoteData.items.forEach((item, index) => {
        const categoryBadge = item.category ? `<span class="item-category">${item.category}</span>` : '';
        itemsHTML += `
          <tr>
            <td class="text-center">${index + 1}</td>
            <td>
              <div class="item-name">${this.escapeHtml(item.item_name || '')}</div>
              ${item.description ? `<div class="item-description">${this.escapeHtml(item.description)}</div>` : ''}
            </td>
            <td>${categoryBadge}</td>
            <td class="text-center">${item.quantity || 0}</td>
            <td class="text-right">${this.formatCurrency(item.unit_price || 0)}</td>
            <td class="text-right">${this.formatCurrency(item.total_price || 0)}</td>
          </tr>
        `;
      });
    }

    // Prepare replacements
    const replacements = {
      ...companyInfo,
      QUOTE_NUMBER: quoteData.formatted_number || quoteData.quote_number || quoteData.id,
      QUOTE_DATE: this.formatDate(quoteData.created_at),
      VALID_UNTIL: this.formatDate(quoteData.valid_until),
      STATUS: this.formatStatus(quoteData.status),
      QUOTE_TITLE: this.escapeHtml(quoteData.title || ''),
      QUOTE_DESCRIPTION: this.escapeHtml(quoteData.description || ''),
      CUSTOMER_NAME: this.escapeHtml(quoteData.customer_name || ''),
      CUSTOMER_COMPANY: this.escapeHtml(quoteData.customer_company || quoteData.company_name || ''),
      CUSTOMER_ADDRESS: this.escapeHtml(quoteData.customer_address || quoteData.street_address || ''),
      CUSTOMER_CITY: this.escapeHtml(quoteData.customer_city || quoteData.city || ''),
      CUSTOMER_POSTAL_CODE: this.escapeHtml(quoteData.customer_postal_code || quoteData.postal_code || ''),
      CUSTOMER_VAT: this.escapeHtml(quoteData.customer_vat || quoteData.vat_number || ''),
      CUSTOMER_PHONE: this.escapeHtml(quoteData.customer_phone || quoteData.phone || ''),
      CUSTOMER_EMAIL: this.escapeHtml(quoteData.customer_email || quoteData.email || ''),
      ITEMS: itemsHTML,
      SUBTOTAL: this.formatCurrency(quoteData.subtotal || 0),
      DISCOUNT_PERCENTAGE: quoteData.discount_percentage || 0,
      DISCOUNT_AMOUNT: this.formatCurrency(quoteData.discount_amount || 0),
      TAX_RATE: quoteData.tax_rate || 0,
      TAX_AMOUNT: this.formatCurrency(quoteData.tax_amount || 0),
      TOTAL_AMOUNT: this.formatCurrency(quoteData.total_amount || 0),
      PAYMENT_TERMS: this.escapeHtml(quoteData.payment_terms || ''),
      DELIVERY_TERMS: this.escapeHtml(quoteData.delivery_terms || ''),
      NOTES: this.escapeHtml(quoteData.notes || ''),
      TERMS_CONDITIONS: this.escapeHtml(quoteData.terms_conditions || ''),
      CREATED_BY_NAME: this.escapeHtml(quoteData.created_by_name || 'System'),
      GENERATED_DATE: this.formatDate(new Date().toISOString()),
      IS_EXPIRING_SOON: this.isExpiringSoon(quoteData.valid_until)
    };

    // Replace all placeholders
    Object.keys(replacements).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(replacements[key] || ''));
    });

    // Handle conditional blocks
    html = html.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
      return replacements[condition] ? content : '';
    });

    return html;
  }

  /**
   * Format currency for PDF
   */
  static formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return num.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' KM';
  }

  /**
   * Check if quote is expiring soon
   */
  static isExpiringSoon(validUntil) {
    if (!validUntil) return false;
    const expiryDate = new Date(validUntil);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  }

  /**
   * Escape HTML special characters
   */
  static escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }
}

module.exports = PDFService;
