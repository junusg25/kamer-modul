-- Migration: Add missing columns to machines table for comprehensive repair machine data
-- Date: 2025-01-14
-- Purpose: Ensure machines table can store all relevant fields for repair machines,
--          aligning with expectations of repair_tickets_view and frontend data.

BEGIN;

-- Add receipt_number column to machines table
ALTER TABLE public.machines
ADD COLUMN receipt_number VARCHAR(255);

-- Add purchased_at column to machines table  
ALTER TABLE public.machines
ADD COLUMN purchased_at VARCHAR(255);

-- Add warranty_expiry_date column to machines table
ALTER TABLE public.machines
ADD COLUMN warranty_expiry_date DATE;

-- Add sale_price column for consistency (can be NULL for repair machines)
ALTER TABLE public.machines
ADD COLUMN sale_price NUMERIC(10,2);

-- Add machine_condition column for consistency (can be NULL for repair machines)
ALTER TABLE public.machines
ADD COLUMN machine_condition VARCHAR(20);

COMMIT;
