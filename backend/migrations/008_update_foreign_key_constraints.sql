-- Migration: Remove foreign key constraints for machine_id to allow references to both tables
-- Date: 2025-01-14
-- Purpose: Allow repair tickets to reference machines from both sold_machines and machines tables
--          by removing restrictive foreign key constraints and handling validation at application level

BEGIN;

-- =============================================
-- Step 1: Drop existing foreign key constraints
-- =============================================

-- Drop repair_tickets foreign key constraint
ALTER TABLE public.repair_tickets 
DROP CONSTRAINT IF EXISTS repair_tickets_machine_id_fkey;

-- Drop warranty_repair_tickets foreign key constraint
ALTER TABLE public.warranty_repair_tickets 
DROP CONSTRAINT IF EXISTS warranty_repair_tickets_machine_id_fkey;

-- Drop warranty_work_orders foreign key constraint
ALTER TABLE public.warranty_work_orders 
DROP CONSTRAINT IF EXISTS warranty_work_orders_machine_id_fkey;

-- Drop work_orders foreign key constraint
ALTER TABLE public.work_orders 
DROP CONSTRAINT IF EXISTS work_orders_machine_id_fkey;

-- =============================================
-- Step 2: Add comments explaining the change
-- =============================================

COMMENT ON COLUMN public.repair_tickets.machine_id IS 
'References machines from either sold_machines or machines table. Validation handled at application level.';

COMMENT ON COLUMN public.warranty_repair_tickets.machine_id IS 
'References machines from either sold_machines or machines table. Validation handled at application level.';

COMMENT ON COLUMN public.warranty_work_orders.machine_id IS 
'References machines from either sold_machines or machines table. Validation handled at application level.';

COMMENT ON COLUMN public.work_orders.machine_id IS 
'References machines from either sold_machines or machines table. Validation handled at application level.';

COMMIT;
