-- Migration: Add yearly quote numbering system
-- Created: 2025-10-09
-- Description: Adds year_created field and formatted_number for quotes with format: id/yy (e.g., 8/25)

-- Add year_created column to track the year the quote was created
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS year_created INTEGER,
ADD COLUMN IF NOT EXISTS formatted_number VARCHAR(20);

-- Update existing quotes with year_created from created_at
UPDATE quotes 
SET year_created = EXTRACT(YEAR FROM created_at)
WHERE year_created IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_quotes_year_created ON quotes(year_created);
CREATE INDEX IF NOT EXISTS idx_quotes_formatted_number ON quotes(formatted_number);

-- Function to generate formatted quote number (id/yy format)
CREATE OR REPLACE FUNCTION generate_quote_formatted_number()
RETURNS TRIGGER AS $$
BEGIN
    -- Set year_created to current year if not set
    IF NEW.year_created IS NULL THEN
        NEW.year_created := EXTRACT(YEAR FROM CURRENT_DATE);
    END IF;
    
    -- Generate formatted number: quote_number/year (e.g., 8/25)
    NEW.formatted_number := NEW.quote_number || '/' || RIGHT(NEW.year_created::TEXT, 2);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set formatted_number
DROP TRIGGER IF EXISTS set_quote_formatted_number ON quotes;
CREATE TRIGGER set_quote_formatted_number
    BEFORE INSERT OR UPDATE OF quote_number, year_created ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION generate_quote_formatted_number();

-- Update existing quotes with formatted numbers
UPDATE quotes 
SET formatted_number = quote_number || '/' || RIGHT(year_created::TEXT, 2)
WHERE formatted_number IS NULL;

-- Function to get next quote number for current year
CREATE OR REPLACE FUNCTION get_next_quote_number()
RETURNS INTEGER AS $$
DECLARE
    current_year INTEGER;
    next_number INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Get the maximum quote_number for the current year
    SELECT COALESCE(MAX(quote_number), 0) + 1
    INTO next_number
    FROM quotes
    WHERE year_created = current_year;
    
    RETURN next_number;
END;
$$ LANGUAGE plpgsql;

-- Note: The quote_number will now reset to 1 at the start of each year
-- Example: Quote 8 in 2025 = 8/25, Quote 1 in 2026 = 1/26

