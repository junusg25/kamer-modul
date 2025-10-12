-- Migration: Separate sequences for each ticket type
-- This ensures TK, WT, WO, WW, and QT each have independent numbering

-- Drop the old yearly_sequences table
DROP TABLE IF EXISTS yearly_sequences CASCADE;

-- Create new yearly_sequences table with prefix column
CREATE TABLE yearly_sequences (
    id SERIAL PRIMARY KEY,
    year INTEGER NOT NULL,
    prefix VARCHAR(10) NOT NULL,  -- Added prefix to distinguish ticket types
    current_sequence INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT yearly_sequences_unique UNIQUE (year, prefix)  -- Each year+prefix combination is unique
);

-- Grant permissions
GRANT ALL PRIVILEGES ON yearly_sequences TO admin;
GRANT ALL PRIVILEGES ON SEQUENCE yearly_sequences_id_seq TO admin;

-- Drop and recreate the get_next_yearly_sequence function to accept prefix parameter
DROP FUNCTION IF EXISTS get_next_yearly_sequence() CASCADE;

CREATE OR REPLACE FUNCTION get_next_yearly_sequence(sequence_prefix TEXT) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    current_year INTEGER;
    next_sequence INTEGER;
    sequence_record RECORD;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Try to get existing sequence for current year and prefix
    SELECT * INTO sequence_record 
    FROM yearly_sequences 
    WHERE year = current_year AND prefix = sequence_prefix;
    
    IF sequence_record IS NULL THEN
        -- Create new sequence for current year and prefix
        INSERT INTO yearly_sequences (year, prefix, current_sequence) 
        VALUES (current_year, sequence_prefix, 1)
        RETURNING current_sequence INTO next_sequence;
    ELSE
        -- Increment existing sequence
        UPDATE yearly_sequences 
        SET current_sequence = current_sequence + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE year = current_year AND prefix = sequence_prefix
        RETURNING current_sequence INTO next_sequence;
    END IF;
    
    RETURN next_sequence;
END;
$$;

-- Drop and recreate the generate_formatted_number function to pass prefix
DROP FUNCTION IF EXISTS generate_formatted_number(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION generate_formatted_number(prefix TEXT DEFAULT '') RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    sequence_num INTEGER;
    current_year INTEGER;
    formatted TEXT;
BEGIN
    -- Get the next sequence for this specific prefix
    sequence_num := get_next_yearly_sequence(prefix);
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    IF prefix != '' THEN
        formatted := prefix || '-' || LPAD(sequence_num::TEXT, 2, '0') || '/' || (current_year % 100);
    ELSE
        formatted := LPAD(sequence_num::TEXT, 2, '0') || '/' || (current_year % 100);
    END IF;
    
    RETURN formatted;
END;
$$;

-- Recreate the triggers (they were dropped by CASCADE)
DROP TRIGGER IF EXISTS set_formatted_number_repair_tickets ON repair_tickets;
CREATE TRIGGER set_formatted_number_repair_tickets 
    BEFORE INSERT ON repair_tickets 
    FOR EACH ROW 
    EXECUTE FUNCTION set_formatted_number_and_year();

DROP TRIGGER IF EXISTS set_formatted_number_warranty_repair_tickets ON warranty_repair_tickets;
CREATE TRIGGER set_formatted_number_warranty_repair_tickets 
    BEFORE INSERT ON warranty_repair_tickets 
    FOR EACH ROW 
    EXECUTE FUNCTION set_formatted_number_and_year();

DROP TRIGGER IF EXISTS set_formatted_number_work_orders ON work_orders;
CREATE TRIGGER set_formatted_number_work_orders 
    BEFORE INSERT ON work_orders 
    FOR EACH ROW 
    EXECUTE FUNCTION set_formatted_number_and_year();

DROP TRIGGER IF EXISTS set_formatted_number_warranty_work_orders ON warranty_work_orders;
CREATE TRIGGER set_formatted_number_warranty_work_orders 
    BEFORE INSERT ON warranty_work_orders 
    FOR EACH ROW 
    EXECUTE FUNCTION set_formatted_number_and_year();

-- Verify the changes
SELECT * FROM yearly_sequences ORDER BY year, prefix;

-- Show example of how sequences will work
SELECT 
    'TK-01/25' as repair_ticket_example,
    'WT-01/25' as warranty_ticket_example,
    'WO-01/25' as work_order_example,
    'WW-01/25' as warranty_work_order_example;

