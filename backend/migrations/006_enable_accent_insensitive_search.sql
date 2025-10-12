-- Migration: Enable accent-insensitive search for Bosnian/Croatian/Serbian characters
-- This allows searching for "cinjarevic" to find "činjarević"

-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Test the extension
SELECT unaccent('Činjarević') as test;
-- Should return: 'Cinjarevic'

-- Create helper function for accent-insensitive search
CREATE OR REPLACE FUNCTION accent_insensitive_compare(text, text) 
RETURNS boolean AS $$
  SELECT unaccent($1) ILIKE unaccent($2)
$$ LANGUAGE SQL IMMUTABLE;

-- Create functional indexes for better performance on commonly searched columns

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_name_unaccent 
  ON customers(unaccent(name));

CREATE INDEX IF NOT EXISTS idx_customers_company_unaccent 
  ON customers(unaccent(company_name));

-- Machine Models
CREATE INDEX IF NOT EXISTS idx_machine_models_name_unaccent 
  ON machine_models(unaccent(name));

CREATE INDEX IF NOT EXISTS idx_machine_models_manufacturer_unaccent 
  ON machine_models(unaccent(manufacturer));

-- Comments
COMMENT ON EXTENSION unaccent IS 'Extension for removing accents from text for search purposes';
COMMENT ON FUNCTION accent_insensitive_compare IS 'Helper function for accent and case insensitive text comparison';

-- Verification
SELECT 
  'Extension enabled' as status,
  unaccent('Kärcher') as test_german,
  unaccent('Činjarević') as test_bosnian,
  unaccent('São Paulo') as test_portuguese;

-- Show that search now works both ways
SELECT 
  CASE 
    WHEN unaccent('Činjarević') ILIKE unaccent('cinjarevic') THEN 'Search works! ✓'
    ELSE 'Search failed'
  END as search_test;

