-- Fix foreign key constraint for warranty_work_orders.converted_from_ticket_id
-- It should reference warranty_repair_tickets(id) instead of repair_tickets(id)

-- Drop the incorrect foreign key constraint
ALTER TABLE public.warranty_work_orders DROP CONSTRAINT IF EXISTS warranty_work_orders_converted_from_ticket_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE public.warranty_work_orders ADD CONSTRAINT warranty_work_orders_converted_from_ticket_id_fkey 
FOREIGN KEY (converted_from_ticket_id) REFERENCES public.warranty_repair_tickets(id) ON DELETE SET NULL;
