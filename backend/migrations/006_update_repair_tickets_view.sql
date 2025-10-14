-- Migration: Update repair_tickets_view to work with new sold/repair machines architecture
-- Date: 2025-01-14
-- Purpose: Fix repair tickets view to show correct machine data for repair machines

BEGIN;

-- =============================================
-- Step 1: Drop the existing view
-- =============================================

DROP VIEW IF EXISTS public.repair_tickets_view;

-- =============================================
-- Step 2: Recreate the view with correct joins
-- =============================================

CREATE VIEW public.repair_tickets_view AS
SELECT 
    rt.id,
    rt.ticket_number,
    rt.formatted_number,
    rt.year_created,
    rt.customer_id,
    c.name AS customer_name,
    c.customer_type,
    c.contact_person,
    c.company_name,
    c.vat_number,
    c.city,
    c.postal_code,
    c.street_address,
    c.phone AS phone1,
    c.phone2,
    c.fax,
    c.email,
    c.owner_id,
    c.assigned_at,
    c.ownership_notes,
    u_owner.name AS owner_name,
    rt.machine_id,
    
    -- Machine information (from machines table for repair machines)
    COALESCE(rm.name, mm.name) AS model_name,
    COALESCE(rm.manufacturer, mm.manufacturer) AS manufacturer,
    COALESCE(rm.catalogue_number, mm.catalogue_number) AS catalogue_number,
    COALESCE(rm.serial_number, ms.serial_number) AS serial_number,
    COALESCE(rm.category_id, mm.category_id) AS category_id,
    mc.name AS category_name,
    
    -- Purchase/receipt information (different sources)
    COALESCE(rm.received_date, am.purchase_date) AS purchase_date,
    COALESCE(rm.received_date, am.assigned_at) AS bought_at,
    am.receipt_number, -- Only sold machines have receipt numbers
    
    -- Warranty information
    COALESCE(rm.warranty_expiry_date, am.warranty_expiry_date) AS warranty_expiry_date,
    
    -- Ticket information
    rt.problem_description,
    rt.notes,
    rt.additional_equipment,
    rt.brought_by,
    rt.submitted_by,
    u.name AS submitted_by_name,
    rt.status,
    rt.priority,
    rt.converted_to_work_order_id,
    wo.formatted_number AS converted_work_order_formatted_number,
    wo.year_created AS converted_work_order_year_created,
    wo.owner_technician_id AS converted_by_technician_id,
    tech.name AS converted_by_technician_name,
    rt.converted_at,
    rt.created_at,
    rt.updated_at
FROM public.repair_tickets rt
LEFT JOIN public.customers c ON rt.customer_id = c.id
LEFT JOIN public.users u_owner ON c.owner_id = u_owner.id

-- Join with machines table (for repair machines)
LEFT JOIN public.machines rm ON rt.machine_id = rm.id

-- Join with sold_machines table (for sold machines)
LEFT JOIN public.sold_machines am ON rt.machine_id = am.id
LEFT JOIN public.machine_serials ms ON am.serial_id = ms.id
LEFT JOIN public.machine_models mm ON ms.model_id = mm.id

-- Join with machine categories
LEFT JOIN public.machine_categories mc ON COALESCE(rm.category_id, mm.category_id) = mc.id

-- Join with users
LEFT JOIN public.users u ON rt.submitted_by = u.id

-- Join with work orders
LEFT JOIN public.work_orders wo ON rt.converted_to_work_order_id = wo.id
LEFT JOIN public.users tech ON wo.owner_technician_id = tech.id;

-- =============================================
-- Step 3: Set ownership
-- =============================================

ALTER VIEW public.repair_tickets_view OWNER TO postgres;

-- =============================================
-- Step 4: Add comment
-- =============================================

COMMENT ON VIEW public.repair_tickets_view IS 
'Updated view for repair tickets that works with both sold machines (sold_machines) and repair machines (machines) tables';

COMMIT;
