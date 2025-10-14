-- Migration: Update warranty_repair_tickets_view to handle both sold_machines and machines tables
-- Date: 2025-01-14
-- Purpose: Fix warranty repair tickets showing N/A for machine information by updating the view
--          to use UNION ALL logic for both sold_machines and machines tables

BEGIN;

-- Drop the existing view
DROP VIEW IF EXISTS public.warranty_repair_tickets_view;

-- Recreate the warranty_repair_tickets_view with updated logic
CREATE OR REPLACE VIEW public.warranty_repair_tickets_view AS
SELECT 
    wrt.id,
    wrt.ticket_number,
    wrt.formatted_number,
    wrt.year_created,
    wrt.customer_id,
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
    wrt.machine_id,
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
    COALESCE(sm.warranty_active, rm.warranty_covered) AS warranty_active,
    wrt.problem_description,
    wrt.notes,
    wrt.additional_equipment,
    wrt.brought_by,
    wrt.submitted_by,
    u.name AS submitted_by_name,
    wrt.status,
    wrt.priority,
    wrt.converted_to_warranty_work_order_id,
    wwo.formatted_number AS converted_warranty_work_order_formatted_number,
    wwo.year_created AS converted_warranty_work_order_year_created,
    wwo.owner_technician_id AS converted_by_technician_id,
    tech.name AS converted_by_technician_name,
    wrt.converted_at,
    wrt.created_at,
    wrt.updated_at
FROM
    public.warranty_repair_tickets wrt
LEFT JOIN public.customers c ON wrt.customer_id = c.id
LEFT JOIN public.users u_owner ON c.owner_id = u_owner.id
-- Join for sold_machines
LEFT JOIN public.sold_machines sm ON wrt.machine_id = sm.id
LEFT JOIN public.machine_serials ms ON sm.serial_id = ms.id
LEFT JOIN public.machine_models mm_sm ON ms.model_id = mm_sm.id
LEFT JOIN public.machine_categories mc_sm ON mm_sm.category_id = mc_sm.id
-- Join for repair_machines
LEFT JOIN public.machines rm ON wrt.machine_id = rm.id
LEFT JOIN public.machine_categories mc_rm ON rm.category_id = mc_rm.id
-- Other joins
LEFT JOIN public.users u ON wrt.submitted_by = u.id
LEFT JOIN public.warranty_work_orders wwo ON wrt.converted_to_warranty_work_order_id = wwo.id
LEFT JOIN public.users tech ON wwo.owner_technician_id = tech.id;

COMMIT;
