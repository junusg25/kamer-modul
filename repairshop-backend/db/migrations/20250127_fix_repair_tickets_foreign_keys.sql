-- Fix foreign key constraints for repair tickets to reference assigned_machines instead of machines
-- This migration updates the foreign key constraints that were causing the "repair_tickets_machine_id_fkey" error

-- Drop the old foreign key constraints
ALTER TABLE public.repair_tickets DROP CONSTRAINT IF EXISTS repair_tickets_machine_id_fkey;
ALTER TABLE public.warranty_repair_tickets DROP CONSTRAINT IF EXISTS warranty_repair_tickets_machine_id_fkey;

-- Add new foreign key constraints referencing assigned_machines
ALTER TABLE public.repair_tickets ADD CONSTRAINT repair_tickets_machine_id_fkey 
    FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;

ALTER TABLE public.warranty_repair_tickets ADD CONSTRAINT warranty_repair_tickets_machine_id_fkey 
    FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;
