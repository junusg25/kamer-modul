-- Migration: Fix machines table unique constraint for repair machines
-- Date: 2025-01-14
-- Purpose: Allow multiple repair machines with same model and NULL serial numbers

BEGIN;

-- =============================================
-- Step 1: Drop the existing unique constraint
-- =============================================

-- Drop the unique index that prevents multiple machines with NULL serial numbers
DROP INDEX IF EXISTS public.uniq_machine_model_serial;

-- Drop the unique constraint on serial_number if it exists
ALTER TABLE public.machines DROP CONSTRAINT IF EXISTS unique_serial;

-- =============================================
-- Step 2: Create a new partial unique index
-- =============================================

-- Create a partial unique index that only applies when serial_number is NOT NULL
-- This allows multiple machines with NULL serial numbers but ensures uniqueness when serial is provided
CREATE UNIQUE INDEX IF NOT EXISTS machines_unique_serial_when_not_null 
ON public.machines (name, catalogue_number, serial_number) 
WHERE serial_number IS NOT NULL;

-- =============================================
-- Step 3: Add a comment explaining the constraint
-- =============================================

COMMENT ON INDEX public.machines_unique_serial_when_not_null IS 
'Ensures serial numbers are unique per model when provided, but allows multiple machines with NULL serial numbers for repair shop scenarios';

COMMIT;
