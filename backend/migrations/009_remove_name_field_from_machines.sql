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

-- Remove the name column from machines table
ALTER TABLE machines DROP COLUMN IF EXISTS name;

-- Add comment explaining the change
COMMENT ON COLUMN machines.model_name IS 'Machine model name - references machine_models.name for consistency';

COMMIT;
