--
-- Repair Shop Management System Database Schema
-- Generated from comprehensive backup: DB SA PRODAJOM FINAL.sql
-- Date: 2025-09-04
-- PostgreSQL version: 17.5
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;

ALTER SCHEMA public OWNER TO pg_database_owner;

COMMENT ON SCHEMA public IS 'standard public schema';

--
-- FUNCTIONS
--

-- Calculate warranty expiry based on model ID
CREATE FUNCTION public.calculate_warranty_expiry(purchase_date date, model_id integer) RETURNS date
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

-- Calculate warranty expiry based on manufacturer and model name
CREATE FUNCTION public.calculate_warranty_expiry(purchase_date date, manufacturer text, model_name text) RETURNS date
    LANGUAGE plpgsql
    AS $$
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
$$;

-- Copy ticket number from repair ticket to work order
CREATE FUNCTION public.copy_ticket_number_to_work_order(ticket_id integer, ticket_type text, work_order_id integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF ticket_type = 'repair_ticket' THEN
        UPDATE work_orders 
        SET ticket_number = (
            SELECT ticket_number 
            FROM repair_tickets 
            WHERE id = ticket_id
        )
        WHERE id = work_order_id;
    ELSIF ticket_type = 'warranty_repair_ticket' THEN
        UPDATE warranty_work_orders 
        SET ticket_number = (
            SELECT ticket_number 
            FROM warranty_repair_tickets 
            WHERE id = ticket_id
        )
        WHERE id = work_order_id;
    END IF;
END;
$$;

-- Generate formatted number for tickets and work orders
CREATE FUNCTION public.generate_formatted_number() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_year integer;
    next_sequence integer;
    formatted_number text;
BEGIN
    -- Get current year
    current_year := EXTRACT(year FROM CURRENT_DATE);
    
    -- Get or create sequence for current year
    INSERT INTO yearly_sequences (year, next_value)
    VALUES (current_year, 2)
    ON CONFLICT (year) 
    DO UPDATE SET next_value = yearly_sequences.next_value + 1
    RETURNING next_value - 1 INTO next_sequence;
    
    -- Format as YYYY-NNNN
    formatted_number := current_year || '-' || LPAD(next_sequence::text, 4, '0');
    
    RETURN formatted_number;
END;
$$;

-- Get next ticket number for a specific table
CREATE FUNCTION public.get_next_ticket_number(table_name text) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    next_number integer;
    sequence_name text;
BEGIN
    -- Determine sequence name based on table
    CASE table_name
        WHEN 'repair_tickets' THEN
            sequence_name := 'repair_tickets_ticket_number_seq';
        WHEN 'warranty_repair_tickets' THEN
            sequence_name := 'warranty_repair_tickets_ticket_number_seq';
        WHEN 'work_orders' THEN
            sequence_name := 'work_orders_ticket_number_seq';
        WHEN 'warranty_work_orders' THEN
            sequence_name := 'warranty_work_orders_ticket_number_seq';
        ELSE
            RAISE EXCEPTION 'Unknown table name: %', table_name;
    END CASE;
    
    -- Get next value from sequence
    EXECUTE format('SELECT nextval(%L)', sequence_name) INTO next_number;
    
    RETURN next_number;
END;
$$;

-- Set formatted number and year for tickets and work orders
CREATE FUNCTION public.set_formatted_number_and_year() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Set year_created if not already set
    IF NEW.year_created IS NULL THEN
        NEW.year_created := EXTRACT(year FROM CURRENT_DATE);
    END IF;
    
    -- Set formatted_number if not already set
    IF NEW.formatted_number IS NULL THEN
        NEW.formatted_number := generate_formatted_number();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Set ticket number for new records
CREATE FUNCTION public.set_ticket_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := nextval('ticket_number_seq');
    END IF;
    RETURN NEW;
END;
$$;

-- Update updated_at timestamp
CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Set warranty active status based on expiry date
CREATE FUNCTION public.set_warranty_active() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Set warranty_active based on warranty_expiry_date
    IF NEW.warranty_expiry_date IS NOT NULL THEN
        NEW.warranty_active := (NEW.warranty_expiry_date >= CURRENT_DATE);
    ELSE
        NEW.warranty_active := false;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Set warranty active status for assigned machines
CREATE FUNCTION public.set_warranty_active_assigned_machines() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Set warranty_active based on warranty_expiry_date
    IF NEW.warranty_expiry_date IS NOT NULL THEN
        NEW.warranty_active := (NEW.warranty_expiry_date >= CURRENT_DATE);
    ELSE
        NEW.warranty_active := false;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Set warranty expiry date based on purchase date and model
CREATE FUNCTION public.set_warranty_expiry() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Only calculate if purchase_date exists and warranty_expiry_date is not set
    IF NEW.purchase_date IS NOT NULL AND NEW.warranty_expiry_date IS NULL THEN
        -- Try to get warranty from machine model first
        IF NEW.model_id IS NOT NULL THEN
            NEW.warranty_expiry_date := calculate_warranty_expiry(NEW.purchase_date, NEW.model_id);
        -- Fallback to manufacturer/model name lookup
        ELSIF NEW.manufacturer IS NOT NULL AND NEW.name IS NOT NULL THEN
            NEW.warranty_expiry_date := calculate_warranty_expiry(NEW.purchase_date, NEW.manufacturer, NEW.name);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Update quote status timestamp
CREATE FUNCTION public.update_quote_status_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Update status-specific timestamps when status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        CASE NEW.status
            WHEN 'accepted' THEN
                NEW.accepted_at = CURRENT_TIMESTAMP;
            WHEN 'rejected' THEN
                NEW.rejected_at = CURRENT_TIMESTAMP;
            WHEN 'converted' THEN
                NEW.converted_at = CURRENT_TIMESTAMP;
            ELSE
                -- No specific timestamp for other statuses
        END CASE;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Generic timestamp update function
CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Update updated_at column
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

--
-- SEQUENCES
--

-- Ticket number sequence
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1000;

--
-- TABLES
--

-- Assigned machines (customer-machine relationships with sales data)
CREATE TABLE public.assigned_machines (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    serial_id integer NOT NULL,
    purchase_date date,
    warranty_expiry_date date,
    warranty_active boolean DEFAULT false,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    added_by_user_id integer,
    sold_by_user_id integer,
    machine_condition text DEFAULT 'new'::text,
    sale_date date,
    sale_price numeric(12,2),
    is_sale boolean DEFAULT false,
    sales_opportunity boolean DEFAULT false,
    sales_notes text,
    potential_value numeric(12,2),
    sales_user_id integer,
    lead_quality text,
    sales_stage text,
    customer_satisfaction_score integer,
    upsell_opportunity boolean DEFAULT false,
    recommended_products text
);

-- Customers (with sales ownership and metrics)
CREATE TABLE public.customers (
    id integer NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    address text,
    company_name text,
    contact_person text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    owner_id integer,
    pipeline_position integer DEFAULT 0
);

-- Machine models
CREATE TABLE public.machine_models (
    id integer NOT NULL,
    manufacturer text NOT NULL,
    name text NOT NULL,
    category text,
    description text,
    catalogue_number text,
    warranty_months integer DEFAULT 12,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Machine serials
CREATE TABLE public.machine_serials (
    id integer NOT NULL,
    model_id integer NOT NULL,
    serial_number text NOT NULL,
    status text DEFAULT 'available'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Customer communications
CREATE TABLE public.customer_communications (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    communication_type text NOT NULL,
    subject text,
    content text NOT NULL,
    direction text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    attachments_count integer DEFAULT 0,
    is_internal boolean DEFAULT false,
    priority text DEFAULT 'normal'::text,
    status text DEFAULT 'active'::text,
    tags text[],
    reference_id integer,
    reference_type text
);

-- Inventory
CREATE TABLE public.inventory (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    sku text,
    category text,
    quantity integer DEFAULT 0,
    unit_price numeric(10,2),
    supplier text,
    reorder_level integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location text,
    barcode text,
    notes text,
    is_active boolean DEFAULT true
);

-- Lead follow-ups
CREATE TABLE public.lead_follow_ups (
    id integer NOT NULL,
    lead_id integer NOT NULL,
    follow_up_date timestamp without time zone NOT NULL,
    follow_up_type text NOT NULL,
    notes text,
    outcome text,
    next_action text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    completed boolean DEFAULT false,
    completed_at timestamp without time zone
);

-- Leads (sales prospects)
CREATE TABLE public.leads (
    id integer NOT NULL,
    customer_name text NOT NULL,
    company_name text,
    email text,
    phone text,
    lead_source text,
    lead_quality text DEFAULT 'cold'::text,
    sales_stage text DEFAULT 'new'::text,
    potential_value numeric(12,2),
    assigned_to integer,
    notes text,
    next_follow_up timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    sales_notes text,
    converted boolean DEFAULT false,
    converted_at timestamp without time zone,
    conversion_type text,
    conversion_value numeric(12,2)
);

-- Machine categories
CREATE TABLE public.machine_categories (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Machine rentals
CREATE TABLE public.machine_rentals (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    machine_id integer NOT NULL,
    rental_start_date date NOT NULL,
    rental_end_date date,
    daily_rate numeric(10,2) NOT NULL,
    total_amount numeric(12,2),
    rental_status text DEFAULT 'active'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    deposit_amount numeric(12,2),
    deposit_paid boolean DEFAULT false,
    return_condition text,
    damage_charges numeric(12,2) DEFAULT 0
);

-- Machines (legacy table - consider deprecating in favor of machine_serials)
CREATE TABLE public.machines (
    id integer NOT NULL,
    name text NOT NULL,
    manufacturer text,
    model text,
    serial_number text,
    catalogue_number text,
    purchase_date date,
    warranty_expiry_date date,
    warranty_active boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    model_id integer
);

-- Notifications
CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    title_key text,
    message_key text,
    message_params jsonb DEFAULT '{}'::jsonb,
    action_url text,
    action_label text
);

-- Quote items
CREATE TABLE public.quote_items (
    id integer NOT NULL,
    quote_id integer NOT NULL,
    description text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    unit_price numeric(12,2) NOT NULL,
    total_price numeric(12,2) NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Quotes
CREATE TABLE public.quotes (
    id integer NOT NULL,
    quote_number text NOT NULL,
    customer_id integer,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    subtotal numeric(12,2) NOT NULL DEFAULT 0,
    tax_rate numeric(5,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) NOT NULL DEFAULT 0,
    status text DEFAULT 'draft'::text,
    valid_until date,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    accepted_at timestamp without time zone,
    rejected_at timestamp without time zone,
    converted_at timestamp without time zone
);

-- Repair tickets (with sales data)
CREATE TABLE public.repair_tickets (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    machine_id integer NOT NULL,
    problem_description text NOT NULL,
    status text DEFAULT 'submitted'::text,
    priority text DEFAULT 'medium'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    submitted_by integer,
    assigned_to integer,
    ticket_number integer,
    formatted_number text,
    year_created integer,
    converted_to_work_order_id integer,
    converted_at timestamp without time zone,
    converted_by_user_id integer,
    converted_to_warranty_work_order_id integer,
    sales_opportunity boolean DEFAULT false,
    sales_notes text,
    potential_value numeric(12,2),
    sales_user_id integer,
    lead_quality text,
    sales_stage text
);

-- Schema migrations tracking
CREATE TABLE public.schema_migrations (
    version text NOT NULL,
    applied_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Stock movements
CREATE TABLE public.stock_movements (
    id integer NOT NULL,
    inventory_id integer NOT NULL,
    movement_type text NOT NULL,
    quantity integer NOT NULL,
    reference_type text,
    reference_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    unit_cost numeric(10,2)
);

-- Suppliers
CREATE TABLE public.suppliers (
    id integer NOT NULL,
    name text NOT NULL,
    contact_person text,
    email text,
    phone text,
    address text,
    website text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    payment_terms text,
    tax_id text,
    account_number text,
    preferred_currency text DEFAULT 'USD'::text,
    credit_limit numeric(12,2),
    rating integer
);

-- Users
CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'technician'::text,
    department text,
    phone text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp without time zone,
    status text DEFAULT 'active'::text,
    last_seen timestamp without time zone
);

-- Warranty periods
CREATE TABLE public.warranty_periods (
    id integer NOT NULL,
    manufacturer text NOT NULL,
    model_name text NOT NULL,
    warranty_months integer NOT NULL DEFAULT 12,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Warranty repair tickets (with sales data)
CREATE TABLE public.warranty_repair_tickets (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    machine_id integer NOT NULL,
    problem_description text NOT NULL,
    status text DEFAULT 'submitted'::text,
    priority text DEFAULT 'medium'::text,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    submitted_by integer,
    assigned_to integer,
    ticket_number integer,
    formatted_number text,
    year_created integer,
    converted_to_work_order_id integer,
    converted_at timestamp without time zone,
    converted_by_user_id integer,
    sales_opportunity boolean DEFAULT false,
    sales_notes text,
    potential_value numeric(12,2),
    sales_user_id integer,
    lead_quality text,
    sales_stage text
);

-- Warranty work order inventory
CREATE TABLE public.warranty_work_order_inventory (
    id integer NOT NULL,
    work_order_id integer NOT NULL,
    inventory_id integer NOT NULL,
    quantity_used integer NOT NULL,
    unit_cost numeric(10,2),
    total_cost numeric(12,2),
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    added_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text
);

-- Warranty work order notes
CREATE TABLE public.warranty_work_order_notes (
    id integer NOT NULL,
    work_order_id integer NOT NULL,
    note text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    is_internal boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    note_type text DEFAULT 'general'::text,
    time_spent integer,
    billable_hours numeric(4,2)
);

-- Warranty work orders (with sales data)
CREATE TABLE public.warranty_work_orders (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    machine_id integer NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text,
    priority text DEFAULT 'medium'::text,
    technician_id integer,
    owner_technician_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    due_date date,
    completed_at timestamp without time zone,
    notes text,
    ticket_number integer,
    formatted_number text,
    year_created integer,
    repair_ticket_id integer,
    sales_opportunity boolean DEFAULT false,
    sales_notes text,
    potential_value numeric(12,2),
    sales_user_id integer,
    lead_quality text,
    sales_stage text
);

-- Work order attachments
CREATE TABLE public.work_order_attachments (
    id integer NOT NULL,
    work_order_id integer NOT NULL,
    filename text NOT NULL,
    original_filename text NOT NULL,
    file_path text NOT NULL,
    file_size integer,
    mime_type text,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    uploaded_by integer,
    description text,
    is_public boolean DEFAULT false,
    file_category text DEFAULT 'general'::text
);

-- Work order inventory
CREATE TABLE public.work_order_inventory (
    id integer NOT NULL,
    work_order_id integer NOT NULL,
    inventory_id integer NOT NULL,
    quantity_used integer NOT NULL,
    unit_cost numeric(10,2),
    total_cost numeric(12,2),
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    added_by integer,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text
);

-- Work order notes
CREATE TABLE public.work_order_notes (
    id integer NOT NULL,
    work_order_id integer NOT NULL,
    note text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    is_internal boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    note_type text DEFAULT 'general'::text,
    time_spent integer,
    billable_hours numeric(4,2)
);

-- Work order templates
CREATE TABLE public.work_order_templates (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    template_data jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    category text,
    estimated_duration integer,
    required_skills text[]
);

-- Work order time entries
CREATE TABLE public.work_order_time_entries (
    id integer NOT NULL,
    work_order_id integer NOT NULL,
    user_id integer NOT NULL,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    duration_minutes integer,
    description text,
    billable_hours numeric(4,2),
    hourly_rate numeric(8,2),
    total_cost numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_billable boolean DEFAULT true,
    activity_type text DEFAULT 'repair'::text,
    break_duration_minutes integer DEFAULT 0
);

-- Work orders (with sales data)
CREATE TABLE public.work_orders (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    machine_id integer NOT NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text,
    priority text DEFAULT 'medium'::text,
    technician_id integer,
    owner_technician_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    due_date date,
    completed_at timestamp without time zone,
    notes text,
    is_warranty boolean DEFAULT false,
    labor_hours numeric(6,2),
    labor_rate numeric(10,2),
    quote_subtotal_parts numeric(12,2),
    quote_total numeric(12,2),
    approval_status text,
    approval_at timestamp without time zone,
    troubleshooting_fee numeric(12,2),
    paid_at timestamp without time zone,
    total_cost numeric(12,2),
    ticket_number integer,
    formatted_number text,
    year_created integer,
    repair_ticket_id integer,
    converted_by_user_id integer,
    sales_opportunity boolean DEFAULT false,
    sales_notes text,
    potential_value numeric(12,2),
    sales_user_id integer,
    lead_quality text,
    sales_stage text
);

-- Yearly sequences for formatted numbers
CREATE TABLE public.yearly_sequences (
    year integer NOT NULL,
    next_value integer DEFAULT 1
);

--
-- VIEWS
--

-- Assigned machines with detailed information
CREATE VIEW public.assigned_machines_with_details AS
 SELECT am.id,
    am.customer_id,
    am.serial_id,
    am.purchase_date,
    am.warranty_expiry_date,
    am.warranty_active,
    am.notes,
    am.is_active,
    am.created_at,
    am.updated_at,
    c.name AS customer_name,
    c.company_name,
    ms.serial_number,
    mm.manufacturer,
    mm.name AS model_name,
    mm.category,
    mm.warranty_months,
    am.sold_by_user_id,
    am.machine_condition,
    am.sale_date,
    am.sale_price,
    am.is_sale,
    am.sales_opportunity,
    am.sales_notes,
    am.potential_value,
    am.sales_user_id,
    am.lead_quality,
    am.sales_stage,
    am.customer_satisfaction_score,
    am.upsell_opportunity,
    am.recommended_products,
    u.name AS sales_user_name
   FROM (((public.assigned_machines am
     JOIN public.customers c ON (am.customer_id = c.id))
     JOIN public.machine_serials ms ON (am.serial_id = ms.id))
     JOIN public.machine_models mm ON (ms.model_id = mm.id))
     LEFT JOIN public.users u ON (am.sales_user_id = u.id);

-- Sales metrics per user
CREATE VIEW public.sales_metrics AS
 SELECT u.id AS user_id,
    u.name AS user_name,
    COALESCE(count(am.id), (0)::bigint) AS total_sales,
    COALESCE(sum(am.sale_price), (0)::numeric) AS total_revenue,
    COALESCE(avg(am.sale_price), (0)::numeric) AS average_sale_value,
    count(
        CASE
            WHEN (am.sales_opportunity = true) THEN 1
            ELSE NULL::integer
        END) AS active_opportunities,
    COALESCE(sum(am.potential_value), (0)::numeric) AS pipeline_value
   FROM (public.users u
     LEFT JOIN public.assigned_machines am ON (u.id = am.sales_user_id))
  WHERE ((u.role)::text = 'sales'::text)
  GROUP BY u.id, u.name;

-- Sales opportunities from leads
CREATE VIEW public.sales_opportunities AS
 SELECT 'lead'::text AS source_type,
    l.id AS source_id,
    NULL::integer AS customer_id,
    l.customer_name,
    l.company_name,
    NULL::integer AS machine_id,
    'Opportunity'::text AS machine_model,
    NULL::text AS serial_number,
    true AS sales_opportunity,
    l.potential_value,
    l.sales_notes,
    l.sales_stage,
    l.assigned_to AS sales_user_id,
    u.name AS sales_user_name,
    l.lead_quality,
    l.created_at,
    l.updated_at
   FROM (public.leads l
     LEFT JOIN public.users u ON (l.assigned_to = u.id));

--
-- PRIMARY KEYS
--

ALTER TABLE ONLY public.assigned_machines ADD CONSTRAINT assigned_machines_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.customer_communications ADD CONSTRAINT customer_communications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.inventory ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.lead_follow_ups ADD CONSTRAINT lead_follow_ups_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.machine_categories ADD CONSTRAINT machine_categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.machine_models ADD CONSTRAINT machine_models_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.machine_rentals ADD CONSTRAINT machine_rentals_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.machine_serials ADD CONSTRAINT machine_serials_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.machines ADD CONSTRAINT machines_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.quote_items ADD CONSTRAINT quote_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.quotes ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.repair_tickets ADD CONSTRAINT repair_tickets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.schema_migrations ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);
ALTER TABLE ONLY public.stock_movements ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.warranty_periods ADD CONSTRAINT warranty_periods_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.warranty_repair_tickets ADD CONSTRAINT warranty_repair_tickets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.warranty_work_order_inventory ADD CONSTRAINT warranty_work_order_inventory_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.warranty_work_order_notes ADD CONSTRAINT warranty_work_order_notes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.warranty_work_orders ADD CONSTRAINT warranty_work_orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.work_order_attachments ADD CONSTRAINT work_order_attachments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.work_order_inventory ADD CONSTRAINT work_order_inventory_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.work_order_notes ADD CONSTRAINT work_order_notes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.work_order_templates ADD CONSTRAINT work_order_templates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.work_order_time_entries ADD CONSTRAINT work_order_time_entries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.work_orders ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.yearly_sequences ADD CONSTRAINT yearly_sequences_pkey PRIMARY KEY (year);

--
-- UNIQUE CONSTRAINTS
--

ALTER TABLE ONLY public.customers ADD CONSTRAINT customers_email_key UNIQUE (email);
ALTER TABLE ONLY public.inventory ADD CONSTRAINT inventory_sku_key UNIQUE (sku);
ALTER TABLE ONLY public.machine_models ADD CONSTRAINT machine_models_manufacturer_name_key UNIQUE (manufacturer, name);
ALTER TABLE ONLY public.machine_serials ADD CONSTRAINT machine_serials_serial_number_key UNIQUE (serial_number);
ALTER TABLE ONLY public.quotes ADD CONSTRAINT quotes_quote_number_key UNIQUE (quote_number);
ALTER TABLE ONLY public.repair_tickets ADD CONSTRAINT repair_tickets_formatted_number_key UNIQUE (formatted_number);
ALTER TABLE ONLY public.repair_tickets ADD CONSTRAINT repair_tickets_ticket_number_key UNIQUE (ticket_number);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.warranty_periods ADD CONSTRAINT warranty_periods_manufacturer_model_name_key UNIQUE (manufacturer, model_name);
ALTER TABLE ONLY public.warranty_repair_tickets ADD CONSTRAINT warranty_repair_tickets_formatted_number_key UNIQUE (formatted_number);
ALTER TABLE ONLY public.warranty_repair_tickets ADD CONSTRAINT warranty_repair_tickets_ticket_number_key UNIQUE (ticket_number);
ALTER TABLE ONLY public.warranty_work_orders ADD CONSTRAINT warranty_work_orders_formatted_number_key UNIQUE (formatted_number);
ALTER TABLE ONLY public.warranty_work_orders ADD CONSTRAINT warranty_work_orders_ticket_number_key UNIQUE (ticket_number);
ALTER TABLE ONLY public.work_orders ADD CONSTRAINT work_orders_formatted_number_key UNIQUE (formatted_number);
ALTER TABLE ONLY public.work_orders ADD CONSTRAINT work_orders_ticket_number_key UNIQUE (ticket_number);

--
-- SEQUENCES
--

CREATE SEQUENCE public.assigned_machines_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.assigned_machines_id_seq OWNED BY public.assigned_machines.id;

CREATE SEQUENCE public.customer_communications_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.customer_communications_id_seq OWNED BY public.customer_communications.id;

CREATE SEQUENCE public.customers_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;

CREATE SEQUENCE public.inventory_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.inventory_id_seq OWNED BY public.inventory.id;

CREATE SEQUENCE public.lead_follow_ups_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.lead_follow_ups_id_seq OWNED BY public.lead_follow_ups.id;

CREATE SEQUENCE public.leads_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.leads_id_seq OWNED BY public.leads.id;

CREATE SEQUENCE public.machine_categories_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.machine_categories_id_seq OWNED BY public.machine_categories.id;

CREATE SEQUENCE public.machine_models_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.machine_models_id_seq OWNED BY public.machine_models.id;

CREATE SEQUENCE public.machine_rentals_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.machine_rentals_id_seq OWNED BY public.machine_rentals.id;

CREATE SEQUENCE public.machine_serials_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.machine_serials_id_seq OWNED BY public.machine_serials.id;

CREATE SEQUENCE public.machines_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.machines_id_seq OWNED BY public.machines.id;

CREATE SEQUENCE public.notifications_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;

CREATE SEQUENCE public.quote_items_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.quote_items_id_seq OWNED BY public.quote_items.id;

CREATE SEQUENCE public.quotes_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.quotes_id_seq OWNED BY public.quotes.id;

CREATE SEQUENCE public.repair_tickets_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.repair_tickets_id_seq OWNED BY public.repair_tickets.id;

CREATE SEQUENCE public.stock_movements_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;

CREATE SEQUENCE public.suppliers_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;

CREATE SEQUENCE public.users_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

CREATE SEQUENCE public.warranty_periods_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.warranty_periods_id_seq OWNED BY public.warranty_periods.id;

CREATE SEQUENCE public.warranty_repair_tickets_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.warranty_repair_tickets_id_seq OWNED BY public.warranty_repair_tickets.id;

CREATE SEQUENCE public.warranty_work_order_inventory_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.warranty_work_order_inventory_id_seq OWNED BY public.warranty_work_order_inventory.id;

CREATE SEQUENCE public.warranty_work_order_notes_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.warranty_work_order_notes_id_seq OWNED BY public.warranty_work_order_notes.id;

CREATE SEQUENCE public.warranty_work_orders_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.warranty_work_orders_id_seq OWNED BY public.warranty_work_orders.id;

CREATE SEQUENCE public.work_order_attachments_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.work_order_attachments_id_seq OWNED BY public.work_order_attachments.id;

CREATE SEQUENCE public.work_order_inventory_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.work_order_inventory_id_seq OWNED BY public.work_order_inventory.id;

CREATE SEQUENCE public.work_order_notes_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.work_order_notes_id_seq OWNED BY public.work_order_notes.id;

CREATE SEQUENCE public.work_order_templates_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.work_order_templates_id_seq OWNED BY public.work_order_templates.id;

CREATE SEQUENCE public.work_order_time_entries_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.work_order_time_entries_id_seq OWNED BY public.work_order_time_entries.id;

CREATE SEQUENCE public.work_orders_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.work_orders_id_seq OWNED BY public.work_orders.id;

--
-- SEQUENCE DEFAULTS
--

ALTER TABLE ONLY public.assigned_machines ALTER COLUMN id SET DEFAULT nextval('public.assigned_machines_id_seq'::regclass);
ALTER TABLE ONLY public.customer_communications ALTER COLUMN id SET DEFAULT nextval('public.customer_communications_id_seq'::regclass);
ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);
ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);
ALTER TABLE ONLY public.lead_follow_ups ALTER COLUMN id SET DEFAULT nextval('public.lead_follow_ups_id_seq'::regclass);
ALTER TABLE ONLY public.leads ALTER COLUMN id SET DEFAULT nextval('public.leads_id_seq'::regclass);
ALTER TABLE ONLY public.machine_categories ALTER COLUMN id SET DEFAULT nextval('public.machine_categories_id_seq'::regclass);
ALTER TABLE ONLY public.machine_models ALTER COLUMN id SET DEFAULT nextval('public.machine_models_id_seq'::regclass);
ALTER TABLE ONLY public.machine_rentals ALTER COLUMN id SET DEFAULT nextval('public.machine_rentals_id_seq'::regclass);
ALTER TABLE ONLY public.machine_serials ALTER COLUMN id SET DEFAULT nextval('public.machine_serials_id_seq'::regclass);
ALTER TABLE ONLY public.machines ALTER COLUMN id SET DEFAULT nextval('public.machines_id_seq'::regclass);
ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);
ALTER TABLE ONLY public.quote_items ALTER COLUMN id SET DEFAULT nextval('public.quote_items_id_seq'::regclass);
ALTER TABLE ONLY public.quotes ALTER COLUMN id SET DEFAULT nextval('public.quotes_id_seq'::regclass);
ALTER TABLE ONLY public.repair_tickets ALTER COLUMN id SET DEFAULT nextval('public.repair_tickets_id_seq'::regclass);
ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);
ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.warranty_periods ALTER COLUMN id SET DEFAULT nextval('public.warranty_periods_id_seq'::regclass);
ALTER TABLE ONLY public.warranty_repair_tickets ALTER COLUMN id SET DEFAULT nextval('public.warranty_repair_tickets_id_seq'::regclass);
ALTER TABLE ONLY public.warranty_work_order_inventory ALTER COLUMN id SET DEFAULT nextval('public.warranty_work_order_inventory_id_seq'::regclass);
ALTER TABLE ONLY public.warranty_work_order_notes ALTER COLUMN id SET DEFAULT nextval('public.warranty_work_order_notes_id_seq'::regclass);
ALTER TABLE ONLY public.warranty_work_orders ALTER COLUMN id SET DEFAULT nextval('public.warranty_work_orders_id_seq'::regclass);
ALTER TABLE ONLY public.work_order_attachments ALTER COLUMN id SET DEFAULT nextval('public.work_order_attachments_id_seq'::regclass);
ALTER TABLE ONLY public.work_order_inventory ALTER COLUMN id SET DEFAULT nextval('public.work_order_inventory_id_seq'::regclass);
ALTER TABLE ONLY public.work_order_notes ALTER COLUMN id SET DEFAULT nextval('public.work_order_notes_id_seq'::regclass);
ALTER TABLE ONLY public.work_order_templates ALTER COLUMN id SET DEFAULT nextval('public.work_order_templates_id_seq'::regclass);
ALTER TABLE ONLY public.work_order_time_entries ALTER COLUMN id SET DEFAULT nextval('public.work_order_time_entries_id_seq'::regclass);
ALTER TABLE ONLY public.work_orders ALTER COLUMN id SET DEFAULT nextval('public.work_orders_id_seq'::regclass);

--
-- PERFORMANCE INDEXES
--

-- Assigned machines indexes
CREATE INDEX idx_assigned_machines_added_by ON public.assigned_machines USING btree (added_by_user_id);
CREATE INDEX idx_assigned_machines_condition ON public.assigned_machines USING btree (machine_condition);
CREATE INDEX idx_assigned_machines_customer_id ON public.assigned_machines USING btree (customer_id);
CREATE INDEX idx_assigned_machines_serial_id ON public.assigned_machines USING btree (serial_id);
CREATE INDEX idx_assigned_machines_sold_by ON public.assigned_machines USING btree (sold_by_user_id);

-- Customer indexes
CREATE INDEX idx_customers_owner_id ON public.customers USING btree (owner_id);

-- Inventory indexes
CREATE INDEX idx_inventory_category ON public.inventory USING btree (category);
CREATE INDEX idx_inventory_sku ON public.inventory USING btree (sku);
CREATE INDEX idx_inventory_supplier ON public.inventory USING btree (supplier);

-- Lead indexes
CREATE INDEX idx_lead_follow_ups_created_at ON public.lead_follow_ups USING btree (created_at);
CREATE INDEX idx_lead_follow_ups_lead_id ON public.lead_follow_ups USING btree (lead_id);
CREATE INDEX idx_leads_assigned_to ON public.leads USING btree (assigned_to);
CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at);
CREATE INDEX idx_leads_lead_quality ON public.leads USING btree (lead_quality);
CREATE INDEX idx_leads_next_follow_up ON public.leads USING btree (next_follow_up);
CREATE INDEX idx_leads_quality ON public.leads USING btree (lead_quality);
CREATE INDEX idx_leads_sales_stage ON public.leads USING btree (sales_stage);
CREATE INDEX idx_leads_stage ON public.leads USING btree (sales_stage);

-- Machine indexes
CREATE INDEX idx_machine_models_catalogue ON public.machine_models USING btree (catalogue_number);
CREATE INDEX idx_machine_models_manufacturer ON public.machine_models USING btree (manufacturer);
CREATE INDEX idx_machine_models_name ON public.machine_models USING btree (name);
CREATE INDEX idx_machine_rentals_customer ON public.machine_rentals USING btree (customer_id);
CREATE INDEX idx_machine_rentals_dates ON public.machine_rentals USING btree (rental_start_date, rental_end_date);
CREATE INDEX idx_machine_rentals_status ON public.machine_rentals USING btree (rental_status);
CREATE INDEX idx_machine_serials_model_id ON public.machine_serials USING btree (model_id);
CREATE INDEX idx_machine_serials_status ON public.machine_serials USING btree (status);

-- Notification indexes
CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);
CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);
CREATE INDEX idx_notifications_message_key ON public.notifications USING btree (message_key);
CREATE INDEX idx_notifications_title_key ON public.notifications USING btree (title_key);
CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);
CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);

-- Quote indexes
CREATE INDEX idx_quote_items_quote_id ON public.quote_items USING btree (quote_id);
CREATE INDEX idx_quotes_created_at ON public.quotes USING btree (created_at);
CREATE INDEX idx_quotes_created_by ON public.quotes USING btree (created_by);
CREATE INDEX idx_quotes_customer_id ON public.quotes USING btree (customer_id);
CREATE INDEX idx_quotes_status ON public.quotes USING btree (status);
CREATE INDEX idx_quotes_valid_until ON public.quotes USING btree (valid_until);

-- Repair ticket indexes
CREATE INDEX idx_repair_tickets_converted_to_warranty_work_order_id ON public.repair_tickets USING btree (converted_to_warranty_work_order_id);
CREATE INDEX idx_repair_tickets_created_by ON public.repair_tickets USING btree (submitted_by);
CREATE INDEX idx_repair_tickets_customer_id ON public.repair_tickets USING btree (customer_id);
CREATE INDEX idx_repair_tickets_formatted_number ON public.repair_tickets USING btree (formatted_number);
CREATE INDEX idx_repair_tickets_machine_id ON public.repair_tickets USING btree (machine_id);
CREATE INDEX idx_repair_tickets_sales_user_id ON public.repair_tickets USING btree (sales_user_id);
CREATE INDEX idx_repair_tickets_status ON public.repair_tickets USING btree (status);
CREATE INDEX idx_repair_tickets_ticket_number ON public.repair_tickets USING btree (ticket_number);
CREATE INDEX idx_repair_tickets_year_created ON public.repair_tickets USING btree (year_created);

-- User indexes
CREATE INDEX idx_users_department ON public.users USING btree (department);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_last_login ON public.users USING btree (last_login);
CREATE INDEX idx_users_status ON public.users USING btree (status);

-- Warranty repair ticket indexes
CREATE INDEX idx_warranty_repair_tickets_converted_at ON public.warranty_repair_tickets USING btree (converted_at);
CREATE INDEX idx_warranty_repair_tickets_customer_id ON public.warranty_repair_tickets USING btree (customer_id);
CREATE INDEX idx_warranty_repair_tickets_formatted_number ON public.warranty_repair_tickets USING btree (formatted_number);
CREATE INDEX idx_warranty_repair_tickets_machine_id ON public.warranty_repair_tickets USING btree (machine_id);
CREATE INDEX idx_warranty_repair_tickets_sales_user_id ON public.warranty_repair_tickets USING btree (sales_user_id);
CREATE INDEX idx_warranty_repair_tickets_status ON public.warranty_repair_tickets USING btree (status);
CREATE INDEX idx_warranty_repair_tickets_ticket_number ON public.warranty_repair_tickets USING btree (ticket_number);
CREATE INDEX idx_warranty_repair_tickets_year_created ON public.warranty_repair_tickets USING btree (year_created);

-- Warranty work order indexes
CREATE INDEX idx_warranty_work_orders_customer_id ON public.warranty_work_orders USING btree (customer_id);
CREATE INDEX idx_warranty_work_orders_due_date ON public.warranty_work_orders USING btree (due_date);
CREATE INDEX idx_warranty_work_orders_formatted_number ON public.warranty_work_orders USING btree (formatted_number);
CREATE INDEX idx_warranty_work_orders_machine_id ON public.warranty_work_orders USING btree (machine_id);
CREATE INDEX idx_warranty_work_orders_owner_technician_id ON public.warranty_work_orders USING btree (owner_technician_id);
CREATE INDEX idx_warranty_work_orders_priority ON public.warranty_work_orders USING btree (priority);
CREATE INDEX idx_warranty_work_orders_sales_user_id ON public.warranty_work_orders USING btree (sales_user_id);
CREATE INDEX idx_warranty_work_orders_status ON public.warranty_work_orders USING btree (status);
CREATE INDEX idx_warranty_work_orders_technician_id ON public.warranty_work_orders USING btree (technician_id);
CREATE INDEX idx_warranty_work_orders_ticket_number ON public.warranty_work_orders USING btree (ticket_number);
CREATE INDEX idx_warranty_work_orders_year_created ON public.warranty_work_orders USING btree (year_created);

-- Work order indexes
CREATE INDEX idx_work_orders_converted_by_user_id ON public.work_orders USING btree (converted_by_user_id);
CREATE INDEX idx_work_orders_created_at ON public.work_orders USING btree (created_at);
CREATE INDEX idx_work_orders_formatted_number ON public.work_orders USING btree (formatted_number);
CREATE INDEX idx_work_orders_owner_technician_id ON public.work_orders USING btree (owner_technician_id);
CREATE INDEX idx_work_orders_sales_opportunity ON public.work_orders USING btree (sales_opportunity);
CREATE INDEX idx_work_orders_sales_stage ON public.work_orders USING btree (sales_stage);
CREATE INDEX idx_work_orders_sales_user_id ON public.work_orders USING btree (sales_user_id);
CREATE INDEX idx_work_orders_ticket_number ON public.work_orders USING btree (ticket_number);
CREATE INDEX idx_work_orders_year_created ON public.work_orders USING btree (year_created);

-- Yearly sequences index
CREATE INDEX idx_yearly_sequences_year ON public.yearly_sequences USING btree (year);

-- Unique machine model serial constraint
CREATE UNIQUE INDEX uniq_machine_model_serial ON public.machines USING btree (COALESCE(name, ''::text), COALESCE(catalogue_number, ''::text), COALESCE(serial_number, ''::text));

--
-- TRIGGERS
--

-- Formatted number triggers
CREATE TRIGGER set_formatted_number_repair_tickets BEFORE INSERT ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();
CREATE TRIGGER set_formatted_number_warranty_repair_tickets BEFORE INSERT ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();
CREATE TRIGGER set_formatted_number_warranty_work_orders BEFORE INSERT ON public.warranty_work_orders FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();
CREATE TRIGGER set_formatted_number_work_orders BEFORE INSERT ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();

-- Ticket number triggers
CREATE TRIGGER set_ticket_number_trigger BEFORE INSERT ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();
CREATE TRIGGER set_warranty_ticket_number_trigger BEFORE INSERT ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();

-- Updated at triggers
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_order_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_order_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_assigned_machines BEFORE UPDATE ON public.assigned_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_machine_models BEFORE UPDATE ON public.machine_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_machine_rentals BEFORE UPDATE ON public.machine_rentals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_machine_serials BEFORE UPDATE ON public.machine_serials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.machine_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.warranty_periods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Warranty triggers
CREATE TRIGGER set_warranty_expiry_trigger BEFORE INSERT OR UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_expiry();
CREATE TRIGGER trg_set_warranty_active BEFORE INSERT OR UPDATE OF warranty_expiry_date ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_active();
CREATE TRIGGER trg_set_warranty_active_assigned_machines BEFORE INSERT OR UPDATE OF warranty_expiry_date ON public.assigned_machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_active_assigned_machines();

-- Quote triggers
CREATE TRIGGER update_quote_status_timestamp_trigger BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_quote_status_timestamp();
CREATE TRIGGER update_quotes_timestamp BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

--
-- FOREIGN KEY CONSTRAINTS
-- (Note: Foreign key constraints will be added based on the actual relationships in your backup)
--

-- This schema provides the complete structure for the Repair Shop Management System
-- including all sales functionality, CRM features, and analytics views.
-- 
-- To populate with data, run the full backup file: DB SA PRODAJOM FINAL.sql
