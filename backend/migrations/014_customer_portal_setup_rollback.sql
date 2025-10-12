-- Rollback: Customer Portal Setup
-- Description: Revert tracking number prefixes and remove customer portal tables
-- Date: 2025-01-10

-- ============================================
-- PART 1: Remove prefixes from existing data
-- ============================================

-- Remove TK- prefix from repair tickets
UPDATE repair_tickets 
SET formatted_number = SUBSTRING(formatted_number FROM 4)
WHERE formatted_number LIKE 'TK-%';

-- Remove WT- prefix from warranty repair tickets
UPDATE warranty_repair_tickets 
SET formatted_number = SUBSTRING(formatted_number FROM 4)
WHERE formatted_number LIKE 'WT-%';

-- Remove WO- prefix from work orders
UPDATE work_orders 
SET formatted_number = SUBSTRING(formatted_number FROM 4)
WHERE formatted_number LIKE 'WO-%';

-- Remove WW- prefix from warranty work orders
UPDATE warranty_work_orders 
SET formatted_number = SUBSTRING(formatted_number FROM 4)
WHERE formatted_number LIKE 'WW-%';

-- Remove QT- prefix from quotes
UPDATE quotes 
SET formatted_number = SUBSTRING(formatted_number FROM 4)
WHERE formatted_number LIKE 'QT-%';

-- ============================================
-- PART 2: Drop customer portal tables
-- ============================================

DROP TABLE IF EXISTS customer_portal_activity CASCADE;
DROP TABLE IF EXISTS customer_portal_users CASCADE;

-- ============================================
-- PART 3: Restore original functions
-- ============================================

-- Restore original generate_formatted_number function (without prefix)
DROP FUNCTION IF EXISTS public.generate_formatted_number(text) CASCADE;

CREATE FUNCTION public.generate_formatted_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    sequence_num integer;
    current_year integer;
    formatted text;
BEGIN
    sequence_num := get_next_yearly_sequence();
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    -- Use only last 2 digits of year
    formatted := sequence_num || '/' || (current_year % 100);
    RETURN formatted;
END;
$$;

-- Restore original set_formatted_number_and_year function
DROP FUNCTION IF EXISTS public.set_formatted_number_and_year() CASCADE;

CREATE FUNCTION public.set_formatted_number_and_year() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.formatted_number IS NULL THEN
        NEW.formatted_number := generate_formatted_number();
        NEW.year_created := EXTRACT(YEAR FROM CURRENT_DATE);
    END IF;
    RETURN NEW;
END;
$$;

-- Restore original quote formatted number function
DROP FUNCTION IF EXISTS public.generate_quote_formatted_number() CASCADE;

CREATE FUNCTION public.generate_quote_formatted_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Format quote number as ID/YY (without QT- prefix)
    IF NEW.quote_number IS NOT NULL AND NEW.year_created IS NOT NULL THEN
        NEW.formatted_number := NEW.quote_number || '/' || (NEW.year_created % 100);
    END IF;
    RETURN NEW;
END;
$$;

-- ============================================
-- PART 4: Recreate triggers
-- ============================================

DROP TRIGGER IF EXISTS set_formatted_number_repair_tickets ON public.repair_tickets;
CREATE TRIGGER set_formatted_number_repair_tickets 
    BEFORE INSERT ON public.repair_tickets 
    FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();

DROP TRIGGER IF EXISTS set_formatted_number_warranty_repair_tickets ON public.warranty_repair_tickets;
CREATE TRIGGER set_formatted_number_warranty_repair_tickets 
    BEFORE INSERT ON public.warranty_repair_tickets 
    FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();

DROP TRIGGER IF EXISTS set_formatted_number_work_orders ON public.work_orders;
CREATE TRIGGER set_formatted_number_work_orders 
    BEFORE INSERT ON public.work_orders 
    FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();

DROP TRIGGER IF EXISTS set_formatted_number_warranty_work_orders ON public.warranty_work_orders;
CREATE TRIGGER set_formatted_number_warranty_work_orders 
    BEFORE INSERT ON public.warranty_work_orders 
    FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();

DROP TRIGGER IF EXISTS set_quote_formatted_number ON public.quotes;
CREATE TRIGGER set_quote_formatted_number 
    BEFORE INSERT OR UPDATE OF quote_number, year_created ON public.quotes 
    FOR EACH ROW EXECUTE FUNCTION public.generate_quote_formatted_number();

-- ============================================
-- Verification
-- ============================================

-- Verify prefixes were removed
SELECT 
    'repair_tickets' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN formatted_number NOT LIKE 'TK-%' THEN 1 END) as without_prefix
FROM repair_tickets
UNION ALL
SELECT 
    'warranty_repair_tickets',
    COUNT(*),
    COUNT(CASE WHEN formatted_number NOT LIKE 'WT-%' THEN 1 END)
FROM warranty_repair_tickets
UNION ALL
SELECT 
    'work_orders',
    COUNT(*),
    COUNT(CASE WHEN formatted_number NOT LIKE 'WO-%' THEN 1 END)
FROM work_orders
UNION ALL
SELECT 
    'warranty_work_orders',
    COUNT(*),
    COUNT(CASE WHEN formatted_number NOT LIKE 'WW-%' THEN 1 END)
FROM warranty_work_orders
UNION ALL
SELECT 
    'quotes',
    COUNT(*),
    COUNT(CASE WHEN formatted_number NOT LIKE 'QT-%' THEN 1 END)
FROM quotes;

