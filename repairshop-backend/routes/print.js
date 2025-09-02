const express = require('express')
const router = express.Router()
const db = require('../db')

function escape(str) {
  return String(str).replace(/[&<>"']/g, (match) => {
    const escape = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return escape[match]
  })
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
}

router.get('/ticket/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT rt.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             m.name as machine_name, m.serial_number
      FROM repair_tickets rt
      LEFT JOIN customers c ON c.id = rt.customer_id
      LEFT JOIN machines m ON m.id = rt.machine_id
      WHERE rt.id = $1
    `, [req.params.id])
    if (!rows.length) return res.status(404).send('Not found')
    const rt = rows[0]

    const label = rt.formatted_number || `Repair Ticket #${escape(String(rt.id))}`

    const html = `<!doctype html>
    <html><head>
      <meta charset="utf-8" />
      <title>${label}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; }
        h1 { font-size: 20px; margin-bottom: 8px; }
        .section { margin-bottom: 12px; }
        .label { color: #555; font-size: 12px; }
        .value { font-weight: bold; }
        .box { border: 1px solid #ddd; padding: 12px; border-radius: 6px; }
      </style>
    </head>
    <body>
      <h1>${label}</h1>
      <div class="section box">
        <div class="label">Customer</div>
        <div class="value">${escape(rt.customer_name || '')} (${escape(rt.customer_phone || '-')}) ${escape(rt.customer_email || '')}</div>
      </div>
      <div class="section box">
        <div class="label">Machine</div>
        <div class="value">${escape(rt.machine_name || '')} SN: ${escape(rt.serial_number || '-')}</div>
      </div>
      <div class="section box">
        <div class="label">Problem Description</div>
        <div>${escape(rt.problem_description || '')}</div>
      </div>
      <div class="section box">
        <div>Status: <strong>${escape(rt.status)}</strong></div>
        <div>Created: ${escape(new Date(rt.created_at).toLocaleString())}</div>
      </div>
    </body></html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  } catch (err) {
    console.error(err)
    res.status(500).send('Failed to render ticket')
  }
})

router.get('/workorder/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT wo.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
             m.name as machine_name, m.serial_number
      FROM work_orders wo
      LEFT JOIN customers c ON c.id = wo.customer_id
      LEFT JOIN machines m ON m.id = wo.machine_id
      WHERE wo.id = $1
    `, [req.params.id])
    if (!rows.length) return res.status(404).send('Not found')
    const wo = rows[0]
    
    const workOrderNumber = wo.formatted_number || `Work Order #${escape(String(wo.id))}`
    
    const html = `<!doctype html>
    <html><head>
      <meta charset="utf-8" />
      <title>${workOrderNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; }
        h1 { font-size: 20px; margin-bottom: 8px; }
        .section { margin-bottom: 12px; }
        .label { color: #555; font-size: 12px; }
        .value { font-weight: bold; }
        .box { border: 1px solid #ddd; padding: 12px; border-radius: 6px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      </style>
    </head>
    <body>
      <h1>${workOrderNumber}</h1>
      <div class="grid">
        <div class="section box">
          <div class="label">Customer</div>
          <div class="value">${escape(wo.customer_name || '')} (${escape(wo.customer_phone || '-')}) ${escape(wo.customer_email || '')}</div>
        </div>
        <div class="section box">
          <div class="label">Machine</div>
          <div class="value">${escape(wo.machine_name || '')} SN: ${escape(wo.serial_number || '-')}</div>
        </div>
      </div>
      <div class="section box">
        <div class="label">Description</div>
        <div>${escape(wo.description || '')}</div>
      </div>
      <div class="grid">
        <div class="section box">
          <div>Status: <strong>${escape(wo.status)}</strong></div>
        </div>
        <div class="section box">
          <div>Labor Hours: ${escape(wo.labor_hours || '-')}</div>
          <div>Labor Rate: ${formatCurrency(wo.labor_rate)}</div>
          <div>Parts Subtotal: ${formatCurrency(wo.quote_subtotal_parts)}</div>
          <div>Quote Total: ${formatCurrency(wo.quote_total)}</div>
        </div>
      </div>
      <div class="section box">
        <div>Created: ${escape(new Date(wo.created_at).toLocaleString())}</div>
        ${wo.completed_at ? `<div>Completed: ${escape(new Date(wo.completed_at).toLocaleString())}</div>` : ''}
      </div>
    </body></html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  } catch (err) {
    console.error(err)
    res.status(500).send('Failed to render work order')
  }
})

module.exports = router


