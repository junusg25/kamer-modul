-- Repair Shop Database Schema
-- Based on backup from 2025-08-27
-- Comprehensive schema with all functions, tables, views, and constraints

-- Functions
CREATE OR REPLACE FUNCTION public.calculate_warranty_expiry(purchase_date date, model_id integer) RETURNS date
    LANGUAGE plpgsql
    AS $$
DECLARE
    warranty_months integer;
BEGIN
    -- Get warranty period from machine_models table
    SELECT mm.warranty_months INTO warranty_months
    FROM machine_models mm
    WHERE mm.id = calculate_warranty_expiry.model_id;
    
    -- If no specific warranty period found, use default 12 months
    IF warranty_months IS NULL THEN
        warranty_months := 12;
    END IF;
    
    -- Calculate expiry date
    RETURN purchase_date + (warranty_months || ' months')::interval;
END;
$$;

CREATE OR REPLACE FUNCTION public.copy_ticket_number_to_work_order(ticket_id integer, ticket_type text, work_order_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    ticket_number text;
    ticket_year integer;
BEGIN
    -- Get the formatted number from the repair ticket
    IF ticket_type = 'repair' THEN
        SELECT formatted_number, year_created INTO ticket_number, ticket_year
        FROM repair_tickets WHERE id = ticket_id;
    ELSIF ticket_type = 'warranty_repair' THEN
        SELECT formatted_number, year_created INTO ticket_number, ticket_year
        FROM warranty_repair_tickets WHERE id = ticket_id;
    END IF;
    
    -- Update the work order with the same number
    IF ticket_number IS NOT NULL THEN
        UPDATE work_orders 
        SET formatted_number = ticket_number,
            year_created = ticket_year
        WHERE id = work_order_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_formatted_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_year integer;
    current_sequence integer;
    formatted_number text;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Get or create sequence for current year
    SELECT current_sequence INTO current_sequence
    FROM yearly_sequences
    WHERE year = current_year;
    
    IF current_sequence IS NULL THEN
        INSERT INTO yearly_sequences (year, current_sequence)
        VALUES (current_year, 1);
        current_sequence := 1;
    ELSE
        UPDATE yearly_sequences
        SET current_sequence = current_sequence + 1
        WHERE year = current_year;
        current_sequence := current_sequence + 1;
    END IF;
    
    -- Format: YYYY-XXXX (e.g., 2025-0001)
    formatted_number := current_year || '-' || LPAD(current_sequence::text, 4, '0');
    
    RETURN formatted_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_ticket_number(table_name text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_number integer;
    current_year integer;
    current_sequence integer;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Get current sequence for the year
    SELECT current_sequence INTO current_sequence
    FROM yearly_sequences
    WHERE year = current_year;
    
    IF current_sequence IS NULL THEN
        -- Initialize sequence for new year
        INSERT INTO yearly_sequences (year, current_sequence)
        VALUES (current_year, 1);
        next_number := 1;
    ELSE
        -- Increment sequence
        UPDATE yearly_sequences
        SET current_sequence = current_sequence + 1
        WHERE year = current_year;
        next_number := current_sequence + 1;
    END IF;
    
    RETURN next_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_formatted_number_and_year() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Generate formatted number
    NEW.formatted_number := generate_formatted_number();
    
    -- Set year created
    NEW.year_created := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Set ticket number
    NEW.ticket_number := get_next_ticket_number(TG_TABLE_NAME);
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_ticket_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Set ticket number if not already set
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := get_next_ticket_number(TG_TABLE_NAME);
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_warranty_active() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.warranty_active :=
        CASE
            WHEN NEW.warranty_expiry_date IS NULL THEN false
            WHEN NEW.warranty_expiry_date > NOW() THEN true
            ELSE false
        END;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_warranty_expiry() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    model_id integer;
BEGIN
    -- Get the model_id from the machine_serials table
    SELECT ms.model_id INTO model_id
    FROM machine_serials ms
    WHERE ms.id = NEW.serial_id;
    
    -- Calculate warranty expiry if purchase_date is set and we have a model_id
    IF NEW.purchase_date IS NOT NULL AND model_id IS NOT NULL THEN
        NEW.warranty_expiry_date := calculate_warranty_expiry(NEW.purchase_date, model_id);
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Tables
CREATE TABLE public.assigned_machines (
    id SERIAL PRIMARY KEY,
    serial_id integer NOT NULL,
    customer_id integer NOT NULL,
    purchase_date date,
    warranty_expiry_date date,
    warranty_active boolean DEFAULT true,
    description text,
    receipt_number text,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.customers (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    phone text,
    email text,
    address text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_name text,
    vat_number text,
    city text,
    postal_code text,
    street_address text,
    phone2 text,
    fax text
);

CREATE TABLE public.customer_communications (
    id SERIAL PRIMARY KEY,
    customer_id integer NOT NULL,
    type character varying(50) NOT NULL,
    subject character varying(200),
    content text NOT NULL,
    direction character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'completed',
    scheduled_date timestamp without time zone,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_communications_direction_check CHECK (direction IN ('inbound', 'outbound')),
    CONSTRAINT customer_communications_status_check CHECK (status IN ('pending', 'completed', 'scheduled')),
    CONSTRAINT customer_communications_type_check CHECK (type IN ('call', 'email', 'note', 'follow_up', 'meeting'))
);

CREATE TABLE public.customer_preferences (
    id SERIAL PRIMARY KEY,
    customer_id integer NOT NULL,
    preferred_contact_method character varying(20),
    preferred_contact_time character varying(20),
    category character varying(20) DEFAULT 'regular',
    special_requirements text,
    notes text,
    auto_notifications boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_preferences_category_check CHECK (category IN ('vip', 'regular', 'new', 'inactive')),
    CONSTRAINT customer_preferences_preferred_contact_method_check CHECK (preferred_contact_method IN ('email', 'phone', 'sms', 'mail')),
    CONSTRAINT customer_preferences_preferred_contact_time_check CHECK (preferred_contact_time IN ('morning', 'afternoon', 'evening', 'anytime'))
);

CREATE TABLE public.inventory (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    description text,
    quantity integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    unit_price numeric(10,2) DEFAULT 0,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    part_number character varying(50),
    barcode character varying(50),
    category character varying(50),
    reorder_level integer DEFAULT 5,
    supplier_id integer,
    location character varying(100),
    min_order_quantity integer DEFAULT 1,
    lead_time_days integer DEFAULT 7,
    min_stock_level integer DEFAULT 5,
    supplier text,
    sku text
);

CREATE TABLE public.machine_categories (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.machine_models (
    id SERIAL PRIMARY KEY,
    name character varying(255) NOT NULL,
    catalogue_number character varying(100),
    manufacturer character varying(255) NOT NULL,
    category_id integer,
    description text,
    warranty_months integer DEFAULT 12,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.machine_serials (
    id SERIAL PRIMARY KEY,
    model_id integer NOT NULL,
    serial_number character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'available',
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.machines (
    id SERIAL PRIMARY KEY,
    customer_id integer NOT NULL,
    name text NOT NULL,
    serial_number text,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    warranty_expiry_date date,
    warranty_active boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    catalogue_number text,
    manufacturer text,
    bought_at text,
    category_id integer,
    model_name text,
    receipt_number text,
    purchase_date date
);

CREATE TABLE public.notifications (
    id SERIAL PRIMARY KEY,
    user_id integer,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) DEFAULT 'info' NOT NULL,
    is_read boolean DEFAULT false,
    related_entity_type character varying(50),
    related_entity_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    title_key text NOT NULL,
    message_key text NOT NULL,
    message_params jsonb NOT NULL
);

CREATE TABLE public.repair_tickets (
    id SERIAL PRIMARY KEY,
    customer_id integer NOT NULL,
    machine_id integer NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'intake',
    submitted_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    converted_at timestamp without time zone,
    converted_to_work_order_id integer,
    converted_to_warranty_work_order_id integer,
    ticket_number integer,
    problem_description text,
    notes text,
    additional_equipment text,
    brought_by text,
    formatted_number text,
    year_created integer,
    CONSTRAINT repair_tickets_status_check CHECK (status IN ('intake', 'converted', 'converted - warranty', 'cancelled'))
);

CREATE TABLE public.schema_migrations (
    name text NOT NULL PRIMARY KEY,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.stock_movements (
    id SERIAL PRIMARY KEY,
    inventory_id integer NOT NULL,
    quantity_change integer NOT NULL,
    reason character varying(200) NOT NULL,
    work_order_id integer,
    notes text,
    user_id integer,
    previous_quantity integer NOT NULL,
    new_quantity integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.suppliers (
    id SERIAL PRIMARY KEY,
    name character varying(100) NOT NULL,
    email character varying(100),
    phone character varying(20),
    address text,
    category character varying(50),
    contact_person character varying(100),
    website character varying(200),
    payment_terms character varying(100),
    status character varying(20) DEFAULT 'active',
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT suppliers_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    role text DEFAULT 'technician',
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    password text NOT NULL,
    requires_password_reset boolean DEFAULT true,
    refresh_token text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    phone text,
    department text,
    status text DEFAULT 'active',
    last_login timestamp without time zone,
    CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE public.warranty_periods (
    id SERIAL PRIMARY KEY,
    manufacturer text NOT NULL,
    model_name text NOT NULL,
    warranty_months integer DEFAULT 12 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.warranty_repair_tickets (
    id SERIAL PRIMARY KEY,
    ticket_number integer,
    customer_id integer NOT NULL,
    machine_id integer NOT NULL,
    problem_description text NOT NULL,
    notes text,
    additional_equipment text,
    brought_by text,
    submitted_by integer NOT NULL,
    status text DEFAULT 'intake' NOT NULL,
    converted_to_warranty_work_order_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    formatted_number text,
    year_created integer,
    converted_at timestamp without time zone,
    CONSTRAINT warranty_repair_tickets_status_check CHECK (status IN ('intake', 'converted', 'cancelled'))
);

CREATE TABLE public.warranty_work_orders (
    id SERIAL PRIMARY KEY,
    machine_id integer NOT NULL,
    customer_id integer NOT NULL,
    description text,
    status text DEFAULT 'pending',
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    technician_id integer,
    priority text DEFAULT 'medium',
    estimated_hours integer,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    due_date timestamp without time zone,
    labor_hours numeric(10,2),
    labor_rate numeric(10,2) DEFAULT 50.00,
    troubleshooting_fee numeric(10,2) DEFAULT 0,
    quote_subtotal_parts numeric(10,2) DEFAULT 0,
    quote_total numeric(10,2) DEFAULT 0,
    converted_from_ticket_id integer,
    ticket_number integer,
    owner_technician_id integer,
    formatted_number text,
    year_created integer
);

CREATE TABLE public.warranty_work_order_inventory (
    id SERIAL PRIMARY KEY,
    warranty_work_order_id integer NOT NULL,
    inventory_id integer NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT warranty_work_order_inventory_quantity_check CHECK (quantity > 0)
);

CREATE TABLE public.warranty_work_order_notes (
    id SERIAL PRIMARY KEY,
    warranty_work_order_id integer,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.work_order_attachments (
    id SERIAL PRIMARY KEY,
    work_order_id integer NOT NULL,
    filename character varying(255) NOT NULL,
    original_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL,
    file_type character varying(50) DEFAULT 'general',
    description text,
    uploaded_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.work_order_inventory (
    id SERIAL PRIMARY KEY,
    work_order_id integer NOT NULL,
    inventory_id integer NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT work_order_inventory_quantity_check CHECK (quantity > 0)
);

CREATE TABLE public.work_order_notes (
    id SERIAL PRIMARY KEY,
    work_order_id integer,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.work_order_templates (
    id SERIAL PRIMARY KEY,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    category character varying(100) NOT NULL,
    estimated_hours numeric(5,2) DEFAULT 0,
    required_parts text[] DEFAULT '{}',
    steps text[] NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.work_order_time_entries (
    id SERIAL PRIMARY KEY,
    work_order_id integer NOT NULL,
    technician_id integer NOT NULL,
    start_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    end_time timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.work_orders (
    id SERIAL PRIMARY KEY,
    machine_id integer NOT NULL,
    customer_id integer NOT NULL,
    description text,
    status text DEFAULT 'pending',
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    technician_id integer,
    priority text DEFAULT 'medium',
    estimated_hours integer,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    due_date timestamp without time zone,
    total_cost numeric(10,2) DEFAULT 0,
    is_warranty boolean DEFAULT false,
    labor_hours numeric(6,2),
    labor_rate numeric(10,2),
    quote_subtotal_parts numeric(12,2),
    quote_total numeric(12,2),
    approval_status text,
    approval_at timestamp without time zone,
    troubleshooting_fee numeric(12,2),
    paid_at timestamp without time zone,
    ticket_number integer,
    converted_from_ticket_id integer,
    owner_technician_id integer,
    converted_by_user_id integer,
    formatted_number text,
    year_created integer
);

CREATE TABLE public.yearly_sequences (
    id SERIAL PRIMARY KEY,
    year integer NOT NULL,
    current_sequence integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Views
CREATE VIEW public.assigned_machines_with_details AS
SELECT am.id,
    am.serial_id,
    am.customer_id,
    am.purchase_date,
    am.warranty_expiry_date,
    am.warranty_active,
    am.description,
    am.assigned_at,
    am.updated_at,
    ms.serial_number,
    mm.name AS model_name,
    mm.catalogue_number,
    mm.manufacturer,
    c.name AS customer_name,
    c.email AS customer_email,
    c.phone AS customer_phone
FROM assigned_machines am
JOIN machine_serials ms ON am.serial_id = ms.id
JOIN machine_models mm ON ms.model_id = mm.id
JOIN customers c ON am.customer_id = c.id;

CREATE VIEW public.machine_models_with_stats AS
SELECT mm.id,
    mm.name,
    mm.catalogue_number,
    mm.manufacturer,
    mm.category_id,
    mm.description,
    mm.created_at,
    mm.updated_at,
    mc.name AS category_name,
    count(ms.id) AS total_serials,
    count(CASE WHEN ms.status = 'assigned' THEN 1 END) AS assigned_serials,
    count(CASE WHEN ms.status = 'available' THEN 1 END) AS available_serials,
    min(ms.created_at) AS first_serial_created,
    max(ms.created_at) AS last_serial_created
FROM machine_models mm
LEFT JOIN machine_categories mc ON mm.category_id = mc.id
LEFT JOIN machine_serials ms ON mm.id = ms.model_id
GROUP BY mm.id, mm.name, mm.catalogue_number, mm.manufacturer, mm.category_id, mm.description, mm.created_at, mm.updated_at, mc.name;

CREATE VIEW public.repair_tickets_view AS
SELECT rt.id,
    rt.ticket_number,
    rt.formatted_number,
    rt.year_created,
    rt.customer_id,
    c.name AS customer_name,
    c.company_name,
    c.vat_number,
    c.city,
    c.postal_code,
    c.street_address,
    c.phone AS phone1,
    c.phone2,
    c.fax,
    c.email,
    rt.machine_id,
    mm.manufacturer,
    am.description AS bought_at,
    mm.category_id,
    mc.name AS category_name,
    mm.name AS model_name,
    mm.catalogue_number,
    mm.description AS model_description,
    ms.serial_number,
    am.receipt_number AS receipt_number,
    am.purchase_date,
    am.warranty_expiry_date,
    rt.problem_description,
    rt.notes,
    rt.additional_equipment,
    rt.brought_by,
    rt.submitted_by,
    u.name AS submitted_by_name,
    rt.status,
    rt.converted_to_work_order_id,
    wo.formatted_number AS converted_work_order_formatted_number,
    wo.year_created AS converted_work_order_year_created,
    wo.owner_technician_id AS converted_by_technician_id,
    tech.name AS converted_by_technician_name,
    rt.converted_at,
    rt.created_at,
    rt.updated_at
FROM repair_tickets rt
LEFT JOIN customers c ON rt.customer_id = c.id
LEFT JOIN assigned_machines am ON rt.machine_id = am.id
LEFT JOIN machine_serials ms ON am.serial_id = ms.id
LEFT JOIN machine_models mm ON ms.model_id = mm.id
LEFT JOIN machine_categories mc ON mm.category_id = mc.id
LEFT JOIN users u ON rt.submitted_by = u.id
LEFT JOIN work_orders wo ON rt.converted_to_work_order_id = wo.id
LEFT JOIN users tech ON wo.owner_technician_id = tech.id;

CREATE VIEW public.warranty_repair_tickets_view AS
SELECT wrt.id,
    wrt.ticket_number,
    wrt.formatted_number,
    wrt.year_created,
    wrt.customer_id,
    c.name AS customer_name,
    c.company_name,
    c.vat_number,
    c.city,
    c.postal_code,
    c.street_address,
    c.phone AS phone1,
    c.phone2,
    c.fax,
    c.email,
    wrt.machine_id,
    mm.manufacturer,
    am.description AS bought_at,
    mm.category_id,
    mc.name AS category_name,
    mm.name AS model_name,
    mm.catalogue_number,
    mm.description AS model_description,
    ms.serial_number,
    am.receipt_number AS receipt_number,
    am.purchase_date,
    am.warranty_expiry_date,
    wrt.problem_description,
    wrt.notes,
    wrt.additional_equipment,
    wrt.brought_by,
    wrt.submitted_by,
    u.name AS submitted_by_name,
    wrt.status,
    wrt.converted_to_warranty_work_order_id,
    wwo.formatted_number AS converted_warranty_work_order_formatted_number,
    wwo.year_created AS converted_warranty_work_order_year_created,
    wwo.owner_technician_id AS converted_by_technician_id,
    tech.name AS converted_by_technician_name,
    wrt.converted_at,
    wrt.created_at,
    wrt.updated_at
FROM warranty_repair_tickets wrt
LEFT JOIN customers c ON wrt.customer_id = c.id
LEFT JOIN assigned_machines am ON wrt.machine_id = am.id
LEFT JOIN machine_serials ms ON am.serial_id = ms.id
LEFT JOIN machine_models mm ON ms.model_id = mm.id
LEFT JOIN machine_categories mc ON mm.category_id = mc.id
LEFT JOIN users u ON wrt.submitted_by = u.id
LEFT JOIN warranty_work_orders wwo ON wrt.converted_to_warranty_work_order_id = wwo.id
LEFT JOIN users tech ON wwo.owner_technician_id = tech.id;

-- Foreign Key Constraints
ALTER TABLE public.assigned_machines ADD CONSTRAINT assigned_machines_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.assigned_machines ADD CONSTRAINT assigned_machines_serial_id_fkey FOREIGN KEY (serial_id) REFERENCES public.machine_serials(id) ON DELETE CASCADE;
ALTER TABLE public.customer_communications ADD CONSTRAINT customer_communications_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.customer_communications ADD CONSTRAINT customer_communications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.customer_preferences ADD CONSTRAINT customer_preferences_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.machine_models ADD CONSTRAINT machine_models_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.machine_categories(id) ON DELETE SET NULL;
ALTER TABLE public.machine_serials ADD CONSTRAINT machine_serials_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.machine_models(id) ON DELETE CASCADE;
ALTER TABLE public.machines ADD CONSTRAINT machines_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.machines ADD CONSTRAINT machines_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.machine_categories(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.repair_tickets ADD CONSTRAINT repair_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.repair_tickets ADD CONSTRAINT repair_tickets_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;
ALTER TABLE public.repair_tickets ADD CONSTRAINT repair_tickets_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.repair_tickets ADD CONSTRAINT repair_tickets_converted_to_work_order_id_fkey FOREIGN KEY (converted_to_work_order_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;
ALTER TABLE public.repair_tickets ADD CONSTRAINT repair_tickets_converted_to_warranty_work_order_id_fkey FOREIGN KEY (converted_to_warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE SET NULL;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE CASCADE;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.warranty_repair_tickets ADD CONSTRAINT warranty_repair_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.warranty_repair_tickets ADD CONSTRAINT warranty_repair_tickets_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;
ALTER TABLE public.warranty_repair_tickets ADD CONSTRAINT warranty_repair_tickets_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.warranty_repair_tickets ADD CONSTRAINT warranty_repair_tickets_converted_to_warranty_work_order_id_fkey FOREIGN KEY (converted_to_warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE SET NULL;
ALTER TABLE public.warranty_work_orders ADD CONSTRAINT warranty_work_orders_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;
ALTER TABLE public.warranty_work_orders ADD CONSTRAINT warranty_work_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.warranty_work_orders ADD CONSTRAINT warranty_work_orders_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.warranty_work_orders ADD CONSTRAINT warranty_work_orders_converted_from_ticket_id_fkey FOREIGN KEY (converted_from_ticket_id) REFERENCES public.repair_tickets(id) ON DELETE SET NULL;
ALTER TABLE public.warranty_work_orders ADD CONSTRAINT warranty_work_orders_owner_technician_id_fkey FOREIGN KEY (owner_technician_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.warranty_work_order_inventory ADD CONSTRAINT warranty_work_order_inventory_warranty_work_order_id_fkey FOREIGN KEY (warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE CASCADE;
ALTER TABLE public.warranty_work_order_inventory ADD CONSTRAINT warranty_work_order_inventory_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE RESTRICT;
ALTER TABLE public.warranty_work_order_notes ADD CONSTRAINT warranty_work_order_notes_warranty_work_order_id_fkey FOREIGN KEY (warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE CASCADE;
ALTER TABLE public.work_order_attachments ADD CONSTRAINT work_order_attachments_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;
ALTER TABLE public.work_order_attachments ADD CONSTRAINT work_order_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.work_order_inventory ADD CONSTRAINT work_order_inventory_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;
ALTER TABLE public.work_order_inventory ADD CONSTRAINT work_order_inventory_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE RESTRICT;
ALTER TABLE public.work_order_notes ADD CONSTRAINT work_order_notes_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;
ALTER TABLE public.work_order_time_entries ADD CONSTRAINT work_order_time_entries_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;
ALTER TABLE public.work_order_time_entries ADD CONSTRAINT work_order_time_entries_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_converted_from_ticket_id_fkey FOREIGN KEY (converted_from_ticket_id) REFERENCES public.repair_tickets(id) ON DELETE SET NULL;
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_owner_technician_id_fkey FOREIGN KEY (owner_technician_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_converted_by_user_id_fkey FOREIGN KEY (converted_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- Triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.assigned_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customer_communications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customer_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.machine_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.machine_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.machine_serials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_order_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_order_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_attachments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_time_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.yearly_sequences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_formatted_number_repair_tickets BEFORE INSERT ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();
CREATE TRIGGER set_formatted_number_warranty_repair_tickets BEFORE INSERT ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();
CREATE TRIGGER set_formatted_number_warranty_work_orders BEFORE INSERT ON public.warranty_work_orders FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();
CREATE TRIGGER set_formatted_number_work_orders BEFORE INSERT ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();

CREATE TRIGGER set_ticket_number_trigger BEFORE INSERT ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();
CREATE TRIGGER set_warranty_ticket_number_trigger BEFORE INSERT ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();

CREATE TRIGGER set_warranty_expiry_trigger BEFORE INSERT OR UPDATE ON public.assigned_machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_expiry();
CREATE TRIGGER trg_set_warranty_active BEFORE INSERT OR UPDATE OF warranty_expiry_date ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_active();

-- Indexes for better performance
CREATE INDEX idx_assigned_machines_customer_id ON public.assigned_machines USING btree (customer_id);
CREATE INDEX idx_assigned_machines_serial_id ON public.assigned_machines USING btree (serial_id);
CREATE INDEX idx_inventory_category ON public.inventory USING btree (category);
CREATE INDEX idx_inventory_sku ON public.inventory USING btree (sku);
CREATE INDEX idx_inventory_supplier ON public.inventory USING btree (supplier);
CREATE INDEX idx_machine_models_catalogue ON public.machine_models USING btree (catalogue_number);
CREATE INDEX idx_machine_models_manufacturer ON public.machine_models USING btree (manufacturer);
CREATE INDEX idx_machine_models_name ON public.machine_models USING btree (name);
CREATE INDEX idx_machine_serials_model_id ON public.machine_serials USING btree (model_id);
CREATE INDEX idx_machine_serials_status ON public.machine_serials USING btree (status);
CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);
CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);
CREATE INDEX idx_notifications_message_key ON public.notifications USING btree (message_key);
CREATE INDEX idx_notifications_title_key ON public.notifications USING btree (title_key);
CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX idx_repair_tickets_converted_to_warranty_work_order_id ON public.repair_tickets USING btree (converted_to_warranty_work_order_id);
CREATE INDEX idx_repair_tickets_created_by ON public.repair_tickets USING btree (submitted_by);
CREATE INDEX idx_repair_tickets_customer_id ON public.repair_tickets USING btree (customer_id);
CREATE INDEX idx_repair_tickets_formatted_number ON public.repair_tickets USING btree (formatted_number);
CREATE INDEX idx_repair_tickets_machine_id ON public.repair_tickets USING btree (machine_id);
CREATE INDEX idx_repair_tickets_status ON public.repair_tickets USING btree (status);
CREATE INDEX idx_repair_tickets_ticket_number ON public.repair_tickets USING btree (ticket_number);
CREATE INDEX idx_repair_tickets_year_created ON public.repair_tickets USING btree (year_created);
CREATE INDEX idx_users_department ON public.users USING btree (department);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_last_login ON public.users USING btree (last_login);
CREATE INDEX idx_users_status ON public.users USING btree (status);
CREATE INDEX idx_warranty_repair_tickets_converted_at ON public.warranty_repair_tickets USING btree (converted_at);
CREATE INDEX idx_warranty_repair_tickets_customer_id ON public.warranty_repair_tickets USING btree (customer_id);
CREATE INDEX idx_warranty_repair_tickets_formatted_number ON public.warranty_repair_tickets USING btree (formatted_number);
CREATE INDEX idx_warranty_repair_tickets_machine_id ON public.warranty_repair_tickets USING btree (machine_id);
CREATE INDEX idx_warranty_repair_tickets_status ON public.warranty_repair_tickets USING btree (status);
CREATE INDEX idx_warranty_repair_tickets_ticket_number ON public.warranty_repair_tickets USING btree (ticket_number);
CREATE INDEX idx_warranty_repair_tickets_year_created ON public.warranty_repair_tickets USING btree (year_created);
CREATE INDEX idx_warranty_work_orders_customer_id ON public.warranty_work_orders USING btree (customer_id);
CREATE INDEX idx_warranty_work_orders_due_date ON public.warranty_work_orders USING btree (due_date);
CREATE INDEX idx_warranty_work_orders_formatted_number ON public.warranty_work_orders USING btree (formatted_number);
CREATE INDEX idx_warranty_work_orders_machine_id ON public.warranty_work_orders USING btree (machine_id);
CREATE INDEX idx_warranty_work_orders_owner_technician_id ON public.warranty_work_orders USING btree (owner_technician_id);
CREATE INDEX idx_warranty_work_orders_priority ON public.warranty_work_orders USING btree (priority);
CREATE INDEX idx_warranty_work_orders_status ON public.warranty_work_orders USING btree (status);
CREATE INDEX idx_warranty_work_orders_technician_id ON public.warranty_work_orders USING btree (technician_id);
CREATE INDEX idx_warranty_work_orders_ticket_number ON public.warranty_work_orders USING btree (ticket_number);
CREATE INDEX idx_warranty_work_orders_year_created ON public.warranty_work_orders USING btree (year_created);
CREATE INDEX idx_work_orders_converted_by_user_id ON public.work_orders USING btree (converted_by_user_id);
CREATE INDEX idx_work_orders_created_at ON public.work_orders USING btree (created_at);
CREATE INDEX idx_work_orders_formatted_number ON public.work_orders USING btree (formatted_number);
CREATE INDEX idx_work_orders_owner_technician_id ON public.work_orders USING btree (owner_technician_id);
CREATE INDEX idx_work_orders_ticket_number ON public.work_orders USING btree (ticket_number);
CREATE INDEX idx_work_orders_year_created ON public.work_orders USING btree (year_created);
CREATE INDEX idx_yearly_sequences_year ON public.yearly_sequences USING btree (year);

-- Unique constraints
CREATE UNIQUE INDEX uniq_machine_model_serial ON public.machines USING btree (COALESCE(name, ''::text), COALESCE(catalogue_number, ''::text), COALESCE(serial_number, ''::text));
