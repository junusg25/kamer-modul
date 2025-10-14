-- Migration: Add missing columns to machines table for comprehensive repair machine data
-- Date: 2025-01-14
-- Purpose: Ensure machines table can store all relevant fields for repair machines,
--          aligning with expectations of repair_tickets_view and frontend data.

BEGIN;

-- Add purchased_at column to machines table (if not exists)
ALTER TABLE public.machines
ADD COLUMN IF NOT EXISTS purchased_at VARCHAR(255);

-- Add sale_price column for consistency (can be NULL for repair machines)
ALTER TABLE public.machines
ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2);

-- Add machine_condition column for consistency (can be NULL for repair machines)
ALTER TABLE public.machines
ADD COLUMN IF NOT EXISTS machine_condition VARCHAR(20);

COMMIT;
