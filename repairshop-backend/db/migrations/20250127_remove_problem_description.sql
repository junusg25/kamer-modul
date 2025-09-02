-- Remove problem_description column from repair_tickets table
-- Since we consolidated problem_description into description field

ALTER TABLE public.repair_tickets DROP COLUMN IF EXISTS problem_description;
