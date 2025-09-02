-- Migration: Add warranty work order reference to repair_tickets
-- Date: 2025-01-27

-- Add converted_to_warranty_work_order_id field to repair_tickets table
ALTER TABLE public.repair_tickets 
ADD COLUMN converted_to_warranty_work_order_id integer REFERENCES public.warranty_work_orders(id) ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX idx_repair_tickets_converted_to_warranty_work_order_id ON public.repair_tickets(converted_to_warranty_work_order_id);
