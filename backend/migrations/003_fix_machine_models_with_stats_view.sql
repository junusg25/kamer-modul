-- Migration: Fix machine_models_with_stats view to include warranty_months and proper stats
-- This fixes the issue where machine models from the list don't have 'id' and 'warranty_months' fields

-- Drop and recreate the view with all necessary fields
DROP VIEW IF EXISTS machine_models_with_stats CASCADE;

CREATE VIEW machine_models_with_stats AS
SELECT 
    mm.id,
    mm.name,
    mm.catalogue_number,
    mm.manufacturer,
    mm.category_id,
    mm.description,
    mm.warranty_months,  -- Added warranty_months field
    mm.created_at,
    mm.updated_at,
    mc.name AS category_name,
    
    -- Serial counts
    COUNT(ms.id) AS total_serials,
    COUNT(CASE WHEN ms.status = 'assigned' THEN 1 END) AS assigned_serials,
    COUNT(CASE WHEN ms.status = 'available' THEN 1 END) AS unassigned_serials,
    
    -- Assignment counts from assigned_machines
    COUNT(DISTINCT am.id) AS total_assigned,
    
    -- Warranty stats from assigned_machines
    COUNT(CASE WHEN am.warranty_expiry_date IS NOT NULL AND am.warranty_expiry_date > CURRENT_DATE THEN 1 END) AS active_warranty,
    COUNT(CASE WHEN am.warranty_expiry_date IS NOT NULL AND am.warranty_expiry_date <= CURRENT_DATE THEN 1 END) AS expired_warranty,
    
    -- Sales stats
    COUNT(CASE WHEN am.is_sale = true THEN 1 END) AS total_sales,
    COUNT(CASE WHEN am.is_sale = false THEN 1 END) AS total_assignments,
    SUM(CASE WHEN am.is_sale = true THEN am.sale_price ELSE 0 END) AS total_sales_revenue,
    AVG(CASE WHEN am.is_sale = true AND am.sale_price IS NOT NULL THEN am.sale_price END) AS avg_sale_price,
    
    -- Machine condition stats
    COUNT(CASE WHEN am.machine_condition = 'new' AND am.is_sale = true THEN 1 END) AS new_machines_sold,
    COUNT(CASE WHEN am.machine_condition = 'used' AND am.is_sale = true THEN 1 END) AS used_machines_sold,
    
    -- Timestamps
    MIN(ms.created_at) AS first_serial_created,
    MAX(ms.created_at) AS last_serial_created
    
FROM machine_models mm
LEFT JOIN machine_categories mc ON mm.category_id = mc.id
LEFT JOIN machine_serials ms ON mm.id = ms.model_id
LEFT JOIN assigned_machines am ON ms.id = am.serial_id
GROUP BY mm.id, mm.name, mm.catalogue_number, mm.manufacturer, mm.category_id, mm.description, mm.warranty_months, mm.created_at, mm.updated_at, mc.name;

-- Grant permissions
GRANT SELECT ON machine_models_with_stats TO admin;

-- Verify the view includes all necessary fields
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'machine_models_with_stats' 
ORDER BY ordinal_position;

