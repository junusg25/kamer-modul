--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

-- Started on 2025-09-11 02:20:52

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
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 5746 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 339 (class 1255 OID 269835)
-- Name: calculate_warranty_expiry(date, integer); Type: FUNCTION; Schema: public; Owner: repairadmin
--

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


ALTER FUNCTION public.calculate_warranty_expiry(purchase_date date, model_id integer) OWNER TO repairadmin;

--
-- TOC entry 331 (class 1255 OID 246262)
-- Name: calculate_warranty_expiry(date, text, text); Type: FUNCTION; Schema: public; Owner: repairadmin
--

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


ALTER FUNCTION public.calculate_warranty_expiry(purchase_date date, manufacturer text, model_name text) OWNER TO repairadmin;

--
-- TOC entry 338 (class 1255 OID 253764)
-- Name: copy_ticket_number_to_work_order(integer, text, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.copy_ticket_number_to_work_order(ticket_id integer, ticket_type text, work_order_id integer) RETURNS void
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


ALTER FUNCTION public.copy_ticket_number_to_work_order(ticket_id integer, ticket_type text, work_order_id integer) OWNER TO postgres;

--
-- TOC entry 336 (class 1255 OID 253758)
-- Name: generate_formatted_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

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


ALTER FUNCTION public.generate_formatted_number() OWNER TO postgres;

--
-- TOC entry 334 (class 1255 OID 246260)
-- Name: get_next_ticket_number(text); Type: FUNCTION; Schema: public; Owner: repairadmin
--

CREATE FUNCTION public.get_next_ticket_number(table_name text) RETURNS integer
    LANGUAGE plpgsql
    AS $_$
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
$_$;


ALTER FUNCTION public.get_next_ticket_number(table_name text) OWNER TO repairadmin;

--
-- TOC entry 335 (class 1255 OID 253757)
-- Name: get_next_yearly_sequence(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_next_yearly_sequence() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_year integer;
    next_sequence integer;
    sequence_record record;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Try to get existing sequence for current year
    SELECT * INTO sequence_record FROM yearly_sequences WHERE year = current_year;
    
    IF sequence_record IS NULL THEN
        -- Create new sequence for current year
        INSERT INTO yearly_sequences (year, current_sequence) 
        VALUES (current_year, 1)
        RETURNING current_sequence INTO next_sequence;
    ELSE
        -- Increment existing sequence
        UPDATE yearly_sequences 
        SET current_sequence = current_sequence + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE year = current_year
        RETURNING current_sequence INTO next_sequence;
    END IF;
    
    RETURN next_sequence;
END;
$$;


ALTER FUNCTION public.get_next_yearly_sequence() OWNER TO postgres;

--
-- TOC entry 337 (class 1255 OID 253759)
-- Name: set_formatted_number_and_year(); Type: FUNCTION; Schema: public; Owner: postgres
--

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


ALTER FUNCTION public.set_formatted_number_and_year() OWNER TO postgres;

--
-- TOC entry 330 (class 1255 OID 246261)
-- Name: set_ticket_number(); Type: FUNCTION; Schema: public; Owner: repairadmin
--

CREATE FUNCTION public.set_ticket_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := get_next_ticket_number(TG_TABLE_NAME);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_ticket_number() OWNER TO repairadmin;

--
-- TOC entry 333 (class 1255 OID 246267)
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: repairadmin
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO repairadmin;

--
-- TOC entry 294 (class 1255 OID 32847)
-- Name: set_warranty_active(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_warranty_active() RETURNS trigger
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


ALTER FUNCTION public.set_warranty_active() OWNER TO postgres;

--
-- TOC entry 309 (class 1255 OID 262434)
-- Name: set_warranty_active_assigned_machines(); Type: FUNCTION; Schema: public; Owner: repairadmin
--

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


ALTER FUNCTION public.set_warranty_active_assigned_machines() OWNER TO repairadmin;

--
-- TOC entry 332 (class 1255 OID 246263)
-- Name: set_warranty_expiry(); Type: FUNCTION; Schema: public; Owner: repairadmin
--

CREATE FUNCTION public.set_warranty_expiry() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.purchase_date IS NOT NULL AND NEW.manufacturer IS NOT NULL AND NEW.model_name IS NOT NULL THEN
        NEW.warranty_expiry_date := calculate_warranty_expiry(NEW.purchase_date, NEW.manufacturer, NEW.model_name);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_warranty_expiry() OWNER TO repairadmin;

--
-- TOC entry 318 (class 1255 OID 287842)
-- Name: update_quote_status_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_quote_status_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Set timestamp based on status change
    IF NEW.status != OLD.status THEN
        CASE NEW.status
            WHEN 'sent' THEN NEW.sent_at = CURRENT_TIMESTAMP;
            WHEN 'viewed' THEN NEW.viewed_at = CURRENT_TIMESTAMP;
            WHEN 'accepted' THEN NEW.accepted_at = CURRENT_TIMESTAMP;
            WHEN 'rejected' THEN NEW.rejected_at = CURRENT_TIMESTAMP;
            WHEN 'converted' THEN NEW.converted_at = CURRENT_TIMESTAMP;
            ELSE NULL;
        END CASE;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_quote_status_timestamp() OWNER TO postgres;

--
-- TOC entry 295 (class 1255 OID 287840)
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_timestamp() OWNER TO postgres;

--
-- TOC entry 296 (class 1255 OID 32888)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 273 (class 1259 OID 262392)
-- Name: assigned_machines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assigned_machines (
    id integer NOT NULL,
    serial_id integer NOT NULL,
    customer_id integer NOT NULL,
    purchase_date date,
    warranty_expiry_date date,
    warranty_active boolean DEFAULT true,
    description text,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    receipt_number text,
    sold_by_user_id integer,
    added_by_user_id integer,
    machine_condition character varying(20) DEFAULT 'new'::character varying,
    sale_date date,
    sale_price numeric(10,2),
    is_sale boolean DEFAULT true,
    purchased_at character varying(255),
    CONSTRAINT assigned_machines_machine_condition_check CHECK (((machine_condition)::text = ANY ((ARRAY['new'::character varying, 'used'::character varying])::text[])))
);


ALTER TABLE public.assigned_machines OWNER TO postgres;

--
-- TOC entry 5747 (class 0 OID 0)
-- Dependencies: 273
-- Name: COLUMN assigned_machines.purchased_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.assigned_machines.purchased_at IS 'Where the customer purchased the machine (e.g., shop name, online store, etc.)';


--
-- TOC entry 272 (class 1259 OID 262391)
-- Name: assigned_machines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.assigned_machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assigned_machines_id_seq OWNER TO postgres;

--
-- TOC entry 5748 (class 0 OID 0)
-- Dependencies: 272
-- Name: assigned_machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.assigned_machines_id_seq OWNED BY public.assigned_machines.id;


--
-- TOC entry 223 (class 1259 OID 16404)
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_name text,
    vat_number text,
    city text,
    postal_code text,
    street_address text,
    phone2 text,
    fax text,
    owner_id integer,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ownership_notes text,
    status character varying(20) DEFAULT 'active'::character varying,
    customer_type character varying(20) DEFAULT 'private'::character varying,
    contact_person character varying(255),
    CONSTRAINT customers_customer_type_check CHECK (((customer_type)::text = ANY ((ARRAY['private'::character varying, 'company'::character varying])::text[]))),
    CONSTRAINT customers_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'pending'::character varying])::text[])))
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- TOC entry 5749 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN customers.customer_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.customers.customer_type IS 'Type of customer: private (individual) or company (business)';


--
-- TOC entry 5750 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN customers.contact_person; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.customers.contact_person IS 'Main contact person for company customers (not used for private customers)';


--
-- TOC entry 269 (class 1259 OID 262357)
-- Name: machine_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.machine_models (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    catalogue_number character varying(100),
    manufacturer character varying(255) NOT NULL,
    category_id integer,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    warranty_months integer DEFAULT 12
);


ALTER TABLE public.machine_models OWNER TO postgres;

--
-- TOC entry 271 (class 1259 OID 262375)
-- Name: machine_serials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.machine_serials (
    id integer NOT NULL,
    model_id integer NOT NULL,
    serial_number character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'available'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.machine_serials OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16391)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'technician'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    password text NOT NULL,
    requires_password_reset boolean DEFAULT true,
    refresh_token text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    phone text,
    department text,
    status text DEFAULT 'active'::text,
    last_login timestamp without time zone,
    last_seen timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_logout timestamp without time zone,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'technician'::text, 'customer'::text, 'sales'::text]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 287 (class 1259 OID 289228)
-- Name: assigned_machines_with_details; Type: VIEW; Schema: public; Owner: postgres
--

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
    am.purchased_at,
    am.receipt_number,
    am.sold_by_user_id,
    am.added_by_user_id,
    am.machine_condition,
    am.sale_date,
    am.sale_price,
    am.is_sale,
    ms.serial_number,
    mm.name AS model_name,
    mm.catalogue_number,
    mm.manufacturer,
    c.name AS customer_name,
    c.email AS customer_email,
    c.phone AS customer_phone,
    c.phone2 AS customer_phone2,
    c.company_name AS customer_company,
    c.street_address AS customer_address,
    c.city AS customer_city,
    c.postal_code AS customer_postal_code,
    c.vat_number AS customer_vat_number,
    c.owner_id AS customer_owner_id,
    c.ownership_notes AS customer_ownership_notes,
    c.assigned_at AS customer_assigned_at,
    c.created_at AS customer_created_at,
    c.updated_at AS customer_updated_at,
    sold_by.name AS sold_by_name,
    added_by.name AS added_by_name
   FROM (((((public.assigned_machines am
     JOIN public.machine_serials ms ON ((am.serial_id = ms.id)))
     JOIN public.machine_models mm ON ((ms.model_id = mm.id)))
     JOIN public.customers c ON ((am.customer_id = c.id)))
     LEFT JOIN public.users sold_by ON ((am.sold_by_user_id = sold_by.id)))
     LEFT JOIN public.users added_by ON ((am.added_by_user_id = added_by.id)));


ALTER VIEW public.assigned_machines_with_details OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 62787)
-- Name: customer_communications; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.customer_communications (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    type character varying(50) NOT NULL,
    subject character varying(200),
    content text NOT NULL,
    direction character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'completed'::character varying,
    scheduled_date timestamp without time zone,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_communications_direction_check CHECK (((direction)::text = ANY ((ARRAY['inbound'::character varying, 'outbound'::character varying])::text[]))),
    CONSTRAINT customer_communications_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'scheduled'::character varying])::text[]))),
    CONSTRAINT customer_communications_type_check CHECK (((type)::text = ANY ((ARRAY['call'::character varying, 'email'::character varying, 'note'::character varying, 'follow_up'::character varying, 'meeting'::character varying])::text[])))
);


ALTER TABLE public.customer_communications OWNER TO repairadmin;

--
-- TOC entry 240 (class 1259 OID 62786)
-- Name: customer_communications_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.customer_communications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_communications_id_seq OWNER TO repairadmin;

--
-- TOC entry 5753 (class 0 OID 0)
-- Dependencies: 240
-- Name: customer_communications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.customer_communications_id_seq OWNED BY public.customer_communications.id;


--
-- TOC entry 288 (class 1259 OID 289244)
-- Name: customer_ownership_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.customer_ownership_view AS
 SELECT c.id,
    c.name,
    c.phone,
    c.email,
    c.created_at,
    c.updated_at,
    c.company_name,
    c.vat_number,
    c.city,
    c.postal_code,
    c.street_address,
    c.phone2,
    c.fax,
    c.owner_id,
    c.assigned_at,
    c.ownership_notes,
    c.status,
    u.name AS owner_name,
    u.email AS owner_email,
    u.role AS owner_role
   FROM (public.customers c
     LEFT JOIN public.users u ON ((c.owner_id = u.id)));


ALTER VIEW public.customer_ownership_view OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 72156)
-- Name: customer_preferences; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.customer_preferences (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    preferred_contact_method character varying(20),
    preferred_contact_time character varying(20),
    category character varying(20) DEFAULT 'regular'::character varying,
    special_requirements text,
    notes text,
    auto_notifications boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_preferences_category_check CHECK (((category)::text = ANY ((ARRAY['vip'::character varying, 'regular'::character varying, 'new'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT customer_preferences_preferred_contact_method_check CHECK (((preferred_contact_method)::text = ANY ((ARRAY['email'::character varying, 'phone'::character varying, 'sms'::character varying, 'mail'::character varying])::text[]))),
    CONSTRAINT customer_preferences_preferred_contact_time_check CHECK (((preferred_contact_time)::text = ANY ((ARRAY['morning'::character varying, 'afternoon'::character varying, 'evening'::character varying, 'anytime'::character varying])::text[])))
);


ALTER TABLE public.customer_preferences OWNER TO repairadmin;

--
-- TOC entry 242 (class 1259 OID 72155)
-- Name: customer_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.customer_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_preferences_id_seq OWNER TO repairadmin;

--
-- TOC entry 5754 (class 0 OID 0)
-- Dependencies: 242
-- Name: customer_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.customer_preferences_id_seq OWNED BY public.customer_preferences.id;


--
-- TOC entry 222 (class 1259 OID 16403)
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customers_id_seq OWNER TO postgres;

--
-- TOC entry 5755 (class 0 OID 0)
-- Dependencies: 222
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- TOC entry 229 (class 1259 OID 16455)
-- Name: inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory (
    id integer NOT NULL,
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


ALTER TABLE public.inventory OWNER TO postgres;

--
-- TOC entry 290 (class 1259 OID 289251)
-- Name: inventory_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_categories OWNER TO postgres;

--
-- TOC entry 289 (class 1259 OID 289250)
-- Name: inventory_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_categories_id_seq OWNER TO postgres;

--
-- TOC entry 5758 (class 0 OID 0)
-- Dependencies: 289
-- Name: inventory_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_categories_id_seq OWNED BY public.inventory_categories.id;


--
-- TOC entry 228 (class 1259 OID 16454)
-- Name: inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_id_seq OWNER TO postgres;

--
-- TOC entry 5759 (class 0 OID 0)
-- Dependencies: 228
-- Name: inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_id_seq OWNED BY public.inventory.id;


--
-- TOC entry 285 (class 1259 OID 287871)
-- Name: lead_follow_ups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_follow_ups (
    id integer NOT NULL,
    lead_id integer,
    notes text NOT NULL,
    action_taken character varying(255),
    outcome character varying(255),
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    follow_up_date timestamp without time zone NOT NULL,
    follow_up_type text NOT NULL,
    completed boolean DEFAULT false,
    completed_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.lead_follow_ups OWNER TO postgres;

--
-- TOC entry 284 (class 1259 OID 287870)
-- Name: lead_follow_ups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lead_follow_ups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lead_follow_ups_id_seq OWNER TO postgres;

--
-- TOC entry 5761 (class 0 OID 0)
-- Dependencies: 284
-- Name: lead_follow_ups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lead_follow_ups_id_seq OWNED BY public.lead_follow_ups.id;


--
-- TOC entry 283 (class 1259 OID 287845)
-- Name: leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leads (
    id integer NOT NULL,
    customer_name character varying(255) NOT NULL,
    company_name character varying(255),
    email character varying(255),
    phone character varying(50),
    source character varying(255),
    lead_quality character varying(20) DEFAULT 'medium'::character varying,
    sales_stage character varying(20) DEFAULT 'new'::character varying,
    potential_value numeric(10,2),
    sales_notes text,
    next_follow_up timestamp without time zone,
    assigned_to integer,
    created_by integer,
    pipeline_position integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT leads_lead_quality_check CHECK (((lead_quality)::text = ANY ((ARRAY['high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))),
    CONSTRAINT leads_sales_stage_check CHECK (((sales_stage)::text = ANY ((ARRAY['new'::character varying, 'contacted'::character varying, 'qualified'::character varying, 'proposal'::character varying, 'negotiation'::character varying, 'won'::character varying, 'lost'::character varying])::text[])))
);


ALTER TABLE public.leads OWNER TO postgres;

--
-- TOC entry 282 (class 1259 OID 287844)
-- Name: leads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leads_id_seq OWNER TO postgres;

--
-- TOC entry 5762 (class 0 OID 0)
-- Dependencies: 282
-- Name: leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leads_id_seq OWNED BY public.leads.id;


--
-- TOC entry 261 (class 1259 OID 246182)
-- Name: machine_categories; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.machine_categories (
    id integer NOT NULL,
    name text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.machine_categories OWNER TO repairadmin;

--
-- TOC entry 260 (class 1259 OID 246181)
-- Name: machine_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.machine_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machine_categories_id_seq OWNER TO repairadmin;

--
-- TOC entry 5763 (class 0 OID 0)
-- Dependencies: 260
-- Name: machine_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.machine_categories_id_seq OWNED BY public.machine_categories.id;


--
-- TOC entry 268 (class 1259 OID 262356)
-- Name: machine_models_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.machine_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machine_models_id_seq OWNER TO postgres;

--
-- TOC entry 5764 (class 0 OID 0)
-- Dependencies: 268
-- Name: machine_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.machine_models_id_seq OWNED BY public.machine_models.id;


--
-- TOC entry 274 (class 1259 OID 262423)
-- Name: machine_models_with_stats; Type: VIEW; Schema: public; Owner: postgres
--

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
    count(
        CASE
            WHEN ((ms.status)::text = 'assigned'::text) THEN 1
            ELSE NULL::integer
        END) AS assigned_serials,
    count(
        CASE
            WHEN ((ms.status)::text = 'available'::text) THEN 1
            ELSE NULL::integer
        END) AS available_serials,
    min(ms.created_at) AS first_serial_created,
    max(ms.created_at) AS last_serial_created
   FROM ((public.machine_models mm
     LEFT JOIN public.machine_categories mc ON ((mm.category_id = mc.id)))
     LEFT JOIN public.machine_serials ms ON ((mm.id = ms.model_id)))
  GROUP BY mm.id, mm.name, mm.catalogue_number, mm.manufacturer, mm.category_id, mm.description, mm.created_at, mm.updated_at, mc.name;


ALTER VIEW public.machine_models_with_stats OWNER TO postgres;

--
-- TOC entry 276 (class 1259 OID 286248)
-- Name: machine_rentals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.machine_rentals (
    id integer NOT NULL,
    assigned_machine_id integer NOT NULL,
    customer_id integer NOT NULL,
    rental_start_date date NOT NULL,
    rental_end_date date,
    planned_return_date date,
    actual_return_date date,
    rental_status character varying(20) DEFAULT 'active'::character varying,
    price_per_day numeric(8,2),
    price_per_week numeric(8,2),
    price_per_month numeric(8,2),
    billing_period character varying(10) DEFAULT 'monthly'::character varying,
    total_amount numeric(10,2),
    maintenance_reminder_date date,
    rental_notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT machine_rentals_billing_period_check CHECK (((billing_period)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying])::text[]))),
    CONSTRAINT machine_rentals_rental_status_check CHECK (((rental_status)::text = ANY ((ARRAY['active'::character varying, 'returned'::character varying, 'overdue'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.machine_rentals OWNER TO postgres;

--
-- TOC entry 275 (class 1259 OID 286247)
-- Name: machine_rentals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.machine_rentals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machine_rentals_id_seq OWNER TO postgres;

--
-- TOC entry 5765 (class 0 OID 0)
-- Dependencies: 275
-- Name: machine_rentals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.machine_rentals_id_seq OWNED BY public.machine_rentals.id;


--
-- TOC entry 270 (class 1259 OID 262374)
-- Name: machine_serials_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.machine_serials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machine_serials_id_seq OWNER TO postgres;

--
-- TOC entry 5766 (class 0 OID 0)
-- Dependencies: 270
-- Name: machine_serials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.machine_serials_id_seq OWNED BY public.machine_serials.id;


--
-- TOC entry 225 (class 1259 OID 16416)
-- Name: machines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.machines (
    id integer NOT NULL,
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


ALTER TABLE public.machines OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16415)
-- Name: machines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machines_id_seq OWNER TO postgres;

--
-- TOC entry 5768 (class 0 OID 0)
-- Dependencies: 224
-- Name: machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.machines_id_seq OWNED BY public.machines.id;


--
-- TOC entry 249 (class 1259 OID 169416)
-- Name: notifications; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) DEFAULT 'info'::character varying NOT NULL,
    is_read boolean DEFAULT false,
    related_entity_type character varying(50),
    related_entity_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    title_key text NOT NULL,
    message_key text NOT NULL,
    message_params jsonb NOT NULL
);


ALTER TABLE public.notifications OWNER TO repairadmin;

--
-- TOC entry 248 (class 1259 OID 169415)
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO repairadmin;

--
-- TOC entry 5770 (class 0 OID 0)
-- Dependencies: 248
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- TOC entry 281 (class 1259 OID 287816)
-- Name: quote_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_items (
    id integer NOT NULL,
    quote_id integer NOT NULL,
    description text NOT NULL,
    quantity numeric(10,2) DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    "position" integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.quote_items OWNER TO postgres;

--
-- TOC entry 280 (class 1259 OID 287815)
-- Name: quote_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quote_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quote_items_id_seq OWNER TO postgres;

--
-- TOC entry 5771 (class 0 OID 0)
-- Dependencies: 280
-- Name: quote_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quote_items_id_seq OWNED BY public.quote_items.id;


--
-- TOC entry 279 (class 1259 OID 287786)
-- Name: quotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotes (
    id integer NOT NULL,
    quote_number integer NOT NULL,
    customer_id integer,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255),
    customer_phone character varying(50),
    title character varying(255) NOT NULL,
    description text,
    subtotal numeric(10,2) DEFAULT 0,
    tax_rate numeric(5,2) DEFAULT 0,
    tax_amount numeric(10,2) DEFAULT 0,
    discount_amount numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) DEFAULT 0,
    status character varying(20) DEFAULT 'draft'::character varying,
    valid_until date NOT NULL,
    notes text,
    terms_conditions text,
    sent_at timestamp without time zone,
    viewed_at timestamp without time zone,
    accepted_at timestamp without time zone,
    rejected_at timestamp without time zone,
    converted_at timestamp without time zone,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quotes_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'viewed'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'expired'::character varying, 'converted'::character varying])::text[])))
);


ALTER TABLE public.quotes OWNER TO postgres;

--
-- TOC entry 278 (class 1259 OID 287785)
-- Name: quotes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quotes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quotes_id_seq OWNER TO postgres;

--
-- TOC entry 5772 (class 0 OID 0)
-- Dependencies: 278
-- Name: quotes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quotes_id_seq OWNED BY public.quotes.id;


--
-- TOC entry 253 (class 1259 OID 228952)
-- Name: repair_tickets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repair_tickets (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    machine_id integer NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'intake'::text,
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
    sales_opportunity boolean DEFAULT false,
    sales_notes text,
    potential_value numeric(10,2) DEFAULT 0,
    sales_user_id integer,
    lead_quality text DEFAULT 'unknown'::text,
    priority text DEFAULT 'medium'::text,
    CONSTRAINT repair_tickets_lead_quality_check CHECK ((lead_quality = ANY (ARRAY['unknown'::text, 'cold'::text, 'warm'::text, 'hot'::text]))),
    CONSTRAINT repair_tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT repair_tickets_status_check CHECK ((status = ANY (ARRAY['intake'::text, 'converted'::text, 'converted - warranty'::text, 'cancelled'::text])))
);


ALTER TABLE public.repair_tickets OWNER TO postgres;

--
-- TOC entry 252 (class 1259 OID 228951)
-- Name: repair_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repair_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.repair_tickets_id_seq OWNER TO postgres;

--
-- TOC entry 5773 (class 0 OID 0)
-- Dependencies: 252
-- Name: repair_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repair_tickets_id_seq OWNED BY public.repair_tickets.id;


--
-- TOC entry 227 (class 1259 OID 16433)
-- Name: work_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_orders (
    id integer NOT NULL,
    machine_id integer NOT NULL,
    customer_id integer NOT NULL,
    description text,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    technician_id integer,
    priority text DEFAULT 'medium'::text,
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
    year_created integer,
    sales_opportunity boolean DEFAULT false,
    sales_notes text,
    follow_up_date date,
    sales_user_id integer,
    lead_source text,
    customer_satisfaction_score integer,
    upsell_opportunity boolean DEFAULT false,
    recommended_products text,
    sales_stage text DEFAULT 'not_applicable'::text,
    CONSTRAINT work_orders_customer_satisfaction_score_check CHECK (((customer_satisfaction_score >= 1) AND (customer_satisfaction_score <= 5))),
    CONSTRAINT work_orders_sales_stage_check CHECK ((sales_stage = ANY (ARRAY['not_applicable'::text, 'lead'::text, 'qualified'::text, 'proposal'::text, 'negotiation'::text, 'closed_won'::text, 'closed_lost'::text])))
);


ALTER TABLE public.work_orders OWNER TO postgres;

--
-- TOC entry 291 (class 1259 OID 289265)
-- Name: repair_tickets_view; Type: VIEW; Schema: public; Owner: postgres
--

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
    c.owner_id,
    c.assigned_at,
    c.ownership_notes,
    u_owner.name AS owner_name,
    rt.machine_id,
    mm.manufacturer,
    am.assigned_at AS bought_at,
    mm.category_id,
    mc.name AS category_name,
    mm.name AS model_name,
    mm.catalogue_number,
    ms.serial_number,
    am.receipt_number,
    am.purchase_date,
    am.warranty_expiry_date,
    rt.problem_description,
    rt.notes,
    rt.additional_equipment,
    rt.brought_by,
    rt.submitted_by,
    u.name AS submitted_by_name,
    rt.status,
    rt.priority,
    rt.converted_to_work_order_id,
    wo.formatted_number AS converted_work_order_formatted_number,
    wo.year_created AS converted_work_order_year_created,
    wo.owner_technician_id AS converted_by_technician_id,
    tech.name AS converted_by_technician_name,
    rt.converted_at,
    rt.created_at,
    rt.updated_at
   FROM (((((((((public.repair_tickets rt
     LEFT JOIN public.customers c ON ((rt.customer_id = c.id)))
     LEFT JOIN public.users u_owner ON ((c.owner_id = u_owner.id)))
     LEFT JOIN public.assigned_machines am ON ((rt.machine_id = am.id)))
     LEFT JOIN public.machine_serials ms ON ((am.serial_id = ms.id)))
     LEFT JOIN public.machine_models mm ON ((ms.model_id = mm.id)))
     LEFT JOIN public.machine_categories mc ON ((mm.category_id = mc.id)))
     LEFT JOIN public.users u ON ((rt.submitted_by = u.id)))
     LEFT JOIN public.work_orders wo ON ((rt.converted_to_work_order_id = wo.id)))
     LEFT JOIN public.users tech ON ((wo.owner_technician_id = tech.id)));


ALTER VIEW public.repair_tickets_view OWNER TO postgres;

--
-- TOC entry 277 (class 1259 OID 286303)
-- Name: sales_metrics; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.sales_metrics AS
 SELECT u.id AS sales_user_id,
    u.name AS sales_user_name,
    count(am.id) AS total_machines_sold,
    count(
        CASE
            WHEN ((am.machine_condition)::text = 'new'::text) THEN 1
            ELSE NULL::integer
        END) AS new_machines_sold,
    count(
        CASE
            WHEN ((am.machine_condition)::text = 'used'::text) THEN 1
            ELSE NULL::integer
        END) AS used_machines_sold,
    count(DISTINCT am.customer_id) AS customers_served,
    COALESCE(sum(am.sale_price), (0)::numeric) AS total_sales_revenue,
    COALESCE(avg(am.sale_price), (0)::numeric) AS avg_sale_price
   FROM (public.users u
     LEFT JOIN public.assigned_machines am ON ((u.id = am.sold_by_user_id)))
  WHERE (u.role = 'sales'::text)
  GROUP BY u.id, u.name;


ALTER VIEW public.sales_metrics OWNER TO postgres;

--
-- TOC entry 286 (class 1259 OID 287902)
-- Name: sales_opportunities; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.sales_opportunities AS
 SELECT 'lead'::text AS source_type,
    l.id AS source_id,
    NULL::text AS customer_id,
    l.customer_name,
    l.company_name,
    NULL::text AS machine_id,
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
     LEFT JOIN public.users u ON ((l.assigned_to = u.id)));


ALTER VIEW public.sales_opportunities OWNER TO postgres;

--
-- TOC entry 250 (class 1259 OID 220682)
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.schema_migrations (
    name text NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.schema_migrations OWNER TO repairadmin;

--
-- TOC entry 247 (class 1259 OID 85215)
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.stock_movements (
    id integer NOT NULL,
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


ALTER TABLE public.stock_movements OWNER TO repairadmin;

--
-- TOC entry 246 (class 1259 OID 85214)
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.stock_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_movements_id_seq OWNER TO repairadmin;

--
-- TOC entry 5775 (class 0 OID 0)
-- Dependencies: 246
-- Name: stock_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;


--
-- TOC entry 245 (class 1259 OID 85200)
-- Name: suppliers; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.suppliers (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100),
    phone character varying(20),
    address text,
    category character varying(50),
    contact_person character varying(100),
    website character varying(200),
    payment_terms character varying(100),
    status character varying(20) DEFAULT 'active'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT suppliers_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


ALTER TABLE public.suppliers OWNER TO repairadmin;

--
-- TOC entry 244 (class 1259 OID 85199)
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.suppliers_id_seq OWNER TO repairadmin;

--
-- TOC entry 5776 (class 0 OID 0)
-- Dependencies: 244
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- TOC entry 251 (class 1259 OID 220690)
-- Name: ticket_number_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.ticket_number_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ticket_number_seq OWNER TO repairadmin;

--
-- TOC entry 220 (class 1259 OID 16390)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5777 (class 0 OID 0)
-- Dependencies: 220
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 263 (class 1259 OID 246195)
-- Name: warranty_periods; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.warranty_periods (
    id integer NOT NULL,
    manufacturer text NOT NULL,
    model_name text NOT NULL,
    warranty_months integer DEFAULT 12 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.warranty_periods OWNER TO repairadmin;

--
-- TOC entry 262 (class 1259 OID 246194)
-- Name: warranty_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.warranty_periods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.warranty_periods_id_seq OWNER TO repairadmin;

--
-- TOC entry 5779 (class 0 OID 0)
-- Dependencies: 262
-- Name: warranty_periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.warranty_periods_id_seq OWNED BY public.warranty_periods.id;


--
-- TOC entry 265 (class 1259 OID 246209)
-- Name: warranty_repair_tickets; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.warranty_repair_tickets (
    id integer NOT NULL,
    ticket_number integer,
    customer_id integer NOT NULL,
    machine_id integer NOT NULL,
    problem_description text NOT NULL,
    notes text,
    additional_equipment text,
    brought_by text,
    submitted_by integer NOT NULL,
    status text DEFAULT 'intake'::text NOT NULL,
    converted_to_warranty_work_order_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    formatted_number text,
    year_created integer,
    converted_at timestamp without time zone,
    sales_opportunity boolean DEFAULT false,
    sales_notes text,
    potential_value numeric(10,2) DEFAULT 0,
    sales_user_id integer,
    lead_quality text DEFAULT 'unknown'::text,
    priority text DEFAULT 'medium'::text,
    CONSTRAINT warranty_repair_tickets_lead_quality_check CHECK ((lead_quality = ANY (ARRAY['unknown'::text, 'cold'::text, 'warm'::text, 'hot'::text]))),
    CONSTRAINT warranty_repair_tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT warranty_repair_tickets_status_check CHECK ((status = ANY (ARRAY['intake'::text, 'converted'::text, 'cancelled'::text])))
);


ALTER TABLE public.warranty_repair_tickets OWNER TO repairadmin;

--
-- TOC entry 264 (class 1259 OID 246208)
-- Name: warranty_repair_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.warranty_repair_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.warranty_repair_tickets_id_seq OWNER TO repairadmin;

--
-- TOC entry 5780 (class 0 OID 0)
-- Dependencies: 264
-- Name: warranty_repair_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.warranty_repair_tickets_id_seq OWNED BY public.warranty_repair_tickets.id;


--
-- TOC entry 255 (class 1259 OID 228996)
-- Name: warranty_work_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warranty_work_orders (
    id integer NOT NULL,
    machine_id integer NOT NULL,
    customer_id integer NOT NULL,
    description text,
    status text DEFAULT 'pending'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    technician_id integer,
    priority text DEFAULT 'medium'::text,
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
    year_created integer,
    sales_opportunity boolean DEFAULT false,
    sales_notes text,
    follow_up_date date,
    sales_user_id integer,
    customer_satisfaction_score integer,
    upsell_opportunity boolean DEFAULT false,
    recommended_products text,
    CONSTRAINT warranty_work_orders_customer_satisfaction_score_check CHECK (((customer_satisfaction_score >= 1) AND (customer_satisfaction_score <= 5)))
);


ALTER TABLE public.warranty_work_orders OWNER TO postgres;

--
-- TOC entry 292 (class 1259 OID 289270)
-- Name: warranty_repair_tickets_view; Type: VIEW; Schema: public; Owner: postgres
--

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
    c.owner_id,
    c.assigned_at,
    c.ownership_notes,
    u_owner.name AS owner_name,
    wrt.machine_id,
    mm.manufacturer,
    am.description AS bought_at,
    mm.category_id,
    mc.name AS category_name,
    mm.name AS model_name,
    mm.catalogue_number,
    ms.serial_number,
    am.receipt_number,
    am.purchase_date,
    am.warranty_expiry_date,
    wrt.problem_description,
    wrt.notes,
    wrt.additional_equipment,
    wrt.brought_by,
    wrt.submitted_by,
    u.name AS submitted_by_name,
    wrt.status,
    wrt.priority,
    wrt.converted_to_warranty_work_order_id,
    wwo.formatted_number AS converted_warranty_work_order_formatted_number,
    wwo.year_created AS converted_warranty_work_order_year_created,
    wwo.owner_technician_id AS converted_by_technician_id,
    tech.name AS converted_by_technician_name,
    wrt.converted_at,
    wrt.created_at,
    wrt.updated_at
   FROM (((((((((public.warranty_repair_tickets wrt
     LEFT JOIN public.customers c ON ((wrt.customer_id = c.id)))
     LEFT JOIN public.users u_owner ON ((c.owner_id = u_owner.id)))
     LEFT JOIN public.assigned_machines am ON ((wrt.machine_id = am.id)))
     LEFT JOIN public.machine_serials ms ON ((am.serial_id = ms.id)))
     LEFT JOIN public.machine_models mm ON ((ms.model_id = mm.id)))
     LEFT JOIN public.machine_categories mc ON ((mm.category_id = mc.id)))
     LEFT JOIN public.users u ON ((wrt.submitted_by = u.id)))
     LEFT JOIN public.warranty_work_orders wwo ON ((wrt.converted_to_warranty_work_order_id = wwo.id)))
     LEFT JOIN public.users tech ON ((wwo.owner_technician_id = tech.id)));


ALTER VIEW public.warranty_repair_tickets_view OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 229033)
-- Name: warranty_work_order_inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warranty_work_order_inventory (
    id integer NOT NULL,
    warranty_work_order_id integer NOT NULL,
    inventory_id integer NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT warranty_work_order_inventory_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.warranty_work_order_inventory OWNER TO postgres;

--
-- TOC entry 256 (class 1259 OID 229032)
-- Name: warranty_work_order_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.warranty_work_order_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.warranty_work_order_inventory_id_seq OWNER TO postgres;

--
-- TOC entry 5781 (class 0 OID 0)
-- Dependencies: 256
-- Name: warranty_work_order_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.warranty_work_order_inventory_id_seq OWNED BY public.warranty_work_order_inventory.id;


--
-- TOC entry 259 (class 1259 OID 229053)
-- Name: warranty_work_order_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warranty_work_order_notes (
    id integer NOT NULL,
    warranty_work_order_id integer,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.warranty_work_order_notes OWNER TO postgres;

--
-- TOC entry 258 (class 1259 OID 229052)
-- Name: warranty_work_order_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.warranty_work_order_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.warranty_work_order_notes_id_seq OWNER TO postgres;

--
-- TOC entry 5782 (class 0 OID 0)
-- Dependencies: 258
-- Name: warranty_work_order_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.warranty_work_order_notes_id_seq OWNED BY public.warranty_work_order_notes.id;


--
-- TOC entry 254 (class 1259 OID 228995)
-- Name: warranty_work_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.warranty_work_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.warranty_work_orders_id_seq OWNER TO postgres;

--
-- TOC entry 5783 (class 0 OID 0)
-- Dependencies: 254
-- Name: warranty_work_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.warranty_work_orders_id_seq OWNED BY public.warranty_work_orders.id;


--
-- TOC entry 235 (class 1259 OID 43871)
-- Name: work_order_attachments; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.work_order_attachments (
    id integer NOT NULL,
    work_order_id integer NOT NULL,
    filename character varying(255) NOT NULL,
    original_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size integer NOT NULL,
    file_type character varying(50) DEFAULT 'general'::character varying,
    description text,
    uploaded_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.work_order_attachments OWNER TO repairadmin;

--
-- TOC entry 234 (class 1259 OID 43870)
-- Name: work_order_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.work_order_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_order_attachments_id_seq OWNER TO repairadmin;

--
-- TOC entry 5784 (class 0 OID 0)
-- Dependencies: 234
-- Name: work_order_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.work_order_attachments_id_seq OWNED BY public.work_order_attachments.id;


--
-- TOC entry 231 (class 1259 OID 16471)
-- Name: work_order_inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_order_inventory (
    id integer NOT NULL,
    work_order_id integer NOT NULL,
    inventory_id integer NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT work_order_inventory_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.work_order_inventory OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 16470)
-- Name: work_order_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_order_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_order_inventory_id_seq OWNER TO postgres;

--
-- TOC entry 5786 (class 0 OID 0)
-- Dependencies: 230
-- Name: work_order_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_order_inventory_id_seq OWNED BY public.work_order_inventory.id;


--
-- TOC entry 233 (class 1259 OID 24764)
-- Name: work_order_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_order_notes (
    id integer NOT NULL,
    work_order_id integer,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.work_order_notes OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 24763)
-- Name: work_order_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_order_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_order_notes_id_seq OWNER TO postgres;

--
-- TOC entry 5788 (class 0 OID 0)
-- Dependencies: 232
-- Name: work_order_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_order_notes_id_seq OWNED BY public.work_order_notes.id;


--
-- TOC entry 239 (class 1259 OID 43915)
-- Name: work_order_templates; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.work_order_templates (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    category character varying(100) NOT NULL,
    estimated_hours numeric(5,2) DEFAULT 0,
    required_parts text[] DEFAULT '{}'::text[],
    steps text[] NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.work_order_templates OWNER TO repairadmin;

--
-- TOC entry 238 (class 1259 OID 43914)
-- Name: work_order_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.work_order_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_order_templates_id_seq OWNER TO repairadmin;

--
-- TOC entry 5789 (class 0 OID 0)
-- Dependencies: 238
-- Name: work_order_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.work_order_templates_id_seq OWNED BY public.work_order_templates.id;


--
-- TOC entry 237 (class 1259 OID 43893)
-- Name: work_order_time_entries; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.work_order_time_entries (
    id integer NOT NULL,
    work_order_id integer NOT NULL,
    technician_id integer NOT NULL,
    start_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    end_time timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.work_order_time_entries OWNER TO repairadmin;

--
-- TOC entry 236 (class 1259 OID 43892)
-- Name: work_order_time_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.work_order_time_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_order_time_entries_id_seq OWNER TO repairadmin;

--
-- TOC entry 5790 (class 0 OID 0)
-- Dependencies: 236
-- Name: work_order_time_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.work_order_time_entries_id_seq OWNED BY public.work_order_time_entries.id;


--
-- TOC entry 226 (class 1259 OID 16432)
-- Name: work_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.work_orders_id_seq OWNER TO postgres;

--
-- TOC entry 5791 (class 0 OID 0)
-- Dependencies: 226
-- Name: work_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_orders_id_seq OWNED BY public.work_orders.id;


--
-- TOC entry 267 (class 1259 OID 253746)
-- Name: yearly_sequences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.yearly_sequences (
    id integer NOT NULL,
    year integer NOT NULL,
    current_sequence integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.yearly_sequences OWNER TO postgres;

--
-- TOC entry 266 (class 1259 OID 253745)
-- Name: yearly_sequences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.yearly_sequences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.yearly_sequences_id_seq OWNER TO postgres;

--
-- TOC entry 5793 (class 0 OID 0)
-- Dependencies: 266
-- Name: yearly_sequences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.yearly_sequences_id_seq OWNED BY public.yearly_sequences.id;


--
-- TOC entry 5123 (class 2604 OID 262395)
-- Name: assigned_machines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigned_machines ALTER COLUMN id SET DEFAULT nextval('public.assigned_machines_id_seq'::regclass);


--
-- TOC entry 5050 (class 2604 OID 62790)
-- Name: customer_communications id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_communications ALTER COLUMN id SET DEFAULT nextval('public.customer_communications_id_seq'::regclass);


--
-- TOC entry 5054 (class 2604 OID 72159)
-- Name: customer_preferences id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_preferences ALTER COLUMN id SET DEFAULT nextval('public.customer_preferences_id_seq'::regclass);


--
-- TOC entry 5002 (class 2604 OID 16407)
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- TOC entry 5022 (class 2604 OID 16458)
-- Name: inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);


--
-- TOC entry 5159 (class 2604 OID 289254)
-- Name: inventory_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_categories ALTER COLUMN id SET DEFAULT nextval('public.inventory_categories_id_seq'::regclass);


--
-- TOC entry 5155 (class 2604 OID 287874)
-- Name: lead_follow_ups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_ups ALTER COLUMN id SET DEFAULT nextval('public.lead_follow_ups_id_seq'::regclass);


--
-- TOC entry 5149 (class 2604 OID 287848)
-- Name: leads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads ALTER COLUMN id SET DEFAULT nextval('public.leads_id_seq'::regclass);


--
-- TOC entry 5096 (class 2604 OID 246185)
-- Name: machine_categories id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.machine_categories ALTER COLUMN id SET DEFAULT nextval('public.machine_categories_id_seq'::regclass);


--
-- TOC entry 5115 (class 2604 OID 262360)
-- Name: machine_models id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_models ALTER COLUMN id SET DEFAULT nextval('public.machine_models_id_seq'::regclass);


--
-- TOC entry 5129 (class 2604 OID 286251)
-- Name: machine_rentals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals ALTER COLUMN id SET DEFAULT nextval('public.machine_rentals_id_seq'::regclass);


--
-- TOC entry 5119 (class 2604 OID 262378)
-- Name: machine_serials id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_serials ALTER COLUMN id SET DEFAULT nextval('public.machine_serials_id_seq'::regclass);


--
-- TOC entry 5008 (class 2604 OID 16419)
-- Name: machines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines ALTER COLUMN id SET DEFAULT nextval('public.machines_id_seq'::regclass);


--
-- TOC entry 5065 (class 2604 OID 169419)
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- TOC entry 5143 (class 2604 OID 287819)
-- Name: quote_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items ALTER COLUMN id SET DEFAULT nextval('public.quote_items_id_seq'::regclass);


--
-- TOC entry 5134 (class 2604 OID 287789)
-- Name: quotes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes ALTER COLUMN id SET DEFAULT nextval('public.quotes_id_seq'::regclass);


--
-- TOC entry 5071 (class 2604 OID 228955)
-- Name: repair_tickets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets ALTER COLUMN id SET DEFAULT nextval('public.repair_tickets_id_seq'::regclass);


--
-- TOC entry 5063 (class 2604 OID 85218)
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);


--
-- TOC entry 5059 (class 2604 OID 85203)
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- TOC entry 4995 (class 2604 OID 16394)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5099 (class 2604 OID 246198)
-- Name: warranty_periods id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_periods ALTER COLUMN id SET DEFAULT nextval('public.warranty_periods_id_seq'::regclass);


--
-- TOC entry 5103 (class 2604 OID 246212)
-- Name: warranty_repair_tickets id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets ALTER COLUMN id SET DEFAULT nextval('public.warranty_repair_tickets_id_seq'::regclass);


--
-- TOC entry 5090 (class 2604 OID 229036)
-- Name: warranty_work_order_inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_inventory ALTER COLUMN id SET DEFAULT nextval('public.warranty_work_order_inventory_id_seq'::regclass);


--
-- TOC entry 5093 (class 2604 OID 229056)
-- Name: warranty_work_order_notes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_notes ALTER COLUMN id SET DEFAULT nextval('public.warranty_work_order_notes_id_seq'::regclass);


--
-- TOC entry 5079 (class 2604 OID 228999)
-- Name: warranty_work_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders ALTER COLUMN id SET DEFAULT nextval('public.warranty_work_orders_id_seq'::regclass);


--
-- TOC entry 5037 (class 2604 OID 43874)
-- Name: work_order_attachments id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_attachments ALTER COLUMN id SET DEFAULT nextval('public.work_order_attachments_id_seq'::regclass);


--
-- TOC entry 5031 (class 2604 OID 16474)
-- Name: work_order_inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_inventory ALTER COLUMN id SET DEFAULT nextval('public.work_order_inventory_id_seq'::regclass);


--
-- TOC entry 5034 (class 2604 OID 24767)
-- Name: work_order_notes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_notes ALTER COLUMN id SET DEFAULT nextval('public.work_order_notes_id_seq'::regclass);


--
-- TOC entry 5045 (class 2604 OID 43918)
-- Name: work_order_templates id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_templates ALTER COLUMN id SET DEFAULT nextval('public.work_order_templates_id_seq'::regclass);


--
-- TOC entry 5041 (class 2604 OID 43896)
-- Name: work_order_time_entries id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_time_entries ALTER COLUMN id SET DEFAULT nextval('public.work_order_time_entries_id_seq'::regclass);


--
-- TOC entry 5012 (class 2604 OID 16436)
-- Name: work_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders ALTER COLUMN id SET DEFAULT nextval('public.work_orders_id_seq'::regclass);


--
-- TOC entry 5111 (class 2604 OID 253749)
-- Name: yearly_sequences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_sequences ALTER COLUMN id SET DEFAULT nextval('public.yearly_sequences_id_seq'::regclass);


--
-- TOC entry 5728 (class 0 OID 262392)
-- Dependencies: 273
-- Data for Name: assigned_machines; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (2, 2, 1, '2025-09-06', '2026-09-06', true, 'Kupljena na otoci', '2025-09-06 20:02:01.044394', '2025-09-07 01:33:26.915805', '165165', 6, 6, 'new', '2025-09-06', 1480.50, true, 'Kamer.ba');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (4, 9, 6, '2020-01-01', '2021-06-30', false, NULL, '2025-09-07 02:12:23.860314', '2025-09-07 02:12:23.860314', '5654654', NULL, NULL, 'used', '2020-01-01', NULL, false, 'Greenline d.o.o.');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (1, 1, 3, '2025-09-06', '2026-09-06', true, 'Kupljena u salonu', '2025-09-06 19:55:24.349124', '2025-09-07 02:44:36.984281', '21569', 6, 6, 'new', '2025-09-06', 1480.50, true, 'AMS');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (5, 10, 2, '2020-02-02', '2021-02-02', false, 'Test', '2025-09-08 23:37:47.681511', '2025-09-08 23:37:47.681511', NULL, NULL, NULL, 'used', '2020-02-02', NULL, false, 'Kamer.ba');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (6, 11, 9, '2024-01-20', '2025-01-20', false, 'usrana', '2025-09-09 19:34:59.52792', '2025-09-09 19:34:59.52792', NULL, NULL, NULL, 'used', '2024-01-20', NULL, false, 'ZEKA doo');


--
-- TOC entry 5696 (class 0 OID 62787)
-- Dependencies: 241
-- Data for Name: customer_communications; Type: TABLE DATA; Schema: public; Owner: repairadmin
--



--
-- TOC entry 5698 (class 0 OID 72156)
-- Dependencies: 243
-- Data for Name: customer_preferences; Type: TABLE DATA; Schema: public; Owner: repairadmin
--



--
-- TOC entry 5678 (class 0 OID 16404)
-- Dependencies: 223
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) VALUES (1, 'John Smith', '38761123456', 'john.smith@example.com', '2025-09-06 19:36:56.063316', '2025-09-06 19:36:56.063316', 'Smith & Co.', 'BA123456789', 'Sarajevo', '71000', 'Main Street 10', '38762123456', '38733123456', 1, '2025-09-06 19:36:56.063316', 'Key account, assigned to Admin', 'active', 'private', NULL);
INSERT INTO public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) VALUES (2, 'Maria Garcia', '38761234567', 'maria.garcia@example.com', '2025-09-06 19:36:56.063316', '2025-09-06 19:36:56.063316', 'Garcia Enterprises', 'BA987654321', 'Banja Luka', '78000', 'Oak Avenue 5', '38762234567', NULL, 1, '2025-09-06 19:36:56.063316', 'New customer, assigned to Admin', 'active', 'private', NULL);
INSERT INTO public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) VALUES (3, 'Ahmed Hassan', '38761345678', 'ahmed.hassan@example.com', '2025-09-06 19:36:56.063316', '2025-09-06 19:36:56.063316', 'Hassan Solutions', 'BA112233445', 'Tuzla', '75000', 'Pine Road 22', NULL, '38735112233', 1, '2025-09-06 19:36:56.063316', 'Regular client, assigned to Admin', 'active', 'private', NULL);
INSERT INTO public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) VALUES (4, 'Petra Novak', '38761456789', 'petra.novak@example.com', '2025-09-06 19:36:56.063316', '2025-09-06 19:36:56.063316', 'Novak Industries', 'BA556677889', 'Mostar', '88000', 'Bridge Street 7', '38762456789', NULL, 1, '2025-09-06 19:36:56.063316', 'Potential growth, assigned to Admin', 'active', 'private', NULL);
INSERT INTO public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) VALUES (5, 'Marko Petrovic', '38761567890', 'marko.petrovic@example.com', '2025-09-06 19:36:56.063316', '2025-09-06 19:36:56.063316', 'Petrovic Services', 'BA998877665', 'Zenica', '72000', 'River Side 15', NULL, '38732998877', 1, '2025-09-06 19:36:56.063316', 'Long-term partner, assigned to Admin', 'active', 'private', NULL);
INSERT INTO public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) VALUES (6, 'Hamza Merdžanić', '061 174 610', 'hamza@kamer.ba', '2025-09-07 01:45:18.649244', '2025-09-07 02:40:31.479486', 'Kamer Commerce d.o.o.', '12345678912', 'Sarajevo', '71000', 'Nahorevska do 250', '033 424 097', '033 424 095', 6, '2025-09-07 01:45:18.649244', 'Najjači kupac ikad', 'active', 'private', NULL);
INSERT INTO public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) VALUES (8, 'Lejla Merdžanić', '062 702 142', 'lela.merdzanic@gmail.com', '2025-09-07 05:22:21.21132', '2025-09-07 05:22:21.21132', NULL, NULL, 'Sarajevo', '71000', 'Nahorevska do 250', '061 174 610', NULL, 2, '2025-09-07 05:22:21.21132', 'Hamzina žena', 'active', 'private', NULL);
INSERT INTO public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) VALUES (9, 'Zakir Činjarević', '061 061 061', 'zakir@gmail.com', '2025-09-09 19:33:15.147376', '2025-09-09 19:33:15.147376', '', '', 'Sarajevo', '71000', 'Tekijska bb', '', '', 6, '2025-09-09 19:33:15.147376', 'pegla', 'active', 'private', NULL);
INSERT INTO public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) VALUES (10, 'Muhamed Kašić', '061061061', 'muhamed@kamer.ba', '2025-09-10 10:49:39.953864', '2025-09-10 10:49:39.953864', '', '', 'Sarajevo', '71000', 'Test bb', '060062062', '', 6, '2025-09-10 10:49:39.953864', 'test', 'active', 'private', NULL);
INSERT INTO public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) VALUES (16, 'asdasdasdsa', '16565165', 'asdasd@gmail.com', '2025-09-11 01:55:56.613747', '2025-09-11 01:55:56.613747', 'asdasdasdsa', '56165565165', 'dsfsdfds', '5165165', 'asdasd', '56165165', '65165165', 6, '2025-09-11 01:55:56.613747', 'sadasd', 'active', 'company', 'asdasd');


--
-- TOC entry 5684 (class 0 OID 16455)
-- Dependencies: 229
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.inventory (id, name, description, quantity, created_at, unit_price, updated_at, part_number, barcode, category, reorder_level, supplier_id, location, min_order_quantity, lead_time_days, min_stock_level, supplier, sku) VALUES (1, 'Set gumica TR', 'Gumice za crijevo i pištolj.', 94, '2025-09-07 23:16:23.181442', 25.00, '2025-09-09 19:40:17.435234', NULL, NULL, 'Visoki pritisak', 5, NULL, 'Veleprodaja, K1 polica', 1, 7, 5, 'Karcher', '2.880-001.0');
INSERT INTO public.inventory (id, name, description, quantity, created_at, unit_price, updated_at, part_number, barcode, category, reorder_level, supplier_id, location, min_order_quantity, lead_time_days, min_stock_level, supplier, sku) VALUES (2, 'Pumpa puzzi 10/1 sa kablom', 'Pumpa za Puzzi mašine OEM', 96, '2025-09-08 10:07:21.390912', 200.00, '2025-09-10 11:36:23.862969', NULL, NULL, 'Puzzi', 5, NULL, 'Veleprodaja, Polica M1', 1, 7, 5, 'HydroFLex', 'HF0400506100B');


--
-- TOC entry 5740 (class 0 OID 289251)
-- Dependencies: 290
-- Data for Name: inventory_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (1, 'Parts', 'Mechanical and electrical parts', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (2, 'Tools', 'Hand tools and equipment', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (3, 'Supplies', 'General supplies and consumables', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (4, 'Equipment', 'Heavy machinery and equipment', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (5, 'Consumables', 'Items that are consumed during operations', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (6, 'Electronics', 'Electronic components and devices', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (7, 'Mechanical', 'Mechanical components and systems', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (8, 'Electrical', 'Electrical components and wiring', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (9, 'Hydraulic', 'Hydraulic systems and components', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (10, 'Pneumatic', 'Pneumatic systems and components', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (11, 'Safety', 'Safety equipment and protective gear', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (12, 'Cleaning', 'Cleaning supplies and chemicals', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (13, 'Lubricants', 'Oils, greases, and lubricating fluids', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (14, 'Filters', 'Air, oil, and fluid filters', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (15, 'Belts', 'Drive belts and conveyor belts', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (16, 'Other', 'Miscellaneous items', '2025-09-07 23:05:56.141197', '2025-09-07 23:05:56.141197');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (17, 'Visoki pritisak', 'Category for Visoki pritisak', '2025-09-07 23:15:05.612135', '2025-09-07 23:15:05.612135');
INSERT INTO public.inventory_categories (id, name, description, created_at, updated_at) VALUES (18, 'Puzzi', 'Category for Puzzi', '2025-09-08 10:06:51.536504', '2025-09-08 10:06:51.536504');


--
-- TOC entry 5738 (class 0 OID 287871)
-- Dependencies: 285
-- Data for Name: lead_follow_ups; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.lead_follow_ups (id, lead_id, notes, action_taken, outcome, created_by, created_at, follow_up_date, follow_up_type, completed, completed_at, updated_at) VALUES (4, 2, 'test', NULL, NULL, 6, '2025-09-09 23:13:30.118806', '2025-09-10 00:00:00', 'meeting', true, '2025-09-09 23:35:02.426016', '2025-09-09 23:35:02.426016');
INSERT INTO public.lead_follow_ups (id, lead_id, notes, action_taken, outcome, created_by, created_at, follow_up_date, follow_up_type, completed, completed_at, updated_at) VALUES (5, 3, 'klinac', NULL, NULL, 5, '2025-09-10 11:44:27.960694', '2025-09-12 00:00:00', 'proposal', false, NULL, '2025-09-10 11:44:27.960694');


--
-- TOC entry 5736 (class 0 OID 287845)
-- Dependencies: 283
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.leads (id, customer_name, company_name, email, phone, source, lead_quality, sales_stage, potential_value, sales_notes, next_follow_up, assigned_to, created_by, pipeline_position, created_at, updated_at) VALUES (2, 'huso husic', 'huso doo', 'huso@gmail.com', '061 061 061', 'Cold Call', 'medium', 'new', 1000.00, 'test', '2025-09-10 00:00:00', 7, 6, 0, '2025-09-09 22:47:59.094613', '2025-09-09 23:03:28.528405');
INSERT INTO public.leads (id, customer_name, company_name, email, phone, source, lead_quality, sales_stage, potential_value, sales_notes, next_follow_up, assigned_to, created_by, pipeline_position, created_at, updated_at) VALUES (3, 'test test', 'test', 'test@test.com', '061061061', 'Referral', 'high', 'qualified', 500.00, 'test', NULL, 6, 6, 0, '2025-09-09 23:53:56.100543', '2025-09-10 01:40:52.588461');


--
-- TOC entry 5716 (class 0 OID 246182)
-- Dependencies: 261
-- Data for Name: machine_categories; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

INSERT INTO public.machine_categories (id, name, created_at, updated_at) VALUES (6, 'Visoki pritisak', '2025-08-27 23:54:57.850108', '2025-08-27 23:54:57.850108');
INSERT INTO public.machine_categories (id, name, created_at, updated_at) VALUES (7, 'HD mašine', '2025-08-29 10:14:48.924934', '2025-08-29 10:14:48.924934');
INSERT INTO public.machine_categories (id, name, created_at, updated_at) VALUES (8, 'NT usisivači', '2025-08-29 10:50:01.783195', '2025-08-29 10:50:01.783195');
INSERT INTO public.machine_categories (id, name, created_at, updated_at) VALUES (9, 'Testna kategorija', '2025-08-29 10:53:10.205686', '2025-08-29 10:53:10.205686');
INSERT INTO public.machine_categories (id, name, created_at, updated_at) VALUES (1, 'High Pressure Cleaners', '2025-09-06 19:33:09.949832', '2025-09-06 19:33:09.949832');
INSERT INTO public.machine_categories (id, name, created_at, updated_at) VALUES (2, 'Vacuum Cleaners', '2025-09-06 19:33:09.949832', '2025-09-06 19:33:09.949832');
INSERT INTO public.machine_categories (id, name, created_at, updated_at) VALUES (3, 'Floor Scrubbers', '2025-09-06 19:33:09.949832', '2025-09-06 19:33:09.949832');
INSERT INTO public.machine_categories (id, name, created_at, updated_at) VALUES (4, 'Industrial Cleaners', '2025-09-06 19:33:09.949832', '2025-09-06 19:33:09.949832');
INSERT INTO public.machine_categories (id, name, created_at, updated_at) VALUES (5, 'Classic Vacuums', '2025-09-06 19:33:09.949832', '2025-09-06 19:33:09.949832');
INSERT INTO public.machine_categories (id, name, created_at, updated_at) VALUES (10, 'HDS mašine', '2025-09-07 06:14:58.49135', '2025-09-07 06:14:58.49135');


--
-- TOC entry 5724 (class 0 OID 262357)
-- Dependencies: 269
-- Data for Name: machine_models; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.machine_models (id, name, catalogue_number, manufacturer, category_id, description, created_at, updated_at, warranty_months) VALUES (1, 'HD 5/15 C Plus', '1.520-930.0', 'Karcher', 1, 'Compact high-pressure cleaner for daily use.', '2025-09-06 19:36:56.063316', '2025-09-06 19:36:56.063316', 12);
INSERT INTO public.machine_models (id, name, catalogue_number, manufacturer, category_id, description, created_at, updated_at, warranty_months) VALUES (2, 'NT 65/2 Ap', '1.667-291.0', 'Karcher', 2, 'Powerful wet/dry vacuum cleaner with two motors.', '2025-09-06 19:36:56.063316', '2025-09-06 19:36:56.063316', 24);
INSERT INTO public.machine_models (id, name, catalogue_number, manufacturer, category_id, description, created_at, updated_at, warranty_months) VALUES (3, 'BR 40/10 C Adv', '1.783-310.0', 'Karcher', 3, 'Compact scrubber drier for small to medium areas.', '2025-09-06 19:36:56.063316', '2025-09-06 19:36:56.063316', 18);
INSERT INTO public.machine_models (id, name, catalogue_number, manufacturer, category_id, description, created_at, updated_at, warranty_months) VALUES (4, 'HDS 5/12 C', '1.170-900.0', 'Karcher', 4, 'Hot water high-pressure cleaner for tough dirt.', '2025-09-06 19:36:56.063316', '2025-09-06 19:36:56.063316', 12);
INSERT INTO public.machine_models (id, name, catalogue_number, manufacturer, category_id, description, created_at, updated_at, warranty_months) VALUES (5, 'T 8/1 Classic', '1.527-181.0', 'Karcher', 5, 'Economical dry vacuum cleaner for professional use.', '2025-09-06 19:36:56.063316', '2025-09-06 19:36:56.063316', 12);
INSERT INTO public.machine_models (id, name, catalogue_number, manufacturer, category_id, description, created_at, updated_at, warranty_months) VALUES (6, 'HDS 8/18 4C', '1.174-918.0', 'Milwaukee Tool', 10, 'HDS 8/18-4 C, najsnažniji 3-fazni visokotlačni čistač s toplom vodom u kompaktnoj klasi s eco!efficiency i parnim stupnjem, 3-klipnom aksijalnom pumpom i EASY!Force Advanced pištoljem.', '2025-09-07 06:15:22.277927', '2025-09-07 06:15:22.277927', 12);


--
-- TOC entry 5730 (class 0 OID 286248)
-- Dependencies: 276
-- Data for Name: machine_rentals; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5726 (class 0 OID 262375)
-- Dependencies: 271
-- Data for Name: machine_serials; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (1, 1, '061 061', 'available', '2025-09-06 19:55:24.349124', '2025-09-06 19:55:24.349124');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (2, 1, '789 456', 'available', '2025-09-06 20:02:01.044394', '2025-09-06 20:02:01.044394');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (9, 3, '555 222', 'available', '2025-09-07 02:12:23.860314', '2025-09-07 02:12:23.860314');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (10, 4, '222 444', 'available', '2025-09-08 23:37:47.681511', '2025-09-08 23:37:47.681511');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (11, 6, '456 235', 'available', '2025-09-09 19:34:59.52792', '2025-09-09 19:34:59.52792');


--
-- TOC entry 5680 (class 0 OID 16416)
-- Dependencies: 225
-- Data for Name: machines; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5704 (class 0 OID 169416)
-- Dependencies: 249
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (1, 7, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 20:24:39.674972', '2025-09-06 20:24:39.674972', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (2, 3, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 20:24:39.687233', '2025-09-06 20:24:39.687233', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (3, 6, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 20:24:39.691806', '2025-09-06 20:24:39.691806', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (4, 5, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 20:24:39.694096', '2025-09-06 20:24:39.694096', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (5, 2, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 20:24:39.696175', '2025-09-06 20:24:39.696175', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (6, 8, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 20:24:39.698481', '2025-09-06 20:24:39.698481', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (7, 9, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 20:24:39.701391', '2025-09-06 20:24:39.701391', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (8, 4, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 20:24:39.704008', '2025-09-06 20:24:39.704008', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (9, 5, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:24:39.706194', '2025-09-06 20:24:39.706194', 'notifications.workOrderAssignedToYou', 'notifications.workOrderAssignedToYou', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (10, 7, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.434299', '2025-09-06 20:52:53.434299', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (11, 3, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.437376', '2025-09-06 20:52:53.437376', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (12, 6, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.439572', '2025-09-06 20:52:53.439572', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (13, 5, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.441748', '2025-09-06 20:52:53.441748', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (14, 2, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.44369', '2025-09-06 20:52:53.44369', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (15, 8, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.445744', '2025-09-06 20:52:53.445744', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (16, 9, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.447841', '2025-09-06 20:52:53.447841', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (17, 4, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.449405', '2025-09-06 20:52:53.449405', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (18, 7, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.470363', '2025-09-06 20:52:53.470363', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (19, 3, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.473875', '2025-09-06 20:52:53.473875', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (20, 6, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.475564', '2025-09-06 20:52:53.475564', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (21, 5, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.477183', '2025-09-06 20:52:53.477183', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (22, 2, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.478656', '2025-09-06 20:52:53.478656', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (23, 8, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.480247', '2025-09-06 20:52:53.480247', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (24, 9, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.481509', '2025-09-06 20:52:53.481509', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (25, 4, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 20:52:53.482663', '2025-09-06 20:52:53.482663', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (26, 7, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.75305', '2025-09-06 21:56:36.75305', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (27, 3, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.758131', '2025-09-06 21:56:36.758131', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (28, 6, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.760404', '2025-09-06 21:56:36.760404', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (29, 5, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.762394', '2025-09-06 21:56:36.762394', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (30, 2, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.764493', '2025-09-06 21:56:36.764493', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (31, 8, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.766347', '2025-09-06 21:56:36.766347', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (32, 9, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.768262', '2025-09-06 21:56:36.768262', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (33, 4, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.769853', '2025-09-06 21:56:36.769853', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (34, 7, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.794449', '2025-09-06 21:56:36.794449', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (35, 3, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.797897', '2025-09-06 21:56:36.797897', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (36, 6, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.799838', '2025-09-06 21:56:36.799838', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (37, 5, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.801928', '2025-09-06 21:56:36.801928', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (38, 2, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.804599', '2025-09-06 21:56:36.804599', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (39, 8, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.809314', '2025-09-06 21:56:36.809314', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (40, 9, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.8125', '2025-09-06 21:56:36.8125', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (41, 4, '', '', 'work_order', false, 'work_order', 1, '2025-09-06 21:56:36.815319', '2025-09-06 21:56:36.815319', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (42, 7, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 22:23:38.420662', '2025-09-06 22:23:38.420662', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (43, 3, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 22:23:38.424057', '2025-09-06 22:23:38.424057', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (44, 6, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 22:23:38.425561', '2025-09-06 22:23:38.425561', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (45, 5, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 22:23:38.427722', '2025-09-06 22:23:38.427722', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (46, 2, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 22:23:38.429356', '2025-09-06 22:23:38.429356', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (47, 8, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 22:23:38.430933', '2025-09-06 22:23:38.430933', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (48, 9, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 22:23:38.432863', '2025-09-06 22:23:38.432863', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (49, 4, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 22:23:38.435051', '2025-09-06 22:23:38.435051', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (50, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:23:38.438089', '2025-09-06 22:23:38.438089', 'notifications.workOrderAssignedToYou', 'notifications.workOrderAssignedToYou', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (51, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.364874', '2025-09-06 22:32:11.364874', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (53, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.379706', '2025-09-06 22:32:11.379706', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (52, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.37838', '2025-09-06 22:32:11.37838', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (54, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.384958', '2025-09-06 22:32:11.384958', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (55, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.385812', '2025-09-06 22:32:11.385812', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (56, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.388695', '2025-09-06 22:32:11.388695', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (57, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.38989', '2025-09-06 22:32:11.38989', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (58, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.393106', '2025-09-06 22:32:11.393106', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (59, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.393783', '2025-09-06 22:32:11.393783', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (60, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.399019', '2025-09-06 22:32:11.399019', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (61, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.400716', '2025-09-06 22:32:11.400716', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (62, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.403084', '2025-09-06 22:32:11.403084', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (63, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.406526', '2025-09-06 22:32:11.406526', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (64, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.408338', '2025-09-06 22:32:11.408338', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (65, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.41095', '2025-09-06 22:32:11.41095', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (66, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:32:11.413347', '2025-09-06 22:32:11.413347', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (67, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.935301', '2025-09-06 22:43:43.935301', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (68, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.939607', '2025-09-06 22:43:43.939607', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (69, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.942726', '2025-09-06 22:43:43.942726', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (71, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.945264', '2025-09-06 22:43:43.945264', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (70, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.944666', '2025-09-06 22:43:43.944666', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (72, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.947557', '2025-09-06 22:43:43.947557', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (73, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.949728', '2025-09-06 22:43:43.949728', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (74, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.950389', '2025-09-06 22:43:43.950389', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (75, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.952408', '2025-09-06 22:43:43.952408', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (76, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.952989', '2025-09-06 22:43:43.952989', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (78, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.956711', '2025-09-06 22:43:43.956711', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (77, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.956235', '2025-09-06 22:43:43.956235', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (79, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.960191', '2025-09-06 22:43:43.960191', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (80, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.962108', '2025-09-06 22:43:43.962108', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (81, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.964312', '2025-09-06 22:43:43.964312', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (82, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:43:43.966485', '2025-09-06 22:43:43.966485', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (83, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.409335', '2025-09-06 22:50:22.409335', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (84, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.418804', '2025-09-06 22:50:22.418804', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (85, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.423144', '2025-09-06 22:50:22.423144', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (86, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.426093', '2025-09-06 22:50:22.426093', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (87, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.428796', '2025-09-06 22:50:22.428796', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (88, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.431359', '2025-09-06 22:50:22.431359', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (89, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.433966', '2025-09-06 22:50:22.433966', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (90, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.436989', '2025-09-06 22:50:22.436989', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (91, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.484017', '2025-09-06 22:50:22.484017', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (92, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.491214', '2025-09-06 22:50:22.491214', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (93, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.495127', '2025-09-06 22:50:22.495127', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (94, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.497563', '2025-09-06 22:50:22.497563', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (95, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.499884', '2025-09-06 22:50:22.499884', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (96, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.503005', '2025-09-06 22:50:22.503005', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (97, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.506742', '2025-09-06 22:50:22.506742', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (98, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:22.51052', '2025-09-06 22:50:22.51052', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (99, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.902557', '2025-09-06 22:50:33.902557', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (100, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.905991', '2025-09-06 22:50:33.905991', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (101, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.919585', '2025-09-06 22:50:33.919585', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (102, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.926866', '2025-09-06 22:50:33.926866', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (103, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.93415', '2025-09-06 22:50:33.93415', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (104, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.936372', '2025-09-06 22:50:33.936372', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (105, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.939362', '2025-09-06 22:50:33.939362', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (106, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.940802', '2025-09-06 22:50:33.940802', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (107, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.94276', '2025-09-06 22:50:33.94276', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (108, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.946235', '2025-09-06 22:50:33.946235', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (109, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.949939', '2025-09-06 22:50:33.949939', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (110, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.96185', '2025-09-06 22:50:33.96185', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (111, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.96365', '2025-09-06 22:50:33.96365', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (112, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.967182', '2025-09-06 22:50:33.967182', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (113, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.968456', '2025-09-06 22:50:33.968456', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (114, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:50:33.979562', '2025-09-06 22:50:33.979562', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (151, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.901293', '2025-09-06 22:56:26.901293', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (115, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:25.971538', '2025-09-06 22:51:25.971538', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (116, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:25.979983', '2025-09-06 22:51:25.979983', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (117, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:25.983406', '2025-09-06 22:51:25.983406', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (118, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:25.987018', '2025-09-06 22:51:25.987018', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (119, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:25.989633', '2025-09-06 22:51:25.989633', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (120, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:25.997179', '2025-09-06 22:51:25.997179', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (121, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:26.005165', '2025-09-06 22:51:26.005165', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (122, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:26.010596', '2025-09-06 22:51:26.010596', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (123, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:26.051584', '2025-09-06 22:51:26.051584', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (124, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:26.060264', '2025-09-06 22:51:26.060264', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (125, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:26.06257', '2025-09-06 22:51:26.06257', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (126, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:26.064767', '2025-09-06 22:51:26.064767', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (127, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:26.066802', '2025-09-06 22:51:26.066802', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (128, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:26.069921', '2025-09-06 22:51:26.069921', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (129, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:26.07431', '2025-09-06 22:51:26.07431', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (130, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:51:26.077595', '2025-09-06 22:51:26.077595', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (131, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:14.989205', '2025-09-06 22:56:14.989205', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (132, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.001716', '2025-09-06 22:56:15.001716', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (133, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.009755', '2025-09-06 22:56:15.009755', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (134, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.016477', '2025-09-06 22:56:15.016477', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (135, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.020727', '2025-09-06 22:56:15.020727', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (136, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.026173', '2025-09-06 22:56:15.026173', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (137, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.031255', '2025-09-06 22:56:15.031255', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (138, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.034873', '2025-09-06 22:56:15.034873', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (139, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.065559', '2025-09-06 22:56:15.065559', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (140, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.073143', '2025-09-06 22:56:15.073143', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (141, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.07739', '2025-09-06 22:56:15.07739', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (142, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.080673', '2025-09-06 22:56:15.080673', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (143, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.083243', '2025-09-06 22:56:15.083243', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (144, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.085925', '2025-09-06 22:56:15.085925', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (145, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.089508', '2025-09-06 22:56:15.089508', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (146, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:15.09287', '2025-09-06 22:56:15.09287', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (147, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.88073', '2025-09-06 22:56:26.88073', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.serviceCancelled", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (148, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.891794', '2025-09-06 22:56:26.891794', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.serviceCancelled", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (149, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.893013', '2025-09-06 22:56:26.893013', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (150, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.897102', '2025-09-06 22:56:26.897102', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.serviceCancelled", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (152, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.903205', '2025-09-06 22:56:26.903205', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.serviceCancelled", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (154, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.910365', '2025-09-06 22:56:26.910365', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.serviceCancelled", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (156, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.914943', '2025-09-06 22:56:26.914943', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.serviceCancelled", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (158, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.919219', '2025-09-06 22:56:26.919219', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.serviceCancelled", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (160, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.923879', '2025-09-06 22:56:26.923879', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.serviceCancelled", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (153, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.908944', '2025-09-06 22:56:26.908944', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (155, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.913974', '2025-09-06 22:56:26.913974', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (157, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.917856', '2025-09-06 22:56:26.917856', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (159, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.922849', '2025-09-06 22:56:26.922849', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (161, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.927118', '2025-09-06 22:56:26.927118', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (162, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:26.930122', '2025-09-06 22:56:26.930122', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (163, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.705123', '2025-09-06 22:56:43.705123', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.serviceCancelled"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (165, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.719112', '2025-09-06 22:56:43.719112', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.serviceCancelled"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (167, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.72375', '2025-09-06 22:56:43.72375', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.serviceCancelled"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (169, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.728102', '2025-09-06 22:56:43.728102', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.serviceCancelled"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (171, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.732837', '2025-09-06 22:56:43.732837', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.serviceCancelled"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (173, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.73672', '2025-09-06 22:56:43.73672', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.serviceCancelled"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (175, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.742117', '2025-09-06 22:56:43.742117', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.serviceCancelled"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (177, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.745985', '2025-09-06 22:56:43.745985', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.serviceCancelled"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (164, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.717275', '2025-09-06 22:56:43.717275', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (166, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.72267', '2025-09-06 22:56:43.72267', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (168, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.727031', '2025-09-06 22:56:43.727031', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (170, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.731984', '2025-09-06 22:56:43.731984', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (172, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.735835', '2025-09-06 22:56:43.735835', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (174, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.741121', '2025-09-06 22:56:43.741121', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (176, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.745023', '2025-09-06 22:56:43.745023', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (178, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 22:56:43.749509', '2025-09-06 22:56:43.749509', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (179, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.700948', '2025-09-06 23:02:44.700948', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (180, 7, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.709391', '2025-09-06 23:02:44.709391', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (181, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.715355', '2025-09-06 23:02:44.715355', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (182, 3, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.720522', '2025-09-06 23:02:44.720522', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (183, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.721843', '2025-09-06 23:02:44.721843', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (184, 6, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.726556', '2025-09-06 23:02:44.726556', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (185, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.728499', '2025-09-06 23:02:44.728499', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (186, 5, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.73223', '2025-09-06 23:02:44.73223', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (187, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.733348', '2025-09-06 23:02:44.733348', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (188, 2, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.737352', '2025-09-06 23:02:44.737352', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (189, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.739021', '2025-09-06 23:02:44.739021', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (190, 8, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.745657', '2025-09-06 23:02:44.745657', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (191, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.746945', '2025-09-06 23:02:44.746945', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (192, 9, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.751754', '2025-09-06 23:02:44.751754', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (193, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.752845', '2025-09-06 23:02:44.752845', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.pending", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (194, 4, '', '', 'work_order', false, 'work_order', 2, '2025-09-06 23:02:44.757267', '2025-09-06 23:02:44.757267', 'notifications.workOrderUpdated', 'notifications.workOrderUpdatedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (195, 7, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 23:14:13.733988', '2025-09-06 23:14:13.733988', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (196, 3, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 23:14:13.745086', '2025-09-06 23:14:13.745086', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (197, 6, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 23:14:13.749409', '2025-09-06 23:14:13.749409', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (198, 5, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 23:14:13.754333', '2025-09-06 23:14:13.754333', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (199, 2, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 23:14:13.758118', '2025-09-06 23:14:13.758118', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (200, 8, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 23:14:13.76251', '2025-09-06 23:14:13.76251', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (201, 9, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 23:14:13.765711', '2025-09-06 23:14:13.765711', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (202, 4, '', '', 'repair_ticket', false, 'repair_ticket', 1, '2025-09-06 23:14:13.769053', '2025-09-06 23:14:13.769053', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (203, 5, '', '', 'work_order', false, 'work_order', 3, '2025-09-06 23:14:13.772137', '2025-09-06 23:14:13.772137', 'notifications.workOrderAssignedToYou', 'notifications.workOrderAssignedToYou', '{"number": "53/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (204, 7, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:31:03.51325', '2025-09-07 00:31:03.51325', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (205, 3, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:31:03.519687', '2025-09-07 00:31:03.519687', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (206, 6, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:31:03.522458', '2025-09-07 00:31:03.522458', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (207, 5, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:31:03.525591', '2025-09-07 00:31:03.525591', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (208, 2, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:31:03.52951', '2025-09-07 00:31:03.52951', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (209, 8, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:31:03.532453', '2025-09-07 00:31:03.532453', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (210, 9, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:31:03.535205', '2025-09-07 00:31:03.535205', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (211, 4, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:31:03.538404', '2025-09-07 00:31:03.538404', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (212, 7, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:50:29.379323', '2025-09-07 00:50:29.379323', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (213, 3, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:50:29.385081', '2025-09-07 00:50:29.385081', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (214, 6, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:50:29.386879', '2025-09-07 00:50:29.386879', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (215, 5, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:50:29.388553', '2025-09-07 00:50:29.388553', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (216, 2, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:50:29.390203', '2025-09-07 00:50:29.390203', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (217, 8, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:50:29.391741', '2025-09-07 00:50:29.391741', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (218, 9, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:50:29.393452', '2025-09-07 00:50:29.393452', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (219, 4, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 00:50:29.394729', '2025-09-07 00:50:29.394729', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (220, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 1, '2025-09-07 00:50:29.396127', '2025-09-07 00:50:29.396127', 'notifications.warrantyWorkOrderAssignedToYou', 'notifications.warrantyWorkOrderAssignedToYou', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (221, 7, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:15:40.186086', '2025-09-07 03:15:40.186086', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (222, 3, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:15:40.191683', '2025-09-07 03:15:40.191683', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (223, 6, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:15:40.19367', '2025-09-07 03:15:40.19367', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (224, 5, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:15:40.195525', '2025-09-07 03:15:40.195525', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (225, 2, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:15:40.197652', '2025-09-07 03:15:40.197652', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (226, 8, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:15:40.199992', '2025-09-07 03:15:40.199992', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (227, 9, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:15:40.20201', '2025-09-07 03:15:40.20201', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (228, 4, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:15:40.20428', '2025-09-07 03:15:40.20428', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (229, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:15:40.206112', '2025-09-07 03:15:40.206112', 'notifications.warrantyWorkOrderAssignedToYou', 'notifications.warrantyWorkOrderAssignedToYou', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (230, 7, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:25.438375', '2025-09-07 03:19:25.438375', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (231, 3, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:25.442539', '2025-09-07 03:19:25.442539', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (232, 6, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:25.444568', '2025-09-07 03:19:25.444568', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (233, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:25.446488', '2025-09-07 03:19:25.446488', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (234, 2, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:25.448259', '2025-09-07 03:19:25.448259', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (235, 8, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:25.450899', '2025-09-07 03:19:25.450899', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (236, 9, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:25.45332', '2025-09-07 03:19:25.45332', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (237, 4, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:25.455426', '2025-09-07 03:19:25.455426', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (238, 7, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:41.451351', '2025-09-07 03:19:41.451351', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (239, 3, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:41.453147', '2025-09-07 03:19:41.453147', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (240, 6, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:41.454796', '2025-09-07 03:19:41.454796', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (241, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:41.456322', '2025-09-07 03:19:41.456322', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (242, 2, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:41.457687', '2025-09-07 03:19:41.457687', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (410, 7, '', '', 'repair_ticket', false, 'repair_ticket', 7, '2025-09-08 10:55:10.885239', '2025-09-08 10:55:10.885239', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "61/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (243, 8, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:41.458998', '2025-09-07 03:19:41.458998', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (244, 9, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:41.460497', '2025-09-07 03:19:41.460497', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (245, 4, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:41.461933', '2025-09-07 03:19:41.461933', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (246, 7, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:48.038066', '2025-09-07 03:19:48.038066', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (247, 3, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:48.039765', '2025-09-07 03:19:48.039765', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (248, 6, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:48.041277', '2025-09-07 03:19:48.041277', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (249, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:48.042697', '2025-09-07 03:19:48.042697', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (250, 2, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:48.044067', '2025-09-07 03:19:48.044067', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (251, 8, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:48.045774', '2025-09-07 03:19:48.045774', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (252, 9, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:48.047451', '2025-09-07 03:19:48.047451', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (253, 4, '', '', 'warranty_work_order', false, 'warranty_work_order', 2, '2025-09-07 03:19:48.04888', '2025-09-07 03:19:48.04888', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (254, 7, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:21:59.540748', '2025-09-07 03:21:59.540748', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (255, 3, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:21:59.543912', '2025-09-07 03:21:59.543912', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (256, 6, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:21:59.545577', '2025-09-07 03:21:59.545577', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (257, 5, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:21:59.547035', '2025-09-07 03:21:59.547035', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (258, 2, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:21:59.548822', '2025-09-07 03:21:59.548822', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (259, 8, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:21:59.55076', '2025-09-07 03:21:59.55076', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (260, 9, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:21:59.552797', '2025-09-07 03:21:59.552797', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (261, 4, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 03:21:59.555215', '2025-09-07 03:21:59.555215', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (262, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:21:59.557251', '2025-09-07 03:21:59.557251', 'notifications.warrantyWorkOrderAssignedToYou', 'notifications.warrantyWorkOrderAssignedToYou', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (263, 7, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:22:12.933838', '2025-09-07 03:22:12.933838', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (264, 3, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:22:12.937088', '2025-09-07 03:22:12.937088', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (265, 6, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:22:12.939373', '2025-09-07 03:22:12.939373', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (266, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:22:12.941316', '2025-09-07 03:22:12.941316', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (267, 2, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:22:12.942899', '2025-09-07 03:22:12.942899', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (268, 8, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:22:12.944326', '2025-09-07 03:22:12.944326', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (269, 9, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:22:12.945763', '2025-09-07 03:22:12.945763', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (270, 4, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:22:12.947189', '2025-09-07 03:22:12.947189', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (271, 7, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:23:40.89241', '2025-09-07 03:23:40.89241', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.testing", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (272, 3, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:23:40.895692', '2025-09-07 03:23:40.895692', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.testing", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (273, 6, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:23:40.898011', '2025-09-07 03:23:40.898011', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.testing", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (274, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:23:40.900071', '2025-09-07 03:23:40.900071', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.testing", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (275, 2, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:23:40.902488', '2025-09-07 03:23:40.902488', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.testing", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (276, 8, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:23:40.905198', '2025-09-07 03:23:40.905198', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.testing", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (277, 9, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:23:40.907292', '2025-09-07 03:23:40.907292', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.testing", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (278, 4, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:23:40.909393', '2025-09-07 03:23:40.909393', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.testing", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (279, 7, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:25:56.091165', '2025-09-07 03:25:56.091165', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (280, 3, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:25:56.095793', '2025-09-07 03:25:56.095793', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (281, 6, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:25:56.098148', '2025-09-07 03:25:56.098148', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (282, 5, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:25:56.100394', '2025-09-07 03:25:56.100394', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (283, 2, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:25:56.10352', '2025-09-07 03:25:56.10352', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (284, 8, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:25:56.106674', '2025-09-07 03:25:56.106674', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (285, 9, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:25:56.10946', '2025-09-07 03:25:56.10946', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (286, 4, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:25:56.11198', '2025-09-07 03:25:56.11198', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (287, 7, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:36:59.32873', '2025-09-07 03:36:59.32873', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.testing"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (288, 3, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:36:59.331815', '2025-09-07 03:36:59.331815', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.testing"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (289, 6, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:36:59.33416', '2025-09-07 03:36:59.33416', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.testing"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (290, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:36:59.335733', '2025-09-07 03:36:59.335733', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.testing"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (291, 2, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:36:59.337231', '2025-09-07 03:36:59.337231', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.testing"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (292, 8, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:36:59.338765', '2025-09-07 03:36:59.338765', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.testing"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (293, 9, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:36:59.340491', '2025-09-07 03:36:59.340491', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.testing"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (294, 4, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:36:59.342381', '2025-09-07 03:36:59.342381', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.testing"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (295, 7, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:06.830474', '2025-09-07 03:41:06.830474', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (296, 3, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:06.834361', '2025-09-07 03:41:06.834361', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (297, 6, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:06.836578', '2025-09-07 03:41:06.836578', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (298, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:06.838305', '2025-09-07 03:41:06.838305', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (299, 2, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:06.840101', '2025-09-07 03:41:06.840101', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (300, 8, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:06.841637', '2025-09-07 03:41:06.841637', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (400, 4, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:41.960043', '2025-09-08 10:54:41.960043', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (301, 9, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:06.843167', '2025-09-07 03:41:06.843167', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (302, 4, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:06.845112', '2025-09-07 03:41:06.845112', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (303, 7, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:15.933921', '2025-09-07 03:41:15.933921', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (304, 3, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:15.936053', '2025-09-07 03:41:15.936053', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (305, 6, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:15.938232', '2025-09-07 03:41:15.938232', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (306, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:15.940032', '2025-09-07 03:41:15.940032', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (307, 2, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:15.941887', '2025-09-07 03:41:15.941887', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (308, 8, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:15.943906', '2025-09-07 03:41:15.943906', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (309, 9, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:15.946592', '2025-09-07 03:41:15.946592', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (310, 4, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:15.948538', '2025-09-07 03:41:15.948538', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (311, 7, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:30.34129', '2025-09-07 03:41:30.34129', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "warranty_declined", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (312, 3, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:30.343158', '2025-09-07 03:41:30.343158', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "warranty_declined", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (313, 6, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:30.344794', '2025-09-07 03:41:30.344794', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "warranty_declined", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (314, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:30.346364', '2025-09-07 03:41:30.346364', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "warranty_declined", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (315, 2, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:30.347958', '2025-09-07 03:41:30.347958', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "warranty_declined", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (316, 8, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:30.34942', '2025-09-07 03:41:30.34942', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "warranty_declined", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (317, 9, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:30.350782', '2025-09-07 03:41:30.350782', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "warranty_declined", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (318, 4, '', '', 'warranty_work_order', false, 'warranty_work_order', 3, '2025-09-07 03:41:30.3522', '2025-09-07 03:41:30.3522', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "54/25", "newStatus": "warranty_declined", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (319, 7, '', '', 'repair_ticket', false, 'repair_ticket', 2, '2025-09-07 03:50:10.86591', '2025-09-07 03:50:10.86591', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "55/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (320, 3, '', '', 'repair_ticket', false, 'repair_ticket', 2, '2025-09-07 03:50:10.870388', '2025-09-07 03:50:10.870388', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "55/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (321, 6, '', '', 'repair_ticket', false, 'repair_ticket', 2, '2025-09-07 03:50:10.872428', '2025-09-07 03:50:10.872428', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "55/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (322, 5, '', '', 'repair_ticket', false, 'repair_ticket', 2, '2025-09-07 03:50:10.874464', '2025-09-07 03:50:10.874464', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "55/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (323, 2, '', '', 'repair_ticket', false, 'repair_ticket', 2, '2025-09-07 03:50:10.876427', '2025-09-07 03:50:10.876427', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "55/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (324, 8, '', '', 'repair_ticket', false, 'repair_ticket', 2, '2025-09-07 03:50:10.878095', '2025-09-07 03:50:10.878095', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "55/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (325, 9, '', '', 'repair_ticket', false, 'repair_ticket', 2, '2025-09-07 03:50:10.880072', '2025-09-07 03:50:10.880072', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "55/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (326, 4, '', '', 'repair_ticket', false, 'repair_ticket', 2, '2025-09-07 03:50:10.881861', '2025-09-07 03:50:10.881861', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "55/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (327, 5, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:10.883502', '2025-09-07 03:50:10.883502', 'notifications.workOrderAssignedToYou', 'notifications.workOrderAssignedToYou', '{"number": "55/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (328, 7, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:50:25.418815', '2025-09-07 03:50:25.418815', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (329, 3, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:50:25.422517', '2025-09-07 03:50:25.422517', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (330, 6, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:50:25.424894', '2025-09-07 03:50:25.424894', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (331, 5, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:50:25.426892', '2025-09-07 03:50:25.426892', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (332, 2, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:50:25.429385', '2025-09-07 03:50:25.429385', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (333, 8, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:50:25.431719', '2025-09-07 03:50:25.431719', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (334, 9, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:50:25.434003', '2025-09-07 03:50:25.434003', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (335, 4, '', '', 'work_order', false, 'work_order', 3, '2025-09-07 03:50:25.435543', '2025-09-07 03:50:25.435543', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "53/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (336, 7, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:44.603178', '2025-09-07 03:50:44.603178', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (337, 3, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:44.606472', '2025-09-07 03:50:44.606472', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (338, 6, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:44.609128', '2025-09-07 03:50:44.609128', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (339, 5, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:44.61159', '2025-09-07 03:50:44.61159', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (340, 2, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:44.614305', '2025-09-07 03:50:44.614305', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (341, 8, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:44.616755', '2025-09-07 03:50:44.616755', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (342, 9, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:44.618842', '2025-09-07 03:50:44.618842', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (343, 4, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:44.620739', '2025-09-07 03:50:44.620739', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (344, 7, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:49.820075', '2025-09-07 03:50:49.820075', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (345, 3, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:49.822291', '2025-09-07 03:50:49.822291', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (346, 6, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:49.823925', '2025-09-07 03:50:49.823925', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (347, 5, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:49.8255', '2025-09-07 03:50:49.8255', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (348, 2, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:49.827278', '2025-09-07 03:50:49.827278', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (349, 8, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:49.829372', '2025-09-07 03:50:49.829372', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (350, 9, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:49.831489', '2025-09-07 03:50:49.831489', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (351, 4, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 03:50:49.833043', '2025-09-07 03:50:49.833043', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (352, 7, '', '', 'customer', false, 'customer', 7, '2025-09-07 21:35:55.765554', '2025-09-07 21:35:55.765554', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "Huso Husić"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (353, 3, '', '', 'customer', false, 'customer', 7, '2025-09-07 21:35:55.77288', '2025-09-07 21:35:55.77288', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "Huso Husić"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (354, 6, '', '', 'customer', false, 'customer', 7, '2025-09-07 21:35:55.775681', '2025-09-07 21:35:55.775681', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "Huso Husić"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (355, 2, '', '', 'customer', false, 'customer', 7, '2025-09-07 21:35:55.779934', '2025-09-07 21:35:55.779934', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "Huso Husić"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (356, 5, '', '', 'customer', false, 'customer', 7, '2025-09-07 21:35:55.782607', '2025-09-07 21:35:55.782607', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "Huso Husić"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (357, 8, '', '', 'customer', false, 'customer', 7, '2025-09-07 21:35:55.785037', '2025-09-07 21:35:55.785037', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "Huso Husić"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (358, 9, '', '', 'customer', false, 'customer', 7, '2025-09-07 21:35:55.787809', '2025-09-07 21:35:55.787809', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "Huso Husić"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (359, 4, '', '', 'customer', false, 'customer', 7, '2025-09-07 21:35:55.790032', '2025-09-07 21:35:55.790032', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "Huso Husić"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (360, 7, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:31:20.31474', '2025-09-07 23:31:20.31474', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (361, 3, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:31:20.321391', '2025-09-07 23:31:20.321391', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (362, 6, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:31:20.323998', '2025-09-07 23:31:20.323998', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (363, 2, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:31:20.325534', '2025-09-07 23:31:20.325534', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (364, 8, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:31:20.327389', '2025-09-07 23:31:20.327389', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (401, 7, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:51.01967', '2025-09-08 10:54:51.01967', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (365, 1, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:31:20.329107', '2025-09-07 23:31:20.329107', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (366, 9, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:31:20.331307', '2025-09-07 23:31:20.331307', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (367, 4, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:31:20.333002', '2025-09-07 23:31:20.333002', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.in_progress", "oldStatus": "status.completed"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (368, 7, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:32:04.317827', '2025-09-07 23:32:04.317827', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (369, 3, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:32:04.32225', '2025-09-07 23:32:04.32225', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (370, 6, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:32:04.324691', '2025-09-07 23:32:04.324691', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (371, 2, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:32:04.326649', '2025-09-07 23:32:04.326649', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (372, 8, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:32:04.328681', '2025-09-07 23:32:04.328681', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (373, 1, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:32:04.330688', '2025-09-07 23:32:04.330688', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (374, 9, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:32:04.332703', '2025-09-07 23:32:04.332703', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (375, 4, '', '', 'work_order', false, 'work_order', 4, '2025-09-07 23:32:04.334761', '2025-09-07 23:32:04.334761', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "55/25", "newStatus": "status.completed", "oldStatus": "status.in_progress"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (376, 7, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 23:57:28.078524', '2025-09-07 23:57:28.078524', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (377, 3, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 23:57:28.085175', '2025-09-07 23:57:28.085175', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (378, 6, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 23:57:28.090225', '2025-09-07 23:57:28.090225', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (379, 2, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 23:57:28.092796', '2025-09-07 23:57:28.092796', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (380, 8, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 23:57:28.094759', '2025-09-07 23:57:28.094759', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (381, 5, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 23:57:28.096406', '2025-09-07 23:57:28.096406', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (382, 9, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 23:57:28.098292', '2025-09-07 23:57:28.098292', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (383, 4, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 1, '2025-09-07 23:57:28.100175', '2025-09-07 23:57:28.100175', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (384, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 4, '2025-09-07 23:57:28.102267', '2025-09-07 23:57:28.102267', 'notifications.warrantyWorkOrderAssignedToYou', 'notifications.warrantyWorkOrderAssignedToYou', '{"number": "54/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (385, 7, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 2, '2025-09-08 10:24:46.619703', '2025-09-08 10:24:46.619703', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "58/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (386, 3, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 2, '2025-09-08 10:24:46.626476', '2025-09-08 10:24:46.626476', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "58/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (387, 6, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 2, '2025-09-08 10:24:46.629077', '2025-09-08 10:24:46.629077', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "58/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (388, 2, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 2, '2025-09-08 10:24:46.631511', '2025-09-08 10:24:46.631511', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "58/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (389, 8, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 2, '2025-09-08 10:24:46.634317', '2025-09-08 10:24:46.634317', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "58/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (390, 5, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 2, '2025-09-08 10:24:46.637558', '2025-09-08 10:24:46.637558', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "58/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (391, 9, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 2, '2025-09-08 10:24:46.639824', '2025-09-08 10:24:46.639824', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "58/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (392, 4, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 2, '2025-09-08 10:24:46.641564', '2025-09-08 10:24:46.641564', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "58/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (393, 7, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:41.946633', '2025-09-08 10:54:41.946633', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (394, 3, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:41.950134', '2025-09-08 10:54:41.950134', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (395, 6, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:41.951821', '2025-09-08 10:54:41.951821', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (396, 2, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:41.953345', '2025-09-08 10:54:41.953345', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (397, 8, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:41.955087', '2025-09-08 10:54:41.955087', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (398, 5, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:41.956718', '2025-09-08 10:54:41.956718', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (399, 9, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:41.958484', '2025-09-08 10:54:41.958484', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (402, 3, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:51.023344', '2025-09-08 10:54:51.023344', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (403, 6, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:51.025633', '2025-09-08 10:54:51.025633', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (404, 2, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:51.027495', '2025-09-08 10:54:51.027495', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (405, 8, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:51.029306', '2025-09-08 10:54:51.029306', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (406, 5, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:51.031524', '2025-09-08 10:54:51.031524', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (407, 9, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:51.03417', '2025-09-08 10:54:51.03417', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (408, 4, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 3, '2025-09-08 10:54:51.036462', '2025-09-08 10:54:51.036462', 'notifications.warrantyTicketConverted', 'notifications.warrantyTicketConvertedMessage', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (409, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 5, '2025-09-08 10:54:51.039389', '2025-09-08 10:54:51.039389', 'notifications.warrantyWorkOrderAssignedToYou', 'notifications.warrantyWorkOrderAssignedToYou', '{"number": "62/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (411, 3, '', '', 'repair_ticket', false, 'repair_ticket', 7, '2025-09-08 10:55:10.886835', '2025-09-08 10:55:10.886835', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "61/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (412, 6, '', '', 'repair_ticket', false, 'repair_ticket', 7, '2025-09-08 10:55:10.88835', '2025-09-08 10:55:10.88835', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "61/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (413, 2, '', '', 'repair_ticket', false, 'repair_ticket', 7, '2025-09-08 10:55:10.889748', '2025-09-08 10:55:10.889748', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "61/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (414, 8, '', '', 'repair_ticket', false, 'repair_ticket', 7, '2025-09-08 10:55:10.891331', '2025-09-08 10:55:10.891331', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "61/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (415, 5, '', '', 'repair_ticket', false, 'repair_ticket', 7, '2025-09-08 10:55:10.893019', '2025-09-08 10:55:10.893019', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "61/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (416, 9, '', '', 'repair_ticket', false, 'repair_ticket', 7, '2025-09-08 10:55:10.894719', '2025-09-08 10:55:10.894719', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "61/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (417, 4, '', '', 'repair_ticket', false, 'repair_ticket', 7, '2025-09-08 10:55:10.896475', '2025-09-08 10:55:10.896475', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "61/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (418, 5, '', '', 'work_order', false, 'work_order', 5, '2025-09-08 10:55:10.899221', '2025-09-08 10:55:10.899221', 'notifications.workOrderAssignedToYou', 'notifications.workOrderAssignedToYou', '{"number": "61/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (419, 7, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 4, '2025-09-09 09:28:58.777126', '2025-09-09 09:28:58.777126', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "64/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (420, 6, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 4, '2025-09-09 09:28:58.782543', '2025-09-09 09:28:58.782543', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "64/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (421, 2, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 4, '2025-09-09 09:28:58.784598', '2025-09-09 09:28:58.784598', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "64/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (422, 3, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 4, '2025-09-09 09:28:58.786875', '2025-09-09 09:28:58.786875', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "64/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (423, 1, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 4, '2025-09-09 09:28:58.788675', '2025-09-09 09:28:58.788675', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "64/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (424, 8, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 4, '2025-09-09 09:28:58.790238', '2025-09-09 09:28:58.790238', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "64/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (425, 9, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 4, '2025-09-09 09:28:58.792014', '2025-09-09 09:28:58.792014', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "64/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (426, 4, '', '', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 4, '2025-09-09 09:28:58.793467', '2025-09-09 09:28:58.793467', 'notifications.warrantyTicketCreated', 'notifications.warrantyTicketCreatedMessage', '{"number": "64/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (427, 7, '', '', 'warranty_work_order', false, 'warranty_work_order', 5, '2025-09-09 11:57:22.987706', '2025-09-09 11:57:22.987706', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "62/25", "newStatus": "status.testing", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (428, 3, '', '', 'warranty_work_order', false, 'warranty_work_order', 5, '2025-09-09 11:57:22.992496', '2025-09-09 11:57:22.992496', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "62/25", "newStatus": "status.testing", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (429, 2, '', '', 'warranty_work_order', false, 'warranty_work_order', 5, '2025-09-09 11:57:22.995544', '2025-09-09 11:57:22.995544', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "62/25", "newStatus": "status.testing", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (430, 6, '', '', 'warranty_work_order', false, 'warranty_work_order', 5, '2025-09-09 11:57:22.998184', '2025-09-09 11:57:22.998184', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "62/25", "newStatus": "status.testing", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (431, 5, '', '', 'warranty_work_order', false, 'warranty_work_order', 5, '2025-09-09 11:57:23.000226', '2025-09-09 11:57:23.000226', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "62/25", "newStatus": "status.testing", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (432, 8, '', '', 'warranty_work_order', false, 'warranty_work_order', 5, '2025-09-09 11:57:23.001729', '2025-09-09 11:57:23.001729', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "62/25", "newStatus": "status.testing", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (433, 9, '', '', 'warranty_work_order', false, 'warranty_work_order', 5, '2025-09-09 11:57:23.004012', '2025-09-09 11:57:23.004012', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "62/25", "newStatus": "status.testing", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (434, 4, '', '', 'warranty_work_order', false, 'warranty_work_order', 5, '2025-09-09 11:57:23.005741', '2025-09-09 11:57:23.005741', 'notifications.warrantyWorkOrderStatusChanged', 'notifications.warrantyWorkOrderStatusChangedMessage', '{"number": "62/25", "newStatus": "status.testing", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (435, 7, '', '', 'repair_ticket', false, 'repair_ticket', 10, '2025-09-09 19:39:18.769441', '2025-09-09 19:39:18.769441', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "66/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (436, 3, '', '', 'repair_ticket', false, 'repair_ticket', 10, '2025-09-09 19:39:18.783212', '2025-09-09 19:39:18.783212', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "66/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (437, 2, '', '', 'repair_ticket', false, 'repair_ticket', 10, '2025-09-09 19:39:18.787186', '2025-09-09 19:39:18.787186', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "66/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (438, 1, '', '', 'repair_ticket', false, 'repair_ticket', 10, '2025-09-09 19:39:18.792025', '2025-09-09 19:39:18.792025', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "66/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (439, 6, '', '', 'repair_ticket', false, 'repair_ticket', 10, '2025-09-09 19:39:18.796326', '2025-09-09 19:39:18.796326', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "66/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (440, 8, '', '', 'repair_ticket', false, 'repair_ticket', 10, '2025-09-09 19:39:18.800197', '2025-09-09 19:39:18.800197', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "66/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (441, 9, '', '', 'repair_ticket', false, 'repair_ticket', 10, '2025-09-09 19:39:18.803962', '2025-09-09 19:39:18.803962', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "66/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (442, 4, '', '', 'repair_ticket', false, 'repair_ticket', 10, '2025-09-09 19:39:18.808366', '2025-09-09 19:39:18.808366', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "66/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (443, 2, '', '', 'work_order', false, 'work_order', 6, '2025-09-09 19:39:18.814241', '2025-09-09 19:39:18.814241', 'notifications.workOrderCreated', 'notifications.workOrderCreatedMessage', '{"number": "66/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (444, 1, '', '', 'work_order', false, 'work_order', 6, '2025-09-09 19:39:18.818114', '2025-09-09 19:39:18.818114', 'notifications.workOrderCreated', 'notifications.workOrderCreatedMessage', '{"number": "66/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (445, 9, '', '', 'work_order', false, 'work_order', 6, '2025-09-09 19:39:18.822159', '2025-09-09 19:39:18.822159', 'notifications.workOrderCreated', 'notifications.workOrderCreatedMessage', '{"number": "66/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (446, 7, '', '', 'work_order', false, 'work_order', 6, '2025-09-09 19:41:26.993453', '2025-09-09 19:41:26.993453', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "66/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (447, 3, '', '', 'work_order', false, 'work_order', 6, '2025-09-09 19:41:27.001808', '2025-09-09 19:41:27.001808', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "66/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (448, 2, '', '', 'work_order', false, 'work_order', 6, '2025-09-09 19:41:27.014412', '2025-09-09 19:41:27.014412', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "66/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (449, 1, '', '', 'work_order', false, 'work_order', 6, '2025-09-09 19:41:27.026021', '2025-09-09 19:41:27.026021', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "66/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (450, 6, '', '', 'work_order', false, 'work_order', 6, '2025-09-09 19:41:27.030154', '2025-09-09 19:41:27.030154', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "66/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (451, 8, '', '', 'work_order', false, 'work_order', 6, '2025-09-09 19:41:27.038609', '2025-09-09 19:41:27.038609', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "66/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (452, 9, '', '', 'work_order', false, 'work_order', 6, '2025-09-09 19:41:27.045649', '2025-09-09 19:41:27.045649', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "66/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (453, 4, '', '', 'work_order', false, 'work_order', 6, '2025-09-09 19:41:27.049359', '2025-09-09 19:41:27.049359', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "66/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (454, 7, '', '', 'work_order', false, 'work_order', 5, '2025-09-10 11:35:43.669983', '2025-09-10 11:35:43.669983', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "61/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (455, 3, '', '', 'work_order', false, 'work_order', 5, '2025-09-10 11:35:43.679235', '2025-09-10 11:35:43.679235', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "61/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (456, 2, '', '', 'work_order', false, 'work_order', 5, '2025-09-10 11:35:43.681777', '2025-09-10 11:35:43.681777', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "61/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (457, 1, '', '', 'work_order', false, 'work_order', 5, '2025-09-10 11:35:43.683685', '2025-09-10 11:35:43.683685', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "61/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (458, 8, '', '', 'work_order', false, 'work_order', 5, '2025-09-10 11:35:43.686151', '2025-09-10 11:35:43.686151', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "61/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (459, 6, '', '', 'work_order', false, 'work_order', 5, '2025-09-10 11:35:43.688062', '2025-09-10 11:35:43.688062', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "61/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (460, 9, '', '', 'work_order', false, 'work_order', 5, '2025-09-10 11:35:43.689494', '2025-09-10 11:35:43.689494', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "61/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (461, 4, '', '', 'work_order', false, 'work_order', 5, '2025-09-10 11:35:43.690839', '2025-09-10 11:35:43.690839', 'notifications.workOrderStatusChanged', 'notifications.workOrderStatusChangedMessage', '{"number": "61/25", "newStatus": "status.in_progress", "oldStatus": "status.pending"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (462, 7, '', '', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-10 13:36:28.000306', '2025-09-10 13:36:28.000306', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "65/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (463, 3, '', '', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-10 13:36:28.007046', '2025-09-10 13:36:28.007046', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "65/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (464, 2, '', '', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-10 13:36:28.009244', '2025-09-10 13:36:28.009244', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "65/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (465, 1, '', '', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-10 13:36:28.01156', '2025-09-10 13:36:28.01156', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "65/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (466, 8, '', '', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-10 13:36:28.01348', '2025-09-10 13:36:28.01348', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "65/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (467, 6, '', '', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-10 13:36:28.015473', '2025-09-10 13:36:28.015473', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "65/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (468, 9, '', '', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-10 13:36:28.017889', '2025-09-10 13:36:28.017889', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "65/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (469, 4, '', '', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-10 13:36:28.019821', '2025-09-10 13:36:28.019821', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "65/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (470, 2, '', '', 'work_order', false, 'work_order', 7, '2025-09-10 13:36:28.022639', '2025-09-10 13:36:28.022639', 'notifications.workOrderCreated', 'notifications.workOrderCreatedMessage', '{"number": "65/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (471, 1, '', '', 'work_order', false, 'work_order', 7, '2025-09-10 13:36:28.024569', '2025-09-10 13:36:28.024569', 'notifications.workOrderCreated', 'notifications.workOrderCreatedMessage', '{"number": "65/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (472, 9, '', '', 'work_order', false, 'work_order', 7, '2025-09-10 13:36:28.026066', '2025-09-10 13:36:28.026066', 'notifications.workOrderCreated', 'notifications.workOrderCreatedMessage', '{"number": "65/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (473, 7, '', '', 'repair_ticket', false, 'repair_ticket', 8, '2025-09-10 23:31:24.948966', '2025-09-10 23:31:24.948966', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "63/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (474, 1, '', '', 'repair_ticket', false, 'repair_ticket', 8, '2025-09-10 23:31:24.959143', '2025-09-10 23:31:24.959143', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "63/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (475, 3, '', '', 'repair_ticket', false, 'repair_ticket', 8, '2025-09-10 23:31:24.963056', '2025-09-10 23:31:24.963056', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "63/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (476, 2, '', '', 'repair_ticket', false, 'repair_ticket', 8, '2025-09-10 23:31:24.966145', '2025-09-10 23:31:24.966145', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "63/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (477, 8, '', '', 'repair_ticket', false, 'repair_ticket', 8, '2025-09-10 23:31:24.969098', '2025-09-10 23:31:24.969098', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "63/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (478, 6, '', '', 'repair_ticket', false, 'repair_ticket', 8, '2025-09-10 23:31:24.971861', '2025-09-10 23:31:24.971861', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "63/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (479, 9, '', '', 'repair_ticket', false, 'repair_ticket', 8, '2025-09-10 23:31:24.975258', '2025-09-10 23:31:24.975258', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "63/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (480, 4, '', '', 'repair_ticket', false, 'repair_ticket', 8, '2025-09-10 23:31:24.977992', '2025-09-10 23:31:24.977992', 'notifications.ticketConverted', 'notifications.ticketConvertedMessage', '{"number": "63/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (481, 1, '', '', 'work_order', false, 'work_order', 8, '2025-09-10 23:31:24.982662', '2025-09-10 23:31:24.982662', 'notifications.workOrderCreated', 'notifications.workOrderCreatedMessage', '{"number": "63/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (482, 2, '', '', 'work_order', false, 'work_order', 8, '2025-09-10 23:31:24.985246', '2025-09-10 23:31:24.985246', 'notifications.workOrderCreated', 'notifications.workOrderCreatedMessage', '{"number": "63/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (483, 9, '', '', 'work_order', false, 'work_order', 8, '2025-09-10 23:31:24.987605', '2025-09-10 23:31:24.987605', 'notifications.workOrderCreated', 'notifications.workOrderCreatedMessage', '{"number": "63/25"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (484, 7, '', '', 'customer', false, 'customer', 11, '2025-09-11 01:11:04.963861', '2025-09-11 01:11:04.963861', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "Kamer Commerce"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (485, 7, '', '', 'customer', false, 'customer', 12, '2025-09-11 01:18:47.177268', '2025-09-11 01:18:47.177268', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "Kamer Commerce"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (486, 7, '', '', 'customer', false, 'customer', 13, '2025-09-11 01:41:12.496174', '2025-09-11 01:41:12.496174', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "Kamer"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (487, 7, '', '', 'customer', false, 'customer', 14, '2025-09-11 01:41:16.992853', '2025-09-11 01:41:16.992853', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "asdasdasa"}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (488, 7, '', '', 'customer', false, 'customer', 15, '2025-09-11 01:41:20.942292', '2025-09-11 01:41:20.942292', 'notifications.customerDeleted', 'notifications.customerDeletedMessage', '{"name": "ABC"}');


--
-- TOC entry 5734 (class 0 OID 287816)
-- Dependencies: 281
-- Data for Name: quote_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.quote_items (id, quote_id, description, quantity, unit_price, total, "position", created_at) VALUES (1, 1, 'HD 5/15 C Plus', 1.00, 1480.00, 1480.00, 0, '2025-09-10 09:48:24.708659');
INSERT INTO public.quote_items (id, quote_id, description, quantity, unit_price, total, "position", created_at) VALUES (2, 1, 'HD 8/18M Plus ', 1.00, 3300.00, 3300.00, 1, '2025-09-10 09:48:24.712213');


--
-- TOC entry 5732 (class 0 OID 287786)
-- Dependencies: 279
-- Data for Name: quotes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.quotes (id, quote_number, customer_id, customer_name, customer_email, customer_phone, title, description, subtotal, tax_rate, tax_amount, discount_amount, total_amount, status, valid_until, notes, terms_conditions, sent_at, viewed_at, accepted_at, rejected_at, converted_at, created_by, created_at, updated_at) VALUES (1, 1, NULL, 'test', NULL, NULL, 'test', NULL, 0.00, 0.00, 0.00, 0.00, 0.00, 'sent', '2025-10-10', 'test', 'test', '2025-09-10 09:57:18.611957', NULL, NULL, NULL, NULL, 1, '2025-09-10 09:48:24.697415', '2025-09-10 09:57:18.611957');


--
-- TOC entry 5708 (class 0 OID 228952)
-- Dependencies: 253
-- Data for Name: repair_tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (1, 1, 2, 'Mašina se upali i radi 5 minuta, poslije toga trza i ugasi se.', 'converted', 1, '2025-09-06 20:04:15.68312', '2025-09-06 23:14:13.612688', '2025-09-06 23:14:13.612688', 3, NULL, 1, 'Mašina se upali i radi 5 minuta, poslije toga trza i ugasi se.', 'Pogledati pumpu i ostalo.', 'Crijevo, pištolj, mlazncie', 'John', '53/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (2, 6, 4, 'Test', 'converted', 1, '2025-09-07 02:28:36.889912', '2025-09-07 03:50:10.852363', '2025-09-07 03:50:10.852363', 4, NULL, 2, 'Test', 'test', 'test', 'test', '55/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (7, 6, 4, 'Test', 'converted', 1, '2025-09-08 10:48:13.931134', '2025-09-08 10:55:10.87366', '2025-09-08 10:55:10.87366', 5, NULL, 3, 'Test', 'Test', 'Test', 'Test', '61/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'high');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (10, 9, 6, 'test', 'converted', 5, '2025-09-09 19:35:24.190293', '2025-09-09 19:39:18.600571', '2025-09-09 19:39:18.600571', 6, NULL, 6, 'test', 'test', 'test', 'test', '66/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'high');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (9, 6, 4, 'test', 'converted', 5, '2025-09-09 09:29:43.68529', '2025-09-10 13:36:27.974262', '2025-09-10 13:36:27.974262', 7, NULL, 5, 'test', 'test', 'tet', 'tet', '65/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (8, 2, 5, 'test', 'converted', 5, '2025-09-08 23:38:09.475399', '2025-09-10 23:31:24.890843', '2025-09-10 23:31:24.890843', 8, NULL, 4, 'test', 'test', 'test', 'test', '63/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'low');


--
-- TOC entry 5705 (class 0 OID 220682)
-- Dependencies: 250
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

INSERT INTO public.schema_migrations (name, executed_at) VALUES ('001_add_work_order_quote.sql', '2025-08-17 23:09:42.242091');
INSERT INTO public.schema_migrations (name, executed_at) VALUES ('002_add_ticket_number.sql', '2025-08-18 01:15:02.86269');
INSERT INTO public.schema_migrations (name, executed_at) VALUES ('003_machines_model_unique.sql', '2025-08-18 01:52:10.595526');
INSERT INTO public.schema_migrations (name, executed_at) VALUES ('20250127_add_warranty_work_order_reference.sql', '2025-08-19 16:20:27.015052');
INSERT INTO public.schema_migrations (name, executed_at) VALUES ('20250127_remove_problem_description.sql', '2025-08-21 16:41:37.043194');
INSERT INTO public.schema_migrations (name, executed_at) VALUES ('20250127_comprehensive_schema_update.sql', '2025-08-21 16:49:53.335496');
INSERT INTO public.schema_migrations (name, executed_at) VALUES ('011_add_notification_translation_support.sql', '2025-08-26 13:54:48.858295');


--
-- TOC entry 5702 (class 0 OID 85215)
-- Dependencies: 247
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: repairadmin
--



--
-- TOC entry 5700 (class 0 OID 85200)
-- Dependencies: 245
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

INSERT INTO public.suppliers (id, name, email, phone, address, category, contact_person, website, payment_terms, status, notes, created_at, updated_at) VALUES (1, 'Bosch Power Tools', 'sales@bosch.com', '+49 711 811-0', 'Robert-Bosch-Platz 1, 70839 Gerlingen, Germany', 'Power Tools', 'Hans Mueller', 'https://www.bosch.com', 'Net 30', 'active', 'Leading manufacturer of power tools and accessories. Premium quality products with excellent warranty coverage.', '2025-09-07 05:58:42.490528', '2025-09-07 05:58:42.490528');
INSERT INTO public.suppliers (id, name, email, phone, address, category, contact_person, website, payment_terms, status, notes, created_at, updated_at) VALUES (2, 'Makita Corporation', 'info@makita.com', '+81 3 3649-5111', '3-11-8 Sumiyoshi-cho, Anjo, Aichi 446-8502, Japan', 'Power Tools', 'Yuki Tanaka', 'https://www.makita.com', 'Net 45', 'active', 'Japanese manufacturer known for reliable cordless tools and professional equipment. Strong dealer network.', '2025-09-07 05:58:42.490528', '2025-09-07 05:58:42.490528');
INSERT INTO public.suppliers (id, name, email, phone, address, category, contact_person, website, payment_terms, status, notes, created_at, updated_at) VALUES (3, 'DeWalt Industrial Tool Co.', 'customer.service@dewalt.com', '+1 800-433-9258', '701 E Joppa Rd, Towson, MD 21286, USA', 'Power Tools', 'Mike Johnson', 'https://www.dewalt.com', 'Net 30', 'active', 'American brand specializing in professional-grade power tools. Popular among contractors and tradespeople.', '2025-09-07 05:58:42.490528', '2025-09-07 05:58:42.490528');
INSERT INTO public.suppliers (id, name, email, phone, address, category, contact_person, website, payment_terms, status, notes, created_at, updated_at) VALUES (4, 'Milwaukee Tool', 'support@milwaukeetool.com', '+1 800-729-3878', '13135 W Lisbon Rd, Brookfield, WI 53005, USA', 'Power Tools', 'Sarah Williams', 'https://www.milwaukeetool.com', 'Net 30', 'active', 'Innovative power tool manufacturer with focus on cordless technology. Strong warranty and service support.', '2025-09-07 05:58:42.490528', '2025-09-07 05:58:42.490528');
INSERT INTO public.suppliers (id, name, email, phone, address, category, contact_person, website, payment_terms, status, notes, created_at, updated_at) VALUES (5, 'Hilti Corporation', 'info@hilti.com', '+41 58 244 22 22', 'Feldkircherstrasse 100, 9494 Schaan, Liechtenstein', 'Construction Tools', 'Andreas Schmidt', 'https://www.hilti.com', 'Net 60', 'active', 'Premium construction and building technology company. Direct sales model with comprehensive service programs.', '2025-09-07 05:58:42.490528', '2025-09-07 05:58:42.490528');


--
-- TOC entry 5676 (class 0 OID 16391)
-- Dependencies: 221
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (7, 'John Sales', 'john.sales@repairshop.com', 'sales', '2025-09-03 00:07:41.994549', '$2b$10$1Yg0N6pst/rt4PKsoYuVxeV9VYBznafzOYiPJeXaslZCgwsZ6hL4m', true, NULL, '2025-09-10 23:48:40.989761', '+1-555-0980', 'Sales', 'active', '2025-09-10 23:43:53.527925', '2025-09-10 23:47:39.01832+02', '2025-09-10 23:48:40.989761');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (1, 'Admin User', 'admin@repairshop.com', 'admin', '2025-08-25 11:29:45.90184', 'admin', true, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzU3NTQ4OTk5LCJleHAiOjE3NTgxNTM3OTl9.zxflBKBCfYUnsKS9ASScRiq_2-37N1eVeTpOxzHYsqI', '2025-09-11 02:03:19.33807', '+1234567890', 'Management', 'active', '2025-09-11 02:03:19.262328', '2025-09-11 02:03:19.33807+02', '2025-09-10 23:51:51.533342');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (5, 'Tech Mike', 'mike@repairshop.com', 'technician', '2025-08-25 11:29:45.90184', 'admin', true, NULL, '2025-09-11 00:22:35.305323', '+1234567894', 'Repair', 'active', '2025-09-11 00:22:02.084031', '2025-09-11 00:22:35.305323+02', '2025-09-11 00:22:08.097226');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (8, 'Sarah Martinez', 'sarah.martinez@repairshop.com', 'sales', '2025-09-03 00:07:42.095034', '$2b$10$toSmBmq6Xqsa5qLERz7gt.7vI12cVakQo9oQjGk9pQqvNgKxEGZ42', true, NULL, '2025-09-10 23:50:43.07144', '+1-555-0907', 'Sales', 'active', '2025-09-10 23:49:53.511473', '2025-09-10 23:50:42.14691+02', '2025-09-10 23:50:43.07144');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (2, 'Manager User', 'manager@repairshop.com', 'manager', '2025-08-25 11:29:45.90184', 'admin', true, NULL, '2025-09-10 23:48:40.981373', '+1234567891', 'Management', 'active', '2025-09-10 23:48:14.76023', '2025-09-10 23:48:22.551429+02', '2025-09-10 23:48:40.981373');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (9, 'Test User', 'test@repairshop.com', 'admin', '2025-09-05 03:32:18.412765', 'test123', true, NULL, '2025-09-10 23:48:40.981677', NULL, 'IT', 'active', '2025-09-10 23:43:14.986735', '2025-09-10 23:47:39.032514+02', '2025-09-10 23:48:40.981677');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (3, 'Tech John', 'john@repairshop.com', 'technician', '2025-08-25 11:29:45.90184', 'admin', true, NULL, '2025-09-10 23:48:40.987831', '+1234567892', 'Repair', 'active', '2025-09-10 23:44:15.652073', '2025-09-10 23:47:39.004561+02', '2025-09-10 23:48:40.987831');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (6, 'Sales Representative', 'sales@repairshop.com', 'sales', '2025-09-03 00:07:41.887862', '$2b$10$zO7CTDHLlZwzXIJMejwTHeS4OyZ69GGB8P67/pz/fns5r7fylrgi2', true, NULL, '2025-09-10 23:50:43.071592', '+1-555-0123', 'Sales', 'active', '2025-09-10 23:50:14.222736', '2025-09-10 23:50:42.452249+02', '2025-09-10 23:50:43.071592');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (4, 'Tech Sarah', 'sarah@repairshop.com', 'technician', '2025-08-25 11:29:45.90184', 'admin', true, NULL, '2025-09-10 23:50:30.67253', '+1234567893', 'Repair', 'active', '2025-09-10 23:50:28.046732', '2025-09-10 23:50:28.137771+02', '2025-09-10 23:50:30.67253');


--
-- TOC entry 5718 (class 0 OID 246195)
-- Dependencies: 263
-- Data for Name: warranty_periods; Type: TABLE DATA; Schema: public; Owner: repairadmin
--



--
-- TOC entry 5720 (class 0 OID 246209)
-- Dependencies: 265
-- Data for Name: warranty_repair_tickets; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

INSERT INTO public.warranty_repair_tickets (id, ticket_number, customer_id, machine_id, problem_description, notes, additional_equipment, brought_by, submitted_by, status, converted_to_warranty_work_order_id, created_at, updated_at, formatted_number, year_created, converted_at, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (1, 1, 3, 1, 'Test garancijske prijemnice', 'Čovjek je pegla, treba pripaziti.', 'Sve što dolazi uz mašinu.', 'Ahmed', 1, 'converted', 4, '2025-09-07 00:31:03.44918', '2025-09-07 23:57:28.049317', '54/25', 2025, '2025-09-07 23:57:28.049317', false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.warranty_repair_tickets (id, ticket_number, customer_id, machine_id, problem_description, notes, additional_equipment, brought_by, submitted_by, status, converted_to_warranty_work_order_id, created_at, updated_at, formatted_number, year_created, converted_at, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (3, 2, 6, 4, 'Test', 'test', 'test', 'test', 1, 'converted', 5, '2025-09-08 10:54:41.929805', '2025-09-08 10:54:51.011299', '62/25', 2025, '2025-09-08 10:54:51.011299', false, NULL, 0.00, NULL, 'unknown', 'low');
INSERT INTO public.warranty_repair_tickets (id, ticket_number, customer_id, machine_id, problem_description, notes, additional_equipment, brought_by, submitted_by, status, converted_to_warranty_work_order_id, created_at, updated_at, formatted_number, year_created, converted_at, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (4, 3, 2, 5, 'test', 'test', 'test', 'test', 5, 'intake', NULL, '2025-09-09 09:28:58.755026', '2025-09-09 09:28:58.755026', '64/25', 2025, NULL, false, NULL, 0.00, NULL, 'unknown', 'medium');


--
-- TOC entry 5712 (class 0 OID 229033)
-- Dependencies: 257
-- Data for Name: warranty_work_order_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5714 (class 0 OID 229053)
-- Dependencies: 259
-- Data for Name: warranty_work_order_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 5710 (class 0 OID 228996)
-- Dependencies: 255
-- Data for Name: warranty_work_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.warranty_work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, labor_hours, labor_rate, troubleshooting_fee, quote_subtotal_parts, quote_total, converted_from_ticket_id, ticket_number, owner_technician_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, customer_satisfaction_score, upsell_opportunity, recommended_products) VALUES (4, 1, 3, 'Test garancijske prijemnice', 'pending', '2025-09-07 23:57:28.049317', '2025-09-07 23:57:28.049317', 5, 'medium', NULL, NULL, NULL, NULL, NULL, 50.00, 0.00, 0.00, 0.00, 1, 1, 5, '54/25', 2025, false, NULL, NULL, NULL, NULL, false, NULL);
INSERT INTO public.warranty_work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, labor_hours, labor_rate, troubleshooting_fee, quote_subtotal_parts, quote_total, converted_from_ticket_id, ticket_number, owner_technician_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, customer_satisfaction_score, upsell_opportunity, recommended_products) VALUES (5, 4, 6, 'Test', 'testing', '2025-09-08 10:54:51.011299', '2025-09-09 11:57:22.974912', 5, 'low', NULL, NULL, NULL, NULL, NULL, 50.00, 0.00, 0.00, 0.00, 3, 2, 5, '62/25', 2025, false, NULL, NULL, NULL, NULL, false, NULL);


--
-- TOC entry 5690 (class 0 OID 43871)
-- Dependencies: 235
-- Data for Name: work_order_attachments; Type: TABLE DATA; Schema: public; Owner: repairadmin
--



--
-- TOC entry 5686 (class 0 OID 16471)
-- Dependencies: 231
-- Data for Name: work_order_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.work_order_inventory (id, work_order_id, inventory_id, quantity, created_at, updated_at) VALUES (1, 4, 1, 1, '2025-09-07 23:17:10.400853', '2025-09-07 23:17:10.400853');
INSERT INTO public.work_order_inventory (id, work_order_id, inventory_id, quantity, created_at, updated_at) VALUES (2, 6, 1, 5, '2025-09-09 19:40:17.435234', '2025-09-09 19:40:17.435234');
INSERT INTO public.work_order_inventory (id, work_order_id, inventory_id, quantity, created_at, updated_at) VALUES (3, 5, 2, 4, '2025-09-10 11:36:23.862969', '2025-09-10 11:36:23.862969');


--
-- TOC entry 5688 (class 0 OID 24764)
-- Dependencies: 233
-- Data for Name: work_order_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.work_order_notes (id, work_order_id, content, created_at, updated_at) VALUES (3, 3, 'radil', '2025-09-07 03:12:00.950279', '2025-09-07 03:12:00.950279');
INSERT INTO public.work_order_notes (id, work_order_id, content, created_at, updated_at) VALUES (4, 4, 'Test', '2025-09-07 23:17:04.595423', '2025-09-07 23:17:04.595423');
INSERT INTO public.work_order_notes (id, work_order_id, content, created_at, updated_at) VALUES (5, 6, 'test', '2025-09-09 19:40:08.847929', '2025-09-09 19:40:08.847929');


--
-- TOC entry 5694 (class 0 OID 43915)
-- Dependencies: 239
-- Data for Name: work_order_templates; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

INSERT INTO public.work_order_templates (id, name, description, category, estimated_hours, required_parts, steps, created_at, updated_at) VALUES (1, 'CNC Machine Maintenance', 'Standard maintenance procedure for CNC machines', 'Maintenance', 4.50, '{"Oil Filter",Lubricant,"Cleaning Supplies"}', '{"Shut down machine safely","Clean all surfaces","Check oil levels","Replace oil filter","Lubricate moving parts","Test machine operation"}', '2025-08-16 00:03:00.226764', '2025-08-16 00:03:00.226764');
INSERT INTO public.work_order_templates (id, name, description, category, estimated_hours, required_parts, steps, created_at, updated_at) VALUES (2, 'Motor Replacement', 'Procedure for replacing electric motors', 'Repair', 6.00, '{"New Motor","Mounting Brackets","Electrical Connectors"}', '{"Disconnect power supply","Remove old motor","Install new motor","Connect electrical wiring","Test motor operation","Update documentation"}', '2025-08-16 00:03:00.226764', '2025-08-16 00:03:00.226764');
INSERT INTO public.work_order_templates (id, name, description, category, estimated_hours, required_parts, steps, created_at, updated_at) VALUES (3, 'Bearing Replacement', 'Standard bearing replacement procedure', 'Repair', 2.50, '{"New Bearings",Grease,Seals}', '{"Remove bearing housing","Extract old bearing","Clean bearing seat","Install new bearing","Apply grease","Reassemble housing"}', '2025-08-16 00:03:00.226764', '2025-08-16 00:03:00.226764');


--
-- TOC entry 5692 (class 0 OID 43893)
-- Dependencies: 237
-- Data for Name: work_order_time_entries; Type: TABLE DATA; Schema: public; Owner: repairadmin
--



--
-- TOC entry 5682 (class 0 OID 16433)
-- Dependencies: 227
-- Data for Name: work_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (3, 2, 1, 'Mašina se upali i radi 5 minuta, poslije toga trza i ugasi se.', 'completed', '2025-09-06 23:14:13.612688', '2025-09-07 03:50:25.405678', 5, 'medium', NULL, '2025-09-07 03:25:56.075336', '2025-09-07 03:50:25.405678', NULL, 0.00, false, NULL, 50.00, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, 5, 1, '53/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (4, 4, 6, 'Test', 'completed', '2025-09-07 03:50:10.852363', '2025-09-07 23:52:41.512649', 5, 'medium', NULL, '2025-09-07 03:50:44.594427', '2025-09-07 23:32:04.304222', NULL, 225.00, false, 2.00, 50.00, NULL, NULL, NULL, NULL, 100.00, NULL, 2, 2, 5, 1, '55/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (6, 6, 9, 'test', 'in_progress', '2025-09-09 19:39:18.600571', '2025-09-09 19:41:26.954439', 5, 'high', NULL, '2025-09-09 19:41:26.954439', NULL, NULL, 275.00, false, 1.00, 50.00, NULL, NULL, NULL, NULL, 100.00, NULL, 6, 10, 5, 5, '66/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (5, 4, 6, 'Test', 'in_progress', '2025-09-08 10:55:10.87366', '2025-09-10 11:36:23.958317', 5, 'high', NULL, '2025-09-10 11:35:43.657705', NULL, NULL, 237.50, false, 2.75, 50.00, NULL, NULL, NULL, NULL, 100.00, NULL, 3, 7, 5, 1, '61/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (7, 4, 6, 'test', 'pending', '2025-09-10 13:36:27.974262', '2025-09-10 13:36:27.974262', 5, 'medium', NULL, NULL, NULL, NULL, 0.00, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5, 9, 5, 5, '65/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (8, 5, 2, 'test', 'pending', '2025-09-10 23:31:24.890843', '2025-09-10 23:31:24.890843', 5, 'low', NULL, NULL, NULL, NULL, 0.00, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4, 8, 5, 5, '63/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');


--
-- TOC entry 5722 (class 0 OID 253746)
-- Dependencies: 267
-- Data for Name: yearly_sequences; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.yearly_sequences (id, year, current_sequence, created_at, updated_at) VALUES (11, 2025, 66, '2025-08-27 22:42:38.30171', '2025-09-09 19:35:24.190293');


--
-- TOC entry 5794 (class 0 OID 0)
-- Dependencies: 272
-- Name: assigned_machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.assigned_machines_id_seq', 6, true);


--
-- TOC entry 5795 (class 0 OID 0)
-- Dependencies: 240
-- Name: customer_communications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.customer_communications_id_seq', 1, false);


--
-- TOC entry 5796 (class 0 OID 0)
-- Dependencies: 242
-- Name: customer_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.customer_preferences_id_seq', 1, false);


--
-- TOC entry 5797 (class 0 OID 0)
-- Dependencies: 222
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 16, true);


--
-- TOC entry 5798 (class 0 OID 0)
-- Dependencies: 289
-- Name: inventory_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_categories_id_seq', 18, true);


--
-- TOC entry 5799 (class 0 OID 0)
-- Dependencies: 228
-- Name: inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_id_seq', 2, true);


--
-- TOC entry 5800 (class 0 OID 0)
-- Dependencies: 284
-- Name: lead_follow_ups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lead_follow_ups_id_seq', 5, true);


--
-- TOC entry 5801 (class 0 OID 0)
-- Dependencies: 282
-- Name: leads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leads_id_seq', 3, true);


--
-- TOC entry 5802 (class 0 OID 0)
-- Dependencies: 260
-- Name: machine_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.machine_categories_id_seq', 10, true);


--
-- TOC entry 5803 (class 0 OID 0)
-- Dependencies: 268
-- Name: machine_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machine_models_id_seq', 6, true);


--
-- TOC entry 5804 (class 0 OID 0)
-- Dependencies: 275
-- Name: machine_rentals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machine_rentals_id_seq', 1, false);


--
-- TOC entry 5805 (class 0 OID 0)
-- Dependencies: 270
-- Name: machine_serials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machine_serials_id_seq', 11, true);


--
-- TOC entry 5806 (class 0 OID 0)
-- Dependencies: 224
-- Name: machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machines_id_seq', 1, false);


--
-- TOC entry 5807 (class 0 OID 0)
-- Dependencies: 248
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.notifications_id_seq', 488, true);


--
-- TOC entry 5808 (class 0 OID 0)
-- Dependencies: 280
-- Name: quote_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quote_items_id_seq', 2, true);


--
-- TOC entry 5809 (class 0 OID 0)
-- Dependencies: 278
-- Name: quotes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quotes_id_seq', 1, true);


--
-- TOC entry 5810 (class 0 OID 0)
-- Dependencies: 252
-- Name: repair_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repair_tickets_id_seq', 10, true);


--
-- TOC entry 5811 (class 0 OID 0)
-- Dependencies: 246
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 1, false);


--
-- TOC entry 5812 (class 0 OID 0)
-- Dependencies: 244
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 5, true);


--
-- TOC entry 5813 (class 0 OID 0)
-- Dependencies: 251
-- Name: ticket_number_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.ticket_number_seq', 1009, true);


--
-- TOC entry 5814 (class 0 OID 0)
-- Dependencies: 220
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 9, true);


--
-- TOC entry 5815 (class 0 OID 0)
-- Dependencies: 262
-- Name: warranty_periods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.warranty_periods_id_seq', 1, false);


--
-- TOC entry 5816 (class 0 OID 0)
-- Dependencies: 264
-- Name: warranty_repair_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.warranty_repair_tickets_id_seq', 4, true);


--
-- TOC entry 5817 (class 0 OID 0)
-- Dependencies: 256
-- Name: warranty_work_order_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warranty_work_order_inventory_id_seq', 1, false);


--
-- TOC entry 5818 (class 0 OID 0)
-- Dependencies: 258
-- Name: warranty_work_order_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warranty_work_order_notes_id_seq', 3, true);


--
-- TOC entry 5819 (class 0 OID 0)
-- Dependencies: 254
-- Name: warranty_work_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warranty_work_orders_id_seq', 5, true);


--
-- TOC entry 5820 (class 0 OID 0)
-- Dependencies: 234
-- Name: work_order_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.work_order_attachments_id_seq', 1, false);


--
-- TOC entry 5821 (class 0 OID 0)
-- Dependencies: 230
-- Name: work_order_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_order_inventory_id_seq', 3, true);


--
-- TOC entry 5822 (class 0 OID 0)
-- Dependencies: 232
-- Name: work_order_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_order_notes_id_seq', 5, true);


--
-- TOC entry 5823 (class 0 OID 0)
-- Dependencies: 238
-- Name: work_order_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.work_order_templates_id_seq', 3, true);


--
-- TOC entry 5824 (class 0 OID 0)
-- Dependencies: 236
-- Name: work_order_time_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.work_order_time_entries_id_seq', 1, false);


--
-- TOC entry 5825 (class 0 OID 0)
-- Dependencies: 226
-- Name: work_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_orders_id_seq', 8, true);


--
-- TOC entry 5826 (class 0 OID 0)
-- Dependencies: 266
-- Name: yearly_sequences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.yearly_sequences_id_seq', 11, true);


--
-- TOC entry 5385 (class 2606 OID 262402)
-- Name: assigned_machines assigned_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigned_machines
    ADD CONSTRAINT assigned_machines_pkey PRIMARY KEY (id);


--
-- TOC entry 5266 (class 2606 OID 62800)
-- Name: customer_communications customer_communications_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_communications
    ADD CONSTRAINT customer_communications_pkey PRIMARY KEY (id);


--
-- TOC entry 5268 (class 2606 OID 72172)
-- Name: customer_preferences customer_preferences_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_preferences
    ADD CONSTRAINT customer_preferences_customer_id_key UNIQUE (customer_id);


--
-- TOC entry 5270 (class 2606 OID 72170)
-- Name: customer_preferences customer_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_preferences
    ADD CONSTRAINT customer_preferences_pkey PRIMARY KEY (id);


--
-- TOC entry 5202 (class 2606 OID 16414)
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- TOC entry 5204 (class 2606 OID 16412)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 5252 (class 2606 OID 85240)
-- Name: inventory inventory_barcode_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_barcode_key UNIQUE (barcode);


--
-- TOC entry 5426 (class 2606 OID 289262)
-- Name: inventory_categories inventory_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_name_key UNIQUE (name);


--
-- TOC entry 5428 (class 2606 OID 289260)
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 5254 (class 2606 OID 16464)
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 5423 (class 2606 OID 287879)
-- Name: lead_follow_ups lead_follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_pkey PRIMARY KEY (id);


--
-- TOC entry 5419 (class 2606 OID 287859)
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- TOC entry 5332 (class 2606 OID 246193)
-- Name: machine_categories machine_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.machine_categories
    ADD CONSTRAINT machine_categories_name_key UNIQUE (name);


--
-- TOC entry 5334 (class 2606 OID 246191)
-- Name: machine_categories machine_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.machine_categories
    ADD CONSTRAINT machine_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 5374 (class 2606 OID 262368)
-- Name: machine_models machine_models_name_catalogue_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_models
    ADD CONSTRAINT machine_models_name_catalogue_number_key UNIQUE (name, catalogue_number);


--
-- TOC entry 5376 (class 2606 OID 262366)
-- Name: machine_models machine_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_models
    ADD CONSTRAINT machine_models_pkey PRIMARY KEY (id);


--
-- TOC entry 5397 (class 2606 OID 286261)
-- Name: machine_rentals machine_rentals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals
    ADD CONSTRAINT machine_rentals_pkey PRIMARY KEY (id);


--
-- TOC entry 5381 (class 2606 OID 262383)
-- Name: machine_serials machine_serials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_serials
    ADD CONSTRAINT machine_serials_pkey PRIMARY KEY (id);


--
-- TOC entry 5383 (class 2606 OID 262385)
-- Name: machine_serials machine_serials_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_serials
    ADD CONSTRAINT machine_serials_serial_number_key UNIQUE (serial_number);


--
-- TOC entry 5218 (class 2606 OID 16424)
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- TOC entry 5220 (class 2606 OID 16426)
-- Name: machines machines_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_serial_number_key UNIQUE (serial_number);


--
-- TOC entry 5284 (class 2606 OID 169427)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 5409 (class 2606 OID 287828)
-- Name: quote_items quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5404 (class 2606 OID 287802)
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- TOC entry 5406 (class 2606 OID 287804)
-- Name: quotes quotes_quote_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_quote_number_key UNIQUE (quote_number);


--
-- TOC entry 5306 (class 2606 OID 228964)
-- Name: repair_tickets repair_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_pkey PRIMARY KEY (id);


--
-- TOC entry 5308 (class 2606 OID 246249)
-- Name: repair_tickets repair_tickets_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_ticket_number_key UNIQUE (ticket_number);


--
-- TOC entry 5286 (class 2606 OID 220689)
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- TOC entry 5276 (class 2606 OID 85223)
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- TOC entry 5272 (class 2606 OID 85213)
-- Name: suppliers suppliers_name_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_name_key UNIQUE (name);


--
-- TOC entry 5274 (class 2606 OID 85211)
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- TOC entry 5223 (class 2606 OID 220609)
-- Name: machines unique_serial; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT unique_serial UNIQUE (serial_number);


--
-- TOC entry 5198 (class 2606 OID 16402)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5200 (class 2606 OID 16400)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5336 (class 2606 OID 246207)
-- Name: warranty_periods warranty_periods_manufacturer_model_name_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_periods
    ADD CONSTRAINT warranty_periods_manufacturer_model_name_key UNIQUE (manufacturer, model_name);


--
-- TOC entry 5338 (class 2606 OID 246205)
-- Name: warranty_periods warranty_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_periods
    ADD CONSTRAINT warranty_periods_pkey PRIMARY KEY (id);


--
-- TOC entry 5357 (class 2606 OID 246220)
-- Name: warranty_repair_tickets warranty_repair_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_pkey PRIMARY KEY (id);


--
-- TOC entry 5359 (class 2606 OID 246222)
-- Name: warranty_repair_tickets warranty_repair_tickets_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_ticket_number_key UNIQUE (ticket_number);


--
-- TOC entry 5327 (class 2606 OID 229041)
-- Name: warranty_work_order_inventory warranty_work_order_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_inventory
    ADD CONSTRAINT warranty_work_order_inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 5329 (class 2606 OID 229062)
-- Name: warranty_work_order_notes warranty_work_order_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_notes
    ADD CONSTRAINT warranty_work_order_notes_pkey PRIMARY KEY (id);


--
-- TOC entry 5325 (class 2606 OID 229011)
-- Name: warranty_work_orders warranty_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_pkey PRIMARY KEY (id);


--
-- TOC entry 5260 (class 2606 OID 43881)
-- Name: work_order_attachments work_order_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_attachments
    ADD CONSTRAINT work_order_attachments_pkey PRIMARY KEY (id);


--
-- TOC entry 5256 (class 2606 OID 16478)
-- Name: work_order_inventory work_order_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_inventory
    ADD CONSTRAINT work_order_inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 5258 (class 2606 OID 24772)
-- Name: work_order_notes work_order_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_notes
    ADD CONSTRAINT work_order_notes_pkey PRIMARY KEY (id);


--
-- TOC entry 5264 (class 2606 OID 43926)
-- Name: work_order_templates work_order_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_templates
    ADD CONSTRAINT work_order_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5262 (class 2606 OID 43903)
-- Name: work_order_time_entries work_order_time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_time_entries
    ADD CONSTRAINT work_order_time_entries_pkey PRIMARY KEY (id);


--
-- TOC entry 5238 (class 2606 OID 16443)
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- TOC entry 5240 (class 2606 OID 220692)
-- Name: work_orders work_orders_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_ticket_number_key UNIQUE (ticket_number);


--
-- TOC entry 5362 (class 2606 OID 253754)
-- Name: yearly_sequences yearly_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_sequences
    ADD CONSTRAINT yearly_sequences_pkey PRIMARY KEY (id);


--
-- TOC entry 5364 (class 2606 OID 253756)
-- Name: yearly_sequences yearly_sequences_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_sequences
    ADD CONSTRAINT yearly_sequences_year_key UNIQUE (year);


--
-- TOC entry 5386 (class 1259 OID 286245)
-- Name: idx_assigned_machines_added_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_added_by ON public.assigned_machines USING btree (added_by_user_id);


--
-- TOC entry 5387 (class 1259 OID 286246)
-- Name: idx_assigned_machines_condition; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_condition ON public.assigned_machines USING btree (machine_condition);


--
-- TOC entry 5388 (class 1259 OID 262418)
-- Name: idx_assigned_machines_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_customer_id ON public.assigned_machines USING btree (customer_id);


--
-- TOC entry 5389 (class 1259 OID 289484)
-- Name: idx_assigned_machines_customer_serial; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_customer_serial ON public.assigned_machines USING btree (customer_id, serial_id);


--
-- TOC entry 5390 (class 1259 OID 262419)
-- Name: idx_assigned_machines_serial_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_serial_id ON public.assigned_machines USING btree (serial_id);


--
-- TOC entry 5391 (class 1259 OID 289485)
-- Name: idx_assigned_machines_serial_model; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_serial_model ON public.assigned_machines USING btree (serial_id, customer_id);


--
-- TOC entry 5392 (class 1259 OID 286244)
-- Name: idx_assigned_machines_sold_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_sold_by ON public.assigned_machines USING btree (sold_by_user_id);


--
-- TOC entry 5205 (class 1259 OID 289462)
-- Name: idx_customers_city_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_city_text ON public.customers USING gin (city public.gin_trgm_ops);


--
-- TOC entry 5206 (class 1259 OID 289439)
-- Name: idx_customers_company_name_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_company_name_text ON public.customers USING gin (company_name public.gin_trgm_ops);


--
-- TOC entry 5207 (class 1259 OID 289501)
-- Name: idx_customers_contact_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_contact_person ON public.customers USING btree (contact_person);


--
-- TOC entry 5208 (class 1259 OID 289472)
-- Name: idx_customers_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_created_at_status ON public.customers USING btree (created_at DESC, status);


--
-- TOC entry 5209 (class 1259 OID 289500)
-- Name: idx_customers_customer_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_customer_type ON public.customers USING btree (customer_type);


--
-- TOC entry 5210 (class 1259 OID 289438)
-- Name: idx_customers_email_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_email_text ON public.customers USING gin (email public.gin_trgm_ops);


--
-- TOC entry 5211 (class 1259 OID 289437)
-- Name: idx_customers_name_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_name_text ON public.customers USING gin (name public.gin_trgm_ops);


--
-- TOC entry 5212 (class 1259 OID 286230)
-- Name: idx_customers_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_owner_id ON public.customers USING btree (owner_id);


--
-- TOC entry 5213 (class 1259 OID 289461)
-- Name: idx_customers_phone_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_phone_text ON public.customers USING gin (phone public.gin_trgm_ops);


--
-- TOC entry 5214 (class 1259 OID 289243)
-- Name: idx_customers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_status ON public.customers USING btree (status);


--
-- TOC entry 5215 (class 1259 OID 289447)
-- Name: idx_customers_status_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_status_owner ON public.customers USING btree (status, owner_id);


--
-- TOC entry 5216 (class 1259 OID 289463)
-- Name: idx_customers_vat_number_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_vat_number_text ON public.customers USING gin (vat_number public.gin_trgm_ops);


--
-- TOC entry 5424 (class 1259 OID 289264)
-- Name: idx_inventory_categories_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_categories_name ON public.inventory_categories USING btree (name);


--
-- TOC entry 5241 (class 1259 OID 253729)
-- Name: idx_inventory_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_category ON public.inventory USING btree (category);


--
-- TOC entry 5242 (class 1259 OID 289456)
-- Name: idx_inventory_category_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_category_supplier ON public.inventory USING btree (category, supplier);


--
-- TOC entry 5243 (class 1259 OID 289441)
-- Name: idx_inventory_description_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_description_text ON public.inventory USING gin (description public.gin_trgm_ops);


--
-- TOC entry 5244 (class 1259 OID 289440)
-- Name: idx_inventory_name_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_name_text ON public.inventory USING gin (name public.gin_trgm_ops);


--
-- TOC entry 5245 (class 1259 OID 289482)
-- Name: idx_inventory_quantity_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_quantity_category ON public.inventory USING btree (quantity, category);


--
-- TOC entry 5246 (class 1259 OID 253727)
-- Name: idx_inventory_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_sku ON public.inventory USING btree (sku);


--
-- TOC entry 5247 (class 1259 OID 289442)
-- Name: idx_inventory_sku_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_sku_text ON public.inventory USING gin (sku public.gin_trgm_ops);


--
-- TOC entry 5248 (class 1259 OID 253728)
-- Name: idx_inventory_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_supplier ON public.inventory USING btree (supplier);


--
-- TOC entry 5249 (class 1259 OID 289464)
-- Name: idx_inventory_supplier_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_supplier_text ON public.inventory USING gin (supplier public.gin_trgm_ops);


--
-- TOC entry 5250 (class 1259 OID 289481)
-- Name: idx_inventory_updated_at_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_updated_at_category ON public.inventory USING btree (updated_at DESC, category);


--
-- TOC entry 5420 (class 1259 OID 287896)
-- Name: idx_lead_follow_ups_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_follow_ups_created_at ON public.lead_follow_ups USING btree (created_at);


--
-- TOC entry 5421 (class 1259 OID 287895)
-- Name: idx_lead_follow_ups_lead_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_follow_ups_lead_id ON public.lead_follow_ups USING btree (lead_id);


--
-- TOC entry 5410 (class 1259 OID 287892)
-- Name: idx_leads_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_assigned_to ON public.leads USING btree (assigned_to);


--
-- TOC entry 5411 (class 1259 OID 287893)
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at);


--
-- TOC entry 5412 (class 1259 OID 289492)
-- Name: idx_leads_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_created_by ON public.leads USING btree (created_by);


--
-- TOC entry 5413 (class 1259 OID 287908)
-- Name: idx_leads_lead_quality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_lead_quality ON public.leads USING btree (lead_quality);


--
-- TOC entry 5414 (class 1259 OID 287894)
-- Name: idx_leads_next_follow_up; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_next_follow_up ON public.leads USING btree (next_follow_up);


--
-- TOC entry 5415 (class 1259 OID 287890)
-- Name: idx_leads_quality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_quality ON public.leads USING btree (lead_quality);


--
-- TOC entry 5416 (class 1259 OID 287907)
-- Name: idx_leads_sales_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_sales_stage ON public.leads USING btree (sales_stage);


--
-- TOC entry 5417 (class 1259 OID 287891)
-- Name: idx_leads_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_stage ON public.leads USING btree (sales_stage);


--
-- TOC entry 5330 (class 1259 OID 289460)
-- Name: idx_machine_categories_name; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_machine_categories_name ON public.machine_categories USING btree (name);


--
-- TOC entry 5365 (class 1259 OID 262415)
-- Name: idx_machine_models_catalogue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_catalogue ON public.machine_models USING btree (catalogue_number);


--
-- TOC entry 5366 (class 1259 OID 289465)
-- Name: idx_machine_models_catalogue_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_catalogue_text ON public.machine_models USING gin (catalogue_number public.gin_trgm_ops);


--
-- TOC entry 5367 (class 1259 OID 289457)
-- Name: idx_machine_models_category_manufacturer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_category_manufacturer ON public.machine_models USING btree (category_id, manufacturer);


--
-- TOC entry 5368 (class 1259 OID 262414)
-- Name: idx_machine_models_manufacturer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_manufacturer ON public.machine_models USING btree (manufacturer);


--
-- TOC entry 5369 (class 1259 OID 289483)
-- Name: idx_machine_models_manufacturer_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_manufacturer_name ON public.machine_models USING btree (manufacturer, name);


--
-- TOC entry 5370 (class 1259 OID 289444)
-- Name: idx_machine_models_manufacturer_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_manufacturer_text ON public.machine_models USING gin (manufacturer public.gin_trgm_ops);


--
-- TOC entry 5371 (class 1259 OID 262413)
-- Name: idx_machine_models_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_name ON public.machine_models USING btree (name);


--
-- TOC entry 5372 (class 1259 OID 289443)
-- Name: idx_machine_models_name_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_name_text ON public.machine_models USING gin (name public.gin_trgm_ops);


--
-- TOC entry 5393 (class 1259 OID 286277)
-- Name: idx_machine_rentals_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_rentals_customer ON public.machine_rentals USING btree (customer_id);


--
-- TOC entry 5394 (class 1259 OID 286279)
-- Name: idx_machine_rentals_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_rentals_dates ON public.machine_rentals USING btree (rental_start_date, rental_end_date);


--
-- TOC entry 5395 (class 1259 OID 286278)
-- Name: idx_machine_rentals_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_rentals_status ON public.machine_rentals USING btree (rental_status);


--
-- TOC entry 5377 (class 1259 OID 262416)
-- Name: idx_machine_serials_model_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_serials_model_id ON public.machine_serials USING btree (model_id);


--
-- TOC entry 5378 (class 1259 OID 289486)
-- Name: idx_machine_serials_model_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_serials_model_status ON public.machine_serials USING btree (model_id, status);


--
-- TOC entry 5379 (class 1259 OID 262417)
-- Name: idx_machine_serials_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_serials_status ON public.machine_serials USING btree (status);


--
-- TOC entry 5277 (class 1259 OID 228950)
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);


--
-- TOC entry 5278 (class 1259 OID 228948)
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- TOC entry 5279 (class 1259 OID 262271)
-- Name: idx_notifications_message_key; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_message_key ON public.notifications USING btree (message_key);


--
-- TOC entry 5280 (class 1259 OID 262270)
-- Name: idx_notifications_title_key; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_title_key ON public.notifications USING btree (title_key);


--
-- TOC entry 5281 (class 1259 OID 228949)
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);


--
-- TOC entry 5282 (class 1259 OID 228947)
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- TOC entry 5407 (class 1259 OID 287839)
-- Name: idx_quote_items_quote_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_items_quote_id ON public.quote_items USING btree (quote_id);


--
-- TOC entry 5398 (class 1259 OID 287838)
-- Name: idx_quotes_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_created_at ON public.quotes USING btree (created_at);


--
-- TOC entry 5399 (class 1259 OID 287836)
-- Name: idx_quotes_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_created_by ON public.quotes USING btree (created_by);


--
-- TOC entry 5400 (class 1259 OID 287834)
-- Name: idx_quotes_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_customer_id ON public.quotes USING btree (customer_id);


--
-- TOC entry 5401 (class 1259 OID 287835)
-- Name: idx_quotes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_status ON public.quotes USING btree (status);


--
-- TOC entry 5402 (class 1259 OID 287837)
-- Name: idx_quotes_valid_until; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_valid_until ON public.quotes USING btree (valid_until);


--
-- TOC entry 5287 (class 1259 OID 289467)
-- Name: idx_repair_tickets_additional_equipment_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_additional_equipment_text ON public.repair_tickets USING gin (additional_equipment public.gin_trgm_ops);


--
-- TOC entry 5288 (class 1259 OID 289468)
-- Name: idx_repair_tickets_brought_by_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_brought_by_text ON public.repair_tickets USING gin (brought_by public.gin_trgm_ops);


--
-- TOC entry 5289 (class 1259 OID 229083)
-- Name: idx_repair_tickets_converted_to_warranty_work_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_converted_to_warranty_work_order_id ON public.repair_tickets USING btree (converted_to_warranty_work_order_id);


--
-- TOC entry 5290 (class 1259 OID 289449)
-- Name: idx_repair_tickets_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_created_at_status ON public.repair_tickets USING btree (created_at DESC, status);


--
-- TOC entry 5291 (class 1259 OID 228994)
-- Name: idx_repair_tickets_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_created_by ON public.repair_tickets USING btree (submitted_by);


--
-- TOC entry 5292 (class 1259 OID 228992)
-- Name: idx_repair_tickets_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_customer_id ON public.repair_tickets USING btree (customer_id);


--
-- TOC entry 5293 (class 1259 OID 289473)
-- Name: idx_repair_tickets_customer_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_customer_status ON public.repair_tickets USING btree (customer_id, status);


--
-- TOC entry 5294 (class 1259 OID 253765)
-- Name: idx_repair_tickets_formatted_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_formatted_number ON public.repair_tickets USING btree (formatted_number);


--
-- TOC entry 5295 (class 1259 OID 228993)
-- Name: idx_repair_tickets_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_machine_id ON public.repair_tickets USING btree (machine_id);


--
-- TOC entry 5296 (class 1259 OID 289466)
-- Name: idx_repair_tickets_notes_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_notes_text ON public.repair_tickets USING gin (notes public.gin_trgm_ops);


--
-- TOC entry 5297 (class 1259 OID 289237)
-- Name: idx_repair_tickets_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_priority ON public.repair_tickets USING btree (priority);


--
-- TOC entry 5298 (class 1259 OID 289445)
-- Name: idx_repair_tickets_problem_description_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_problem_description_text ON public.repair_tickets USING gin (problem_description public.gin_trgm_ops);


--
-- TOC entry 5299 (class 1259 OID 286351)
-- Name: idx_repair_tickets_sales_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_sales_user_id ON public.repair_tickets USING btree (sales_user_id);


--
-- TOC entry 5300 (class 1259 OID 228991)
-- Name: idx_repair_tickets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_status ON public.repair_tickets USING btree (status);


--
-- TOC entry 5301 (class 1259 OID 289448)
-- Name: idx_repair_tickets_status_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_status_priority ON public.repair_tickets USING btree (status, priority);


--
-- TOC entry 5302 (class 1259 OID 289474)
-- Name: idx_repair_tickets_technician_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_technician_status ON public.repair_tickets USING btree (submitted_by, status);


--
-- TOC entry 5303 (class 1259 OID 246281)
-- Name: idx_repair_tickets_ticket_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_ticket_number ON public.repair_tickets USING btree (ticket_number);


--
-- TOC entry 5304 (class 1259 OID 253766)
-- Name: idx_repair_tickets_year_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_year_created ON public.repair_tickets USING btree (year_created);


--
-- TOC entry 5190 (class 1259 OID 253733)
-- Name: idx_users_department; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_department ON public.users USING btree (department);


--
-- TOC entry 5191 (class 1259 OID 34938)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 5192 (class 1259 OID 253734)
-- Name: idx_users_last_login; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_last_login ON public.users USING btree (last_login);


--
-- TOC entry 5193 (class 1259 OID 289497)
-- Name: idx_users_last_logout; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_last_logout ON public.users USING btree (last_logout);


--
-- TOC entry 5194 (class 1259 OID 289459)
-- Name: idx_users_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_name ON public.users USING btree (name);


--
-- TOC entry 5195 (class 1259 OID 289458)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 5196 (class 1259 OID 253732)
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- TOC entry 5339 (class 1259 OID 289470)
-- Name: idx_warranty_repair_tickets_additional_equipment_text; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_additional_equipment_text ON public.warranty_repair_tickets USING gin (additional_equipment public.gin_trgm_ops);


--
-- TOC entry 5340 (class 1259 OID 289471)
-- Name: idx_warranty_repair_tickets_brought_by_text; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_brought_by_text ON public.warranty_repair_tickets USING gin (brought_by public.gin_trgm_ops);


--
-- TOC entry 5341 (class 1259 OID 253794)
-- Name: idx_warranty_repair_tickets_converted_at; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_converted_at ON public.warranty_repair_tickets USING btree (converted_at);


--
-- TOC entry 5342 (class 1259 OID 289451)
-- Name: idx_warranty_repair_tickets_created_at_status; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_created_at_status ON public.warranty_repair_tickets USING btree (created_at DESC, status);


--
-- TOC entry 5343 (class 1259 OID 246284)
-- Name: idx_warranty_repair_tickets_customer_id; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_customer_id ON public.warranty_repair_tickets USING btree (customer_id);


--
-- TOC entry 5344 (class 1259 OID 289475)
-- Name: idx_warranty_repair_tickets_customer_status; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_customer_status ON public.warranty_repair_tickets USING btree (customer_id, status);


--
-- TOC entry 5345 (class 1259 OID 253767)
-- Name: idx_warranty_repair_tickets_formatted_number; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_formatted_number ON public.warranty_repair_tickets USING btree (formatted_number);


--
-- TOC entry 5346 (class 1259 OID 246285)
-- Name: idx_warranty_repair_tickets_machine_id; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_machine_id ON public.warranty_repair_tickets USING btree (machine_id);


--
-- TOC entry 5347 (class 1259 OID 289469)
-- Name: idx_warranty_repair_tickets_notes_text; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_notes_text ON public.warranty_repair_tickets USING gin (notes public.gin_trgm_ops);


--
-- TOC entry 5348 (class 1259 OID 289238)
-- Name: idx_warranty_repair_tickets_priority; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_priority ON public.warranty_repair_tickets USING btree (priority);


--
-- TOC entry 5349 (class 1259 OID 289446)
-- Name: idx_warranty_repair_tickets_problem_description_text; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_problem_description_text ON public.warranty_repair_tickets USING gin (problem_description public.gin_trgm_ops);


--
-- TOC entry 5350 (class 1259 OID 286352)
-- Name: idx_warranty_repair_tickets_sales_user_id; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_sales_user_id ON public.warranty_repair_tickets USING btree (sales_user_id);


--
-- TOC entry 5351 (class 1259 OID 246283)
-- Name: idx_warranty_repair_tickets_status; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_status ON public.warranty_repair_tickets USING btree (status);


--
-- TOC entry 5352 (class 1259 OID 289450)
-- Name: idx_warranty_repair_tickets_status_priority; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_status_priority ON public.warranty_repair_tickets USING btree (status, priority);


--
-- TOC entry 5353 (class 1259 OID 289476)
-- Name: idx_warranty_repair_tickets_technician_status; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_technician_status ON public.warranty_repair_tickets USING btree (submitted_by, status);


--
-- TOC entry 5354 (class 1259 OID 246282)
-- Name: idx_warranty_repair_tickets_ticket_number; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_ticket_number ON public.warranty_repair_tickets USING btree (ticket_number);


--
-- TOC entry 5355 (class 1259 OID 253768)
-- Name: idx_warranty_repair_tickets_year_created; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_year_created ON public.warranty_repair_tickets USING btree (year_created);


--
-- TOC entry 5309 (class 1259 OID 289455)
-- Name: idx_warranty_work_orders_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_created_at_status ON public.warranty_work_orders USING btree (created_at DESC, status);


--
-- TOC entry 5310 (class 1259 OID 229075)
-- Name: idx_warranty_work_orders_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_customer_id ON public.warranty_work_orders USING btree (customer_id);


--
-- TOC entry 5311 (class 1259 OID 289479)
-- Name: idx_warranty_work_orders_customer_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_customer_status ON public.warranty_work_orders USING btree (customer_id, status);


--
-- TOC entry 5312 (class 1259 OID 229074)
-- Name: idx_warranty_work_orders_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_due_date ON public.warranty_work_orders USING btree (due_date);


--
-- TOC entry 5313 (class 1259 OID 253771)
-- Name: idx_warranty_work_orders_formatted_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_formatted_number ON public.warranty_work_orders USING btree (formatted_number);


--
-- TOC entry 5314 (class 1259 OID 229076)
-- Name: idx_warranty_work_orders_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_machine_id ON public.warranty_work_orders USING btree (machine_id);


--
-- TOC entry 5315 (class 1259 OID 246289)
-- Name: idx_warranty_work_orders_owner_technician_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_owner_technician_id ON public.warranty_work_orders USING btree (owner_technician_id);


--
-- TOC entry 5316 (class 1259 OID 229073)
-- Name: idx_warranty_work_orders_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_priority ON public.warranty_work_orders USING btree (priority);


--
-- TOC entry 5317 (class 1259 OID 286350)
-- Name: idx_warranty_work_orders_sales_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_sales_user_id ON public.warranty_work_orders USING btree (sales_user_id);


--
-- TOC entry 5318 (class 1259 OID 229071)
-- Name: idx_warranty_work_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_status ON public.warranty_work_orders USING btree (status);


--
-- TOC entry 5319 (class 1259 OID 289454)
-- Name: idx_warranty_work_orders_status_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_status_priority ON public.warranty_work_orders USING btree (status, priority);


--
-- TOC entry 5320 (class 1259 OID 229072)
-- Name: idx_warranty_work_orders_technician_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_technician_id ON public.warranty_work_orders USING btree (technician_id);


--
-- TOC entry 5321 (class 1259 OID 289480)
-- Name: idx_warranty_work_orders_technician_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_technician_status ON public.warranty_work_orders USING btree (owner_technician_id, status);


--
-- TOC entry 5322 (class 1259 OID 246287)
-- Name: idx_warranty_work_orders_ticket_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_ticket_number ON public.warranty_work_orders USING btree (ticket_number);


--
-- TOC entry 5323 (class 1259 OID 253772)
-- Name: idx_warranty_work_orders_year_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_year_created ON public.warranty_work_orders USING btree (year_created);


--
-- TOC entry 5224 (class 1259 OID 253459)
-- Name: idx_work_orders_converted_by_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_converted_by_user_id ON public.work_orders USING btree (converted_by_user_id);


--
-- TOC entry 5225 (class 1259 OID 34939)
-- Name: idx_work_orders_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_created_at ON public.work_orders USING btree (created_at);


--
-- TOC entry 5226 (class 1259 OID 289453)
-- Name: idx_work_orders_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_created_at_status ON public.work_orders USING btree (created_at DESC, status);


--
-- TOC entry 5227 (class 1259 OID 289477)
-- Name: idx_work_orders_customer_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_customer_status ON public.work_orders USING btree (customer_id, status);


--
-- TOC entry 5228 (class 1259 OID 253769)
-- Name: idx_work_orders_formatted_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_formatted_number ON public.work_orders USING btree (formatted_number);


--
-- TOC entry 5229 (class 1259 OID 246288)
-- Name: idx_work_orders_owner_technician_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_owner_technician_id ON public.work_orders USING btree (owner_technician_id);


--
-- TOC entry 5230 (class 1259 OID 286353)
-- Name: idx_work_orders_sales_opportunity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_sales_opportunity ON public.work_orders USING btree (sales_opportunity);


--
-- TOC entry 5231 (class 1259 OID 286354)
-- Name: idx_work_orders_sales_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_sales_stage ON public.work_orders USING btree (sales_stage);


--
-- TOC entry 5232 (class 1259 OID 286349)
-- Name: idx_work_orders_sales_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_sales_user_id ON public.work_orders USING btree (sales_user_id);


--
-- TOC entry 5233 (class 1259 OID 289452)
-- Name: idx_work_orders_status_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_status_priority ON public.work_orders USING btree (status, priority);


--
-- TOC entry 5234 (class 1259 OID 289478)
-- Name: idx_work_orders_technician_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_technician_status ON public.work_orders USING btree (owner_technician_id, status);


--
-- TOC entry 5235 (class 1259 OID 246286)
-- Name: idx_work_orders_ticket_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_ticket_number ON public.work_orders USING btree (ticket_number);


--
-- TOC entry 5236 (class 1259 OID 253770)
-- Name: idx_work_orders_year_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_year_created ON public.work_orders USING btree (year_created);


--
-- TOC entry 5360 (class 1259 OID 253773)
-- Name: idx_yearly_sequences_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_yearly_sequences_year ON public.yearly_sequences USING btree (year);


--
-- TOC entry 5221 (class 1259 OID 220693)
-- Name: uniq_machine_model_serial; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uniq_machine_model_serial ON public.machines USING btree (COALESCE(name, ''::text), COALESCE(catalogue_number, ''::text), COALESCE(serial_number, ''::text));


--
-- TOC entry 5502 (class 2620 OID 261783)
-- Name: repair_tickets set_formatted_number_repair_tickets; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_formatted_number_repair_tickets BEFORE INSERT ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();


--
-- TOC entry 5511 (class 2620 OID 261784)
-- Name: warranty_repair_tickets set_formatted_number_warranty_repair_tickets; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_formatted_number_warranty_repair_tickets BEFORE INSERT ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();


--
-- TOC entry 5505 (class 2620 OID 261786)
-- Name: warranty_work_orders set_formatted_number_warranty_work_orders; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_formatted_number_warranty_work_orders BEFORE INSERT ON public.warranty_work_orders FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();


--
-- TOC entry 5496 (class 2620 OID 261785)
-- Name: work_orders set_formatted_number_work_orders; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_formatted_number_work_orders BEFORE INSERT ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();


--
-- TOC entry 5503 (class 2620 OID 246264)
-- Name: repair_tickets set_ticket_number_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_ticket_number_trigger BEFORE INSERT ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();


--
-- TOC entry 5492 (class 2620 OID 32896)
-- Name: customers set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5498 (class 2620 OID 32898)
-- Name: inventory set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5493 (class 2620 OID 32897)
-- Name: machines set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5501 (class 2620 OID 228946)
-- Name: notifications set_updated_at; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5504 (class 2620 OID 228990)
-- Name: repair_tickets set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5491 (class 2620 OID 32895)
-- Name: users set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5507 (class 2620 OID 229069)
-- Name: warranty_work_order_inventory set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_order_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5508 (class 2620 OID 229070)
-- Name: warranty_work_order_notes set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_order_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5506 (class 2620 OID 229068)
-- Name: warranty_work_orders set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5499 (class 2620 OID 32901)
-- Name: work_order_inventory set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5500 (class 2620 OID 32900)
-- Name: work_order_notes set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5497 (class 2620 OID 32899)
-- Name: work_orders set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5516 (class 2620 OID 262422)
-- Name: assigned_machines set_updated_at_assigned_machines; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_assigned_machines BEFORE UPDATE ON public.assigned_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5522 (class 2620 OID 289263)
-- Name: inventory_categories set_updated_at_inventory_categories; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_inventory_categories BEFORE UPDATE ON public.inventory_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5521 (class 2620 OID 289495)
-- Name: lead_follow_ups set_updated_at_lead_follow_ups; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_lead_follow_ups BEFORE UPDATE ON public.lead_follow_ups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5514 (class 2620 OID 262420)
-- Name: machine_models set_updated_at_machine_models; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_machine_models BEFORE UPDATE ON public.machine_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5518 (class 2620 OID 286290)
-- Name: machine_rentals set_updated_at_machine_rentals; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_machine_rentals BEFORE UPDATE ON public.machine_rentals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5515 (class 2620 OID 262421)
-- Name: machine_serials set_updated_at_machine_serials; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_machine_serials BEFORE UPDATE ON public.machine_serials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5509 (class 2620 OID 246268)
-- Name: machine_categories set_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.machine_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5510 (class 2620 OID 246269)
-- Name: warranty_periods set_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.warranty_periods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5512 (class 2620 OID 246270)
-- Name: warranty_repair_tickets set_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5494 (class 2620 OID 246266)
-- Name: machines set_warranty_expiry_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_warranty_expiry_trigger BEFORE INSERT OR UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_expiry();


--
-- TOC entry 5513 (class 2620 OID 246265)
-- Name: warranty_repair_tickets set_warranty_ticket_number_trigger; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_warranty_ticket_number_trigger BEFORE INSERT ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();


--
-- TOC entry 5495 (class 2620 OID 32848)
-- Name: machines trg_set_warranty_active; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_set_warranty_active BEFORE INSERT OR UPDATE OF warranty_expiry_date ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_active();


--
-- TOC entry 5517 (class 2620 OID 262435)
-- Name: assigned_machines trg_set_warranty_active_assigned_machines; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_set_warranty_active_assigned_machines BEFORE INSERT OR UPDATE OF warranty_expiry_date ON public.assigned_machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_active_assigned_machines();


--
-- TOC entry 5519 (class 2620 OID 287843)
-- Name: quotes update_quote_status_timestamp_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_quote_status_timestamp_trigger BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_quote_status_timestamp();


--
-- TOC entry 5520 (class 2620 OID 287841)
-- Name: quotes update_quotes_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_quotes_timestamp BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 5476 (class 2606 OID 286236)
-- Name: assigned_machines assigned_machines_added_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigned_machines
    ADD CONSTRAINT assigned_machines_added_by_user_id_fkey FOREIGN KEY (added_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5477 (class 2606 OID 262408)
-- Name: assigned_machines assigned_machines_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigned_machines
    ADD CONSTRAINT assigned_machines_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5478 (class 2606 OID 262403)
-- Name: assigned_machines assigned_machines_serial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigned_machines
    ADD CONSTRAINT assigned_machines_serial_id_fkey FOREIGN KEY (serial_id) REFERENCES public.machine_serials(id) ON DELETE CASCADE;


--
-- TOC entry 5479 (class 2606 OID 286231)
-- Name: assigned_machines assigned_machines_sold_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigned_machines
    ADD CONSTRAINT assigned_machines_sold_by_user_id_fkey FOREIGN KEY (sold_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5447 (class 2606 OID 62806)
-- Name: customer_communications customer_communications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_communications
    ADD CONSTRAINT customer_communications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5448 (class 2606 OID 62801)
-- Name: customer_communications customer_communications_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_communications
    ADD CONSTRAINT customer_communications_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5449 (class 2606 OID 72173)
-- Name: customer_preferences customer_preferences_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_preferences
    ADD CONSTRAINT customer_preferences_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5429 (class 2606 OID 286224)
-- Name: customers customers_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5486 (class 2606 OID 289487)
-- Name: leads fk_leads_created_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT fk_leads_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5432 (class 2606 OID 228985)
-- Name: work_orders fk_work_orders_converted_from_ticket; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT fk_work_orders_converted_from_ticket FOREIGN KEY (converted_from_ticket_id) REFERENCES public.repair_tickets(id) ON DELETE SET NULL;


--
-- TOC entry 5439 (class 2606 OID 85242)
-- Name: inventory inventory_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- TOC entry 5489 (class 2606 OID 287885)
-- Name: lead_follow_ups lead_follow_ups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5490 (class 2606 OID 287880)
-- Name: lead_follow_ups lead_follow_ups_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- TOC entry 5487 (class 2606 OID 287860)
-- Name: leads leads_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- TOC entry 5488 (class 2606 OID 287865)
-- Name: leads leads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5474 (class 2606 OID 262369)
-- Name: machine_models machine_models_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_models
    ADD CONSTRAINT machine_models_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.machine_categories(id);


--
-- TOC entry 5480 (class 2606 OID 286262)
-- Name: machine_rentals machine_rentals_assigned_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals
    ADD CONSTRAINT machine_rentals_assigned_machine_id_fkey FOREIGN KEY (assigned_machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5481 (class 2606 OID 286272)
-- Name: machine_rentals machine_rentals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals
    ADD CONSTRAINT machine_rentals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5482 (class 2606 OID 286267)
-- Name: machine_rentals machine_rentals_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals
    ADD CONSTRAINT machine_rentals_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5475 (class 2606 OID 262386)
-- Name: machine_serials machine_serials_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_serials
    ADD CONSTRAINT machine_serials_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.machine_models(id) ON DELETE CASCADE;


--
-- TOC entry 5430 (class 2606 OID 246243)
-- Name: machines machines_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.machine_categories(id) ON DELETE SET NULL;


--
-- TOC entry 5431 (class 2606 OID 16427)
-- Name: machines machines_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5453 (class 2606 OID 169428)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5485 (class 2606 OID 287829)
-- Name: quote_items quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- TOC entry 5483 (class 2606 OID 287810)
-- Name: quotes quotes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5484 (class 2606 OID 287805)
-- Name: quotes quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- TOC entry 5454 (class 2606 OID 229078)
-- Name: repair_tickets repair_tickets_converted_to_warranty_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_converted_to_warranty_work_order_id_fkey FOREIGN KEY (converted_to_warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE SET NULL;


--
-- TOC entry 5455 (class 2606 OID 228980)
-- Name: repair_tickets repair_tickets_converted_to_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_converted_to_work_order_id_fkey FOREIGN KEY (converted_to_work_order_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;


--
-- TOC entry 5456 (class 2606 OID 228975)
-- Name: repair_tickets repair_tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_created_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5457 (class 2606 OID 228965)
-- Name: repair_tickets repair_tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5458 (class 2606 OID 262488)
-- Name: repair_tickets repair_tickets_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5459 (class 2606 OID 286334)
-- Name: repair_tickets repair_tickets_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5450 (class 2606 OID 85224)
-- Name: stock_movements stock_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE CASCADE;


--
-- TOC entry 5451 (class 2606 OID 85234)
-- Name: stock_movements stock_movements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5452 (class 2606 OID 85229)
-- Name: stock_movements stock_movements_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;


--
-- TOC entry 5469 (class 2606 OID 246238)
-- Name: warranty_repair_tickets warranty_repair_tickets_converted_to_warranty_work_order_i_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_converted_to_warranty_work_order_i_fkey FOREIGN KEY (converted_to_warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE SET NULL;


--
-- TOC entry 5470 (class 2606 OID 246223)
-- Name: warranty_repair_tickets warranty_repair_tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5471 (class 2606 OID 262493)
-- Name: warranty_repair_tickets warranty_repair_tickets_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5472 (class 2606 OID 286343)
-- Name: warranty_repair_tickets warranty_repair_tickets_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5473 (class 2606 OID 246233)
-- Name: warranty_repair_tickets warranty_repair_tickets_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5466 (class 2606 OID 229047)
-- Name: warranty_work_order_inventory warranty_work_order_inventory_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_inventory
    ADD CONSTRAINT warranty_work_order_inventory_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE RESTRICT;


--
-- TOC entry 5467 (class 2606 OID 229042)
-- Name: warranty_work_order_inventory warranty_work_order_inventory_warranty_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_inventory
    ADD CONSTRAINT warranty_work_order_inventory_warranty_work_order_id_fkey FOREIGN KEY (warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE CASCADE;


--
-- TOC entry 5468 (class 2606 OID 229063)
-- Name: warranty_work_order_notes warranty_work_order_notes_warranty_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_notes
    ADD CONSTRAINT warranty_work_order_notes_warranty_work_order_id_fkey FOREIGN KEY (warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE CASCADE;


--
-- TOC entry 5460 (class 2606 OID 286217)
-- Name: warranty_work_orders warranty_work_orders_converted_from_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_converted_from_ticket_id_fkey FOREIGN KEY (converted_from_ticket_id) REFERENCES public.warranty_repair_tickets(id) ON DELETE SET NULL;


--
-- TOC entry 5461 (class 2606 OID 229017)
-- Name: warranty_work_orders warranty_work_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5462 (class 2606 OID 262503)
-- Name: warranty_work_orders warranty_work_orders_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5463 (class 2606 OID 246255)
-- Name: warranty_work_orders warranty_work_orders_owner_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_owner_technician_id_fkey FOREIGN KEY (owner_technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5464 (class 2606 OID 286325)
-- Name: warranty_work_orders warranty_work_orders_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5465 (class 2606 OID 229022)
-- Name: warranty_work_orders warranty_work_orders_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5443 (class 2606 OID 43887)
-- Name: work_order_attachments work_order_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_attachments
    ADD CONSTRAINT work_order_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 5444 (class 2606 OID 43882)
-- Name: work_order_attachments work_order_attachments_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_attachments
    ADD CONSTRAINT work_order_attachments_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- TOC entry 5440 (class 2606 OID 16484)
-- Name: work_order_inventory work_order_inventory_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_inventory
    ADD CONSTRAINT work_order_inventory_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE RESTRICT;


--
-- TOC entry 5441 (class 2606 OID 16479)
-- Name: work_order_inventory work_order_inventory_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_inventory
    ADD CONSTRAINT work_order_inventory_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- TOC entry 5442 (class 2606 OID 24773)
-- Name: work_order_notes work_order_notes_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_notes
    ADD CONSTRAINT work_order_notes_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- TOC entry 5445 (class 2606 OID 43909)
-- Name: work_order_time_entries work_order_time_entries_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_time_entries
    ADD CONSTRAINT work_order_time_entries_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id);


--
-- TOC entry 5446 (class 2606 OID 43904)
-- Name: work_order_time_entries work_order_time_entries_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_time_entries
    ADD CONSTRAINT work_order_time_entries_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- TOC entry 5433 (class 2606 OID 253454)
-- Name: work_orders work_orders_converted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_converted_by_user_id_fkey FOREIGN KEY (converted_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5434 (class 2606 OID 16449)
-- Name: work_orders work_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5435 (class 2606 OID 262498)
-- Name: work_orders work_orders_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5436 (class 2606 OID 246250)
-- Name: work_orders work_orders_owner_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_owner_technician_id_fkey FOREIGN KEY (owner_technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5437 (class 2606 OID 286316)
-- Name: work_orders work_orders_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5438 (class 2606 OID 16465)
-- Name: work_orders work_orders_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5751 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customers TO repairadmin;


--
-- TOC entry 5752 (class 0 OID 0)
-- Dependencies: 221
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO repairadmin;


--
-- TOC entry 5756 (class 0 OID 0)
-- Dependencies: 222
-- Name: SEQUENCE customers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customers_id_seq TO repairadmin;


--
-- TOC entry 5757 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE inventory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventory TO repairadmin;


--
-- TOC entry 5760 (class 0 OID 0)
-- Dependencies: 228
-- Name: SEQUENCE inventory_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.inventory_id_seq TO repairadmin;


--
-- TOC entry 5767 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE machines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.machines TO repairadmin;


--
-- TOC entry 5769 (class 0 OID 0)
-- Dependencies: 224
-- Name: SEQUENCE machines_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.machines_id_seq TO repairadmin;


--
-- TOC entry 5774 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE work_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.work_orders TO repairadmin;


--
-- TOC entry 5778 (class 0 OID 0)
-- Dependencies: 220
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.users_id_seq TO repairadmin;


--
-- TOC entry 5785 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE work_order_inventory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.work_order_inventory TO repairadmin;


--
-- TOC entry 5787 (class 0 OID 0)
-- Dependencies: 230
-- Name: SEQUENCE work_order_inventory_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.work_order_inventory_id_seq TO repairadmin;


--
-- TOC entry 5792 (class 0 OID 0)
-- Dependencies: 226
-- Name: SEQUENCE work_orders_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.work_orders_id_seq TO repairadmin;


-- Completed on 2025-09-11 02:20:52

--
-- PostgreSQL database dump complete
--

