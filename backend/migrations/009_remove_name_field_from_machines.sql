-- Migration: Remove name field from machines table and keep only model_name
-- Date: 2025-01-14
-- Purpose: Simplify machine table structure by removing redundant name field
--          and ensuring all machine model data comes from machine_models table

BEGIN;

-- First, update any existing records to ensure model_name is populated
-- Copy name to model_name for any records where model_name is null
UPDATE machines 
SET model_name = name 
WHERE model_name IS NULL OR model_name = '';

-- Update views that depend on the name column
-- Recreate repair_machines_with_details view to use model_name instead of name
DROP VIEW IF EXISTS public.repair_machines_with_details;
CREATE OR REPLACE VIEW public.repair_machines_with_details AS
SELECT
    m.id,
    m.customer_id,
    c.name AS customer_name,
    c.company_name,
    m.category_id,
    mc.name AS category_name,
    m.model_name,
    m.manufacturer,
    m.catalogue_number,
    m.serial_number,
    m.description,
    m.received_date,
    m.repair_status,
    m.condition_on_receipt,
    m.estimated_repair_cost,
    m.actual_repair_cost,
    m.repair_notes,
    m.warranty_covered,
    m.warranty_expiry_date,
    m.received_by_user_id,
    u.name AS received_by_user_name,
    m.created_at,
    m.updated_at
FROM machines m
JOIN customers c ON m.customer_id = c.id
LEFT JOIN machine_categories mc ON m.category_id = mc.id
LEFT JOIN users u ON m.received_by_user_id = u.id;

-- Recreate repair_tickets_view to use model_name instead of name
DROP VIEW IF EXISTS public.repair_tickets_view;
CREATE OR REPLACE VIEW public.repair_tickets_view AS
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
    u_owner.name AS owner_name,
    rt.machine_id,
    -- Coalesce machine details from sold_machines (sm) or machines (rm)
    COALESCE(sm.manufacturer, rm.manufacturer) AS manufacturer,
    COALESCE(sm.assigned_at, rm.received_date) AS bought_at,
    COALESCE(mm_sm.category_id, rm.category_id) AS category_id,
    COALESCE(mc_sm.name, mc_rm.name) AS category_name,
    COALESCE(mm_sm.name, rm.model_name) AS model_name,
    COALESCE(mm_sm.catalogue_number, rm.catalogue_number) AS catalogue_number,
    COALESCE(ms.serial_number, rm.serial_number) AS serial_number,
    COALESCE(sm.receipt_number, rm.receipt_number) AS receipt_number,
    COALESCE(sm.purchase_date, rm.purchase_date) AS purchase_date,
    COALESCE(sm.warranty_expiry_date, rm.warranty_expiry_date) AS warranty_expiry_date,
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
FROM
    public.repair_tickets rt
LEFT JOIN public.customers c ON rt.customer_id = c.id
LEFT JOIN public.users u_owner ON c.owner_id = u_owner.id
-- Join for sold_machines
LEFT JOIN public.sold_machines sm ON rt.machine_id = sm.id
LEFT JOIN public.machine_serials ms ON sm.serial_id = ms.id
LEFT JOIN public.machine_models mm_sm ON ms.model_id = mm_sm.id
LEFT JOIN public.machine_categories mc_sm ON mm_sm.category_id = mc_sm.id
-- Join for repair_machines
LEFT JOIN public.machines rm ON rt.machine_id = rm.id
LEFT JOIN public.machine_categories mc_rm ON rm.category_id = mc_rm.id
-- Other joins
LEFT JOIN public.users u ON rt.submitted_by = u.id
LEFT JOIN public.work_orders wo ON rt.converted_to_work_order_id = wo.id
LEFT JOIN public.users tech ON wo.owner_technician_id = tech.id;

-- Now remove the name column from machines table
ALTER TABLE machines DROP COLUMN IF EXISTS name;

-- Add comment explaining the change
COMMENT ON COLUMN machines.model_name IS 'Machine model name - references machine_models.name for consistency';

COMMIT;
