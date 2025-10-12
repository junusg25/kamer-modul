-- Migration: Customer Portal Setup
-- Description: Add tracking number prefixes, create customer portal tables
-- Date: 2025-01-10

-- ============================================
-- PART 1: Update formatted number generation
-- ============================================

-- Drop existing function and recreate with prefix support
DROP FUNCTION IF EXISTS public.generate_formatted_number() CASCADE;

CREATE FUNCTION public.generate_formatted_number(prefix text DEFAULT '') RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    sequence_num integer;
    current_year integer;
    formatted text;
BEGIN
    sequence_num := get_next_yearly_sequence();
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    -- Format: PREFIX-NUMBER/YY (e.g., TK-12/25, WO-8/25)
    IF prefix != '' THEN
        formatted := prefix || '-' || sequence_num || '/' || (current_year % 100);
    ELSE
        formatted := sequence_num || '/' || (current_year % 100);
    END IF;
    RETURN formatted;
END;
$$;

-- Update trigger function to accept table name and set appropriate prefix
DROP FUNCTION IF EXISTS public.set_formatted_number_and_year() CASCADE;

CREATE FUNCTION public.set_formatted_number_and_year() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    IF NEW.formatted_number IS NULL THEN
        -- Determine prefix based on table name
        CASE TG_TABLE_NAME
            WHEN 'repair_tickets' THEN prefix := 'TK';
            WHEN 'warranty_repair_tickets' THEN prefix := 'WT';
            WHEN 'work_orders' THEN prefix := 'WO';
            WHEN 'warranty_work_orders' THEN prefix := 'WW';
            WHEN 'quotes' THEN prefix := 'QT';
            ELSE prefix := '';
        END CASE;
        
        NEW.formatted_number := generate_formatted_number(prefix);
        NEW.year_created := EXTRACT(YEAR FROM CURRENT_DATE);
    END IF;
    RETURN NEW;
END;
$$;

-- Recreate triggers (they were dropped with CASCADE)
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

-- Note: Quotes have their own trigger, we need to update it
DROP FUNCTION IF EXISTS public.generate_quote_formatted_number() CASCADE;

CREATE FUNCTION public.generate_quote_formatted_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Format quote number as QT-ID/YY
    IF NEW.quote_number IS NOT NULL AND NEW.year_created IS NOT NULL THEN
        NEW.formatted_number := 'QT-' || NEW.quote_number || '/' || (NEW.year_created % 100);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_quote_formatted_number ON public.quotes;
CREATE TRIGGER set_quote_formatted_number 
    BEFORE INSERT OR UPDATE OF quote_number, year_created ON public.quotes 
    FOR EACH ROW EXECUTE FUNCTION public.generate_quote_formatted_number();

-- ============================================
-- PART 2: Migrate existing data (add prefixes)
-- ============================================

-- Update repair tickets
UPDATE repair_tickets 
SET formatted_number = 'TK-' || formatted_number 
WHERE formatted_number NOT LIKE 'TK-%';

-- Update warranty repair tickets
UPDATE warranty_repair_tickets 
SET formatted_number = 'WT-' || formatted_number 
WHERE formatted_number NOT LIKE 'WT-%';

-- Update work orders
UPDATE work_orders 
SET formatted_number = 'WO-' || formatted_number 
WHERE formatted_number NOT LIKE 'WO-%';

-- Update warranty work orders
UPDATE warranty_work_orders 
SET formatted_number = 'WW-' || formatted_number 
WHERE formatted_number NOT LIKE 'WW-%';

-- Update quotes
UPDATE quotes 
SET formatted_number = 'QT-' || formatted_number 
WHERE formatted_number NOT LIKE 'QT-%';

-- ============================================
-- PART 3: Create customer portal tables
-- ============================================

-- Customer portal user accounts
CREATE TABLE IF NOT EXISTS customer_portal_users (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    verification_token_expires TIMESTAMP,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_customer_portal_user UNIQUE(customer_id)
);

-- Customer portal activity log
CREATE TABLE IF NOT EXISTS customer_portal_activity (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    portal_user_id INTEGER REFERENCES customer_portal_users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    tracking_number VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PART 4: Create indexes
-- ============================================

-- Customer portal users indexes
CREATE INDEX idx_portal_users_customer_id ON customer_portal_users(customer_id);
CREATE INDEX idx_portal_users_email ON customer_portal_users(email);
CREATE INDEX idx_portal_users_verification_token ON customer_portal_users(verification_token);
CREATE INDEX idx_portal_users_reset_token ON customer_portal_users(reset_token);
CREATE INDEX idx_portal_users_is_active ON customer_portal_users(is_active);

-- Customer portal activity indexes
CREATE INDEX idx_portal_activity_customer ON customer_portal_activity(customer_id);
CREATE INDEX idx_portal_activity_portal_user ON customer_portal_activity(portal_user_id);
CREATE INDEX idx_portal_activity_action ON customer_portal_activity(action);
CREATE INDEX idx_portal_activity_entity ON customer_portal_activity(entity_type, entity_id);
CREATE INDEX idx_portal_activity_tracking ON customer_portal_activity(tracking_number);
CREATE INDEX idx_portal_activity_created ON customer_portal_activity(created_at DESC);

-- ============================================
-- PART 5: Add updated_at trigger
-- ============================================

CREATE TRIGGER update_customer_portal_users_updated_at
    BEFORE UPDATE ON customer_portal_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 6: Add comments
-- ============================================

COMMENT ON TABLE customer_portal_users IS 'Customer accounts for accessing the customer portal';
COMMENT ON TABLE customer_portal_activity IS 'Activity log for customer portal usage tracking';
COMMENT ON COLUMN customer_portal_users.verification_token IS 'Token for email verification';
COMMENT ON COLUMN customer_portal_users.reset_token IS 'Token for password reset';

-- ============================================
-- Verification
-- ============================================

-- Verify prefixes were added
SELECT 
    'repair_tickets' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN formatted_number LIKE 'TK-%' THEN 1 END) as with_prefix
FROM repair_tickets
UNION ALL
SELECT 
    'warranty_repair_tickets',
    COUNT(*),
    COUNT(CASE WHEN formatted_number LIKE 'WT-%' THEN 1 END)
FROM warranty_repair_tickets
UNION ALL
SELECT 
    'work_orders',
    COUNT(*),
    COUNT(CASE WHEN formatted_number LIKE 'WO-%' THEN 1 END)
FROM work_orders
UNION ALL
SELECT 
    'warranty_work_orders',
    COUNT(*),
    COUNT(CASE WHEN formatted_number LIKE 'WW-%' THEN 1 END)
FROM warranty_work_orders
UNION ALL
SELECT 
    'quotes',
    COUNT(*),
    COUNT(CASE WHEN formatted_number LIKE 'QT-%' THEN 1 END)
FROM quotes;

