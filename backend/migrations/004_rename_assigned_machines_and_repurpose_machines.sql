-- Migration: Rename assigned_machines to sold_machines and repurpose machines table
-- Date: 2025-01-14
-- Purpose: Separate sold machines from repair machines for better data organization

BEGIN;

-- =============================================
-- Step 1: Rename assigned_machines to sold_machines
-- =============================================

-- Rename the table
ALTER TABLE public.assigned_machines RENAME TO sold_machines;

-- Rename the sequence
ALTER SEQUENCE public.assigned_machines_id_seq RENAME TO sold_machines_id_seq;

-- Update the sequence ownership
ALTER SEQUENCE public.sold_machines_id_seq OWNED BY public.sold_machines.id;

-- Rename the primary key constraint
ALTER TABLE public.sold_machines RENAME CONSTRAINT assigned_machines_pkey TO sold_machines_pkey;

-- Rename foreign key constraints
ALTER TABLE public.sold_machines RENAME CONSTRAINT assigned_machines_customer_id_fkey TO sold_machines_customer_id_fkey;
ALTER TABLE public.sold_machines RENAME CONSTRAINT assigned_machines_serial_id_fkey TO sold_machines_serial_id_fkey;
ALTER TABLE public.sold_machines RENAME CONSTRAINT assigned_machines_sold_by_user_id_fkey TO sold_machines_sold_by_user_id_fkey;
ALTER TABLE public.sold_machines RENAME CONSTRAINT assigned_machines_added_by_user_id_fkey TO sold_machines_added_by_user_id_fkey;

-- Rename check constraints
ALTER TABLE public.sold_machines RENAME CONSTRAINT assigned_machines_machine_condition_check TO sold_machines_machine_condition_check;

-- =============================================
-- Step 2: Update machines table for repair machines
-- =============================================

-- Make serial_number nullable for repair machines
ALTER TABLE public.machines ALTER COLUMN serial_number DROP NOT NULL;

-- Add new columns for repair machine specific fields
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS received_date DATE;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS repair_status VARCHAR(50) DEFAULT 'in_repair' CHECK (repair_status IN ('in_repair', 'repaired', 'returned', 'scrapped'));
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS condition_on_receipt VARCHAR(20) DEFAULT 'unknown' CHECK (condition_on_receipt IN ('new', 'used', 'damaged', 'unknown'));
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS estimated_repair_cost NUMERIC(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS actual_repair_cost NUMERIC(10,2);
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS repair_notes TEXT;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS warranty_covered BOOLEAN DEFAULT false;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS received_by_user_id INTEGER REFERENCES users(id);

-- Rename existing columns to be more generic
-- (purchase_date can be used for both sold machines and repair machines)
-- warranty_expiry_date is already generic enough

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_machines_customer_id ON machines(customer_id);
CREATE INDEX IF NOT EXISTS idx_machines_serial_number ON machines(serial_number);
CREATE INDEX IF NOT EXISTS idx_machines_repair_status ON machines(repair_status);
CREATE INDEX IF NOT EXISTS idx_machines_received_date ON machines(received_date);

-- =============================================
-- Step 3: Update views
-- =============================================

-- Drop and recreate the assigned_machines_with_details view
DROP VIEW IF EXISTS public.assigned_machines_with_details;

CREATE VIEW public.sold_machines_with_details AS
SELECT 
    sm.id,
    sm.serial_id,
    sm.customer_id,
    sm.purchase_date,
    sm.warranty_expiry_date,
    sm.warranty_active,
    sm.description,
    sm.assigned_at,
    sm.updated_at,
    sm.receipt_number,
    sm.sold_by_user_id,
    sm.added_by_user_id,
    sm.machine_condition,
    sm.sale_date,
    sm.sale_price,
    sm.is_sale,
    sm.purchased_at,
    c.name as customer_name,
    c.company_name as customer_company,
    ms.serial_number,
    mm.name as model_name,
    mm.manufacturer,
    mm.catalogue_number,
    sold_by.name as sold_by_name,
    added_by.name as added_by_name
FROM sold_machines sm
LEFT JOIN customers c ON sm.customer_id = c.id
LEFT JOIN machine_serials ms ON sm.serial_id = ms.id
LEFT JOIN machine_models mm ON ms.model_id = mm.id
LEFT JOIN users sold_by ON sm.sold_by_user_id = sold_by.id
LEFT JOIN users added_by ON sm.added_by_user_id = added_by.id;

-- Create a view for repair machines with details
CREATE VIEW public.repair_machines_with_details AS
SELECT 
    m.id,
    m.customer_id,
    m.name as machine_name,
    m.serial_number,
    m.description,
    m.created_at,
    m.warranty_expiry_date,
    m.warranty_active,
    m.updated_at,
    m.catalogue_number,
    m.manufacturer,
    m.model_name,
    m.receipt_number,
    m.purchase_date,
    m.received_date,
    m.repair_status,
    m.condition_on_receipt,
    m.estimated_repair_cost,
    m.actual_repair_cost,
    m.repair_notes,
    m.warranty_covered,
    m.received_by_user_id,
    c.name as customer_name,
    c.company_name as customer_company,
    received_by.name as received_by_name
FROM machines m
LEFT JOIN customers c ON m.customer_id = c.id
LEFT JOIN users received_by ON m.received_by_user_id = received_by.id;

-- Create a unified view for all customer machines
CREATE VIEW public.customer_all_machines AS
SELECT 
    'sold' as machine_type,
    sm.id,
    sm.customer_id,
    sm.serial_id as model_reference,
    sm.purchase_date as date,
    sm.sale_price as cost,
    sm.warranty_expiry_date,
    sm.warranty_active,
    sm.machine_condition as condition,
    sm.assigned_at as created_at,
    ms.serial_number,
    mm.name as model_name,
    mm.manufacturer,
    c.name as customer_name,
    c.company_name as customer_company
FROM sold_machines sm
LEFT JOIN machine_serials ms ON sm.serial_id = ms.id
LEFT JOIN machine_models mm ON ms.model_id = mm.id
LEFT JOIN customers c ON sm.customer_id = c.id
UNION ALL
SELECT 
    'repair' as machine_type,
    m.id,
    m.customer_id,
    NULL as model_reference, -- No direct model_id in machines table yet
    m.received_date as date,
    m.actual_repair_cost as cost,
    m.warranty_expiry_date,
    m.warranty_covered as warranty_active,
    m.condition_on_receipt as condition,
    m.created_at,
    m.serial_number,
    m.model_name,
    m.manufacturer,
    c.name as customer_name,
    c.company_name as customer_company
FROM machines m
LEFT JOIN customers c ON m.customer_id = c.id;

-- =============================================
-- Step 4: Update repair_tickets table
-- =============================================

-- Add new column to link repair tickets to machines table
ALTER TABLE public.repair_tickets ADD COLUMN IF NOT EXISTS repair_machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_repair_tickets_repair_machine_id ON repair_tickets(repair_machine_id);

COMMIT;
