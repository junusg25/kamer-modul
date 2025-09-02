-- Comprehensive Schema Update for Repair Ticket and Work Order System
-- Date: 2025-01-27
-- This migration implements the new repair ticket and work order system with separate warranty handling

-- 1. Create new tables for machine categories and warranty periods
CREATE TABLE IF NOT EXISTS public.machine_categories (
    id SERIAL PRIMARY KEY,
    name text NOT NULL UNIQUE,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.warranty_periods (
    id SERIAL PRIMARY KEY,
    manufacturer text NOT NULL,
    model_name text NOT NULL,
    warranty_months integer NOT NULL DEFAULT 12,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manufacturer, model_name)
);

-- 2. Create new warranty repair tickets table
CREATE TABLE IF NOT EXISTS public.warranty_repair_tickets (
    id SERIAL PRIMARY KEY,
    ticket_number integer UNIQUE,
    customer_id integer NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    machine_id integer NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
    problem_description text NOT NULL,
    notes text,
    additional_equipment text,
    brought_by text,
    submitted_by integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'intake' CHECK (status IN ('intake', 'converted', 'cancelled')),
    converted_to_warranty_work_order_id integer REFERENCES public.warranty_work_orders(id) ON DELETE SET NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add new columns to existing tables
-- Customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS vat_number text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS street_address text,
ADD COLUMN IF NOT EXISTS phone2 text,
ADD COLUMN IF NOT EXISTS fax text;

-- Machines table
ALTER TABLE public.machines 
ADD COLUMN IF NOT EXISTS manufacturer text,
ADD COLUMN IF NOT EXISTS bought_at text,
ADD COLUMN IF NOT EXISTS category_id integer REFERENCES public.machine_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS model_name text,
ADD COLUMN IF NOT EXISTS catalogue_number text,
ADD COLUMN IF NOT EXISTS receipt_number text,
ADD COLUMN IF NOT EXISTS purchase_date date,
ADD COLUMN IF NOT EXISTS warranty_expiry_date date;

-- Repair tickets table (remove is_warranty, add new fields)
ALTER TABLE public.repair_tickets 
DROP COLUMN IF EXISTS is_warranty,
ADD COLUMN IF NOT EXISTS ticket_number integer UNIQUE,
ADD COLUMN IF NOT EXISTS problem_description text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS additional_equipment text,
ADD COLUMN IF NOT EXISTS brought_by text,
ADD COLUMN IF NOT EXISTS converted_to_work_order_id integer REFERENCES public.work_orders(id) ON DELETE SET NULL;

-- Rename created_by to submitted_by for consistency
ALTER TABLE public.repair_tickets 
RENAME COLUMN created_by TO submitted_by;

-- Work orders table
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS ticket_number integer,
ADD COLUMN IF NOT EXISTS owner_technician_id integer REFERENCES public.users(id) ON DELETE SET NULL;

-- Warranty work orders table
ALTER TABLE public.warranty_work_orders 
ADD COLUMN IF NOT EXISTS ticket_number integer,
ADD COLUMN IF NOT EXISTS owner_technician_id integer REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. Create PostgreSQL functions
-- Function to get next available ticket number
CREATE OR REPLACE FUNCTION get_next_ticket_number(table_name text)
RETURNS integer AS $$
DECLARE
    next_num integer;
    max_num integer;
    count_result integer;
BEGIN
    -- Get the maximum ticket number from the specified table
    EXECUTE format('SELECT COALESCE(MAX(ticket_number), 0) FROM %I', table_name) INTO max_num;
    
    -- Find the next available number by checking for gaps
    next_num := 1;
    WHILE next_num <= max_num + 1 LOOP
        -- Check if this number exists
        EXECUTE format('SELECT COUNT(*) FROM %I WHERE ticket_number = $1', table_name) INTO count_result USING next_num;
        IF count_result = 0 THEN
            RETURN next_num;
        END IF;
        next_num := next_num + 1;
    END LOOP;
    
    RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- Function to set ticket number automatically
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS trigger AS $$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := get_next_ticket_number(TG_TABLE_NAME);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate warranty expiry
CREATE OR REPLACE FUNCTION calculate_warranty_expiry(purchase_date date, manufacturer text, model_name text)
RETURNS date AS $$
DECLARE
    warranty_months integer;
BEGIN
    -- Get warranty period from warranty_periods table
    SELECT wp.warranty_months INTO warranty_months
    FROM warranty_periods wp
    WHERE wp.manufacturer = calculate_warranty_expiry.manufacturer
    AND wp.model_name = calculate_warranty_expiry.model_name;
    
    -- If no specific warranty period found, use default 12 months
    IF warranty_months IS NULL THEN
        warranty_months := 12;
    END IF;
    
    -- Calculate expiry date
    RETURN purchase_date + (warranty_months || ' months')::interval;
END;
$$ LANGUAGE plpgsql;

-- Function to set warranty expiry automatically
CREATE OR REPLACE FUNCTION set_warranty_expiry()
RETURNS trigger AS $$
BEGIN
    IF NEW.purchase_date IS NOT NULL AND NEW.manufacturer IS NOT NULL AND NEW.model_name IS NOT NULL THEN
        NEW.warranty_expiry_date := calculate_warranty_expiry(NEW.purchase_date, NEW.manufacturer, NEW.model_name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create triggers
-- Trigger for setting ticket numbers
DROP TRIGGER IF EXISTS set_ticket_number_trigger ON public.repair_tickets;
CREATE TRIGGER set_ticket_number_trigger
    BEFORE INSERT ON public.repair_tickets
    FOR EACH ROW
    EXECUTE FUNCTION set_ticket_number();

DROP TRIGGER IF EXISTS set_warranty_ticket_number_trigger ON public.warranty_repair_tickets;
CREATE TRIGGER set_warranty_ticket_number_trigger
    BEFORE INSERT ON public.warranty_repair_tickets
    FOR EACH ROW
    EXECUTE FUNCTION set_ticket_number();

-- Trigger for setting warranty expiry
DROP TRIGGER IF EXISTS set_warranty_expiry_trigger ON public.machines;
CREATE TRIGGER set_warranty_expiry_trigger
    BEFORE INSERT OR UPDATE ON public.machines
    FOR EACH ROW
    EXECUTE FUNCTION set_warranty_expiry();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_trigger ON public.machine_categories;
CREATE TRIGGER set_updated_at_trigger
    BEFORE UPDATE ON public.machine_categories
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_trigger ON public.warranty_periods;
CREATE TRIGGER set_updated_at_trigger
    BEFORE UPDATE ON public.warranty_periods
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_trigger ON public.warranty_repair_tickets;
CREATE TRIGGER set_updated_at_trigger
    BEFORE UPDATE ON public.warranty_repair_tickets
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- 6. Create views
-- View for repair tickets with customer and machine details
CREATE OR REPLACE VIEW repair_tickets_view AS
SELECT 
    rt.id,
    rt.ticket_number,
    rt.customer_id,
    c.name as customer_name,
    c.company_name,
    c.vat_number,
    c.city,
    c.postal_code,
    c.street_address,
    c.phone as phone1,
    c.phone2,
    c.fax,
    c.email,
    rt.machine_id,
    m.manufacturer,
    m.bought_at,
    m.category_id,
    mc.name as category_name,
    m.model_name,
    m.catalogue_number,
    m.serial_number,
    m.receipt_number,
    m.purchase_date,
    m.warranty_expiry_date,
    rt.problem_description,
    rt.notes,
    rt.additional_equipment,
    rt.brought_by,
    rt.submitted_by,
    u.name as submitted_by_name,
    rt.status,
    rt.converted_to_work_order_id,
    wo.owner_technician_id as converted_by_technician_id,
    tech.name as converted_by_technician_name,
    rt.created_at,
    rt.updated_at
FROM public.repair_tickets rt
LEFT JOIN public.customers c ON rt.customer_id = c.id
LEFT JOIN public.machines m ON rt.machine_id = m.id
LEFT JOIN public.machine_categories mc ON m.category_id = mc.id
LEFT JOIN public.users u ON rt.submitted_by = u.id
LEFT JOIN public.work_orders wo ON rt.converted_to_work_order_id = wo.id
LEFT JOIN public.users tech ON wo.owner_technician_id = tech.id;

-- View for warranty repair tickets with customer and machine details
CREATE OR REPLACE VIEW warranty_repair_tickets_view AS
SELECT 
    wrt.id,
    wrt.ticket_number,
    wrt.customer_id,
    c.name as customer_name,
    c.company_name,
    c.vat_number,
    c.city,
    c.postal_code,
    c.street_address,
    c.phone as phone1,
    c.phone2,
    c.fax,
    c.email,
    wrt.machine_id,
    m.manufacturer,
    m.bought_at,
    m.category_id,
    mc.name as category_name,
    m.model_name,
    m.catalogue_number,
    m.serial_number,
    m.receipt_number,
    m.purchase_date,
    m.warranty_expiry_date,
    wrt.problem_description,
    wrt.notes,
    wrt.additional_equipment,
    wrt.brought_by,
    wrt.submitted_by,
    u.name as submitted_by_name,
    wrt.status,
    wrt.converted_to_warranty_work_order_id,
    wrt.created_at,
    wrt.updated_at
FROM public.warranty_repair_tickets wrt
LEFT JOIN public.customers c ON wrt.customer_id = c.id
LEFT JOIN public.machines m ON wrt.machine_id = m.id
LEFT JOIN public.machine_categories mc ON m.category_id = mc.id
LEFT JOIN public.users u ON wrt.submitted_by = u.id;

-- 7. Insert initial data
INSERT INTO public.machine_categories (name) VALUES 
('Laptop'),
('Desktop'),
('Printer'),
('Scanner'),
('Server'),
('Network Equipment'),
('Mobile Device'),
('Tablet'),
('Monitor'),
('Other')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.warranty_periods (manufacturer, model_name, warranty_months) VALUES 
('Dell', 'Latitude', 36),
('Dell', 'Precision', 36),
('HP', 'EliteBook', 36),
('HP', 'ProBook', 36),
('Lenovo', 'ThinkPad', 36),
('Apple', 'MacBook Pro', 12),
('Apple', 'MacBook Air', 12),
('Canon', 'Pixma', 24),
('Epson', 'WorkForce', 24),
('Brother', 'HL-L', 24)
ON CONFLICT (manufacturer, model_name) DO NOTHING;

-- 8. Backfill ticket numbers for existing repair tickets
UPDATE public.repair_tickets 
SET ticket_number = id 
WHERE ticket_number IS NULL;

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_repair_tickets_ticket_number ON public.repair_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_warranty_repair_tickets_ticket_number ON public.warranty_repair_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_status ON public.repair_tickets(status);
CREATE INDEX IF NOT EXISTS idx_warranty_repair_tickets_status ON public.warranty_repair_tickets(status);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_customer_id ON public.repair_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_warranty_repair_tickets_customer_id ON public.warranty_repair_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_machine_id ON public.repair_tickets(machine_id);
CREATE INDEX IF NOT EXISTS idx_warranty_repair_tickets_machine_id ON public.warranty_repair_tickets(machine_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_ticket_number ON public.work_orders(ticket_number);
CREATE INDEX IF NOT EXISTS idx_warranty_work_orders_ticket_number ON public.warranty_work_orders(ticket_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_owner_technician_id ON public.work_orders(owner_technician_id);
CREATE INDEX IF NOT EXISTS idx_warranty_work_orders_owner_technician_id ON public.warranty_work_orders(owner_technician_id);
