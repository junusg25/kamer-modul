--
-- PostgreSQL database dump
--

\restrict FUtVkAQsyJ8z6MpjccHBFRNqAwWBCfTJE53Q8b4LbIb2WHa7Aq1shrs59pvM982

-- Dumped from database version 14.19 (Ubuntu 14.19-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.19 (Ubuntu 14.19-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'Extension for removing accents from text for search purposes';


--
-- Name: accent_insensitive_compare(text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.accent_insensitive_compare(text, text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
  SELECT unaccent($1) ILIKE unaccent($2)
$_$;


ALTER FUNCTION public.accent_insensitive_compare(text, text) OWNER TO postgres;

--
-- Name: FUNCTION accent_insensitive_compare(text, text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.accent_insensitive_compare(text, text) IS 'Helper function for accent and case insensitive text comparison';


--
-- Name: calculate_dynamic_pricing(integer, date, date, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_dynamic_pricing(p_rental_machine_id integer, p_rental_start_date date, p_rental_end_date date, p_customer_id integer DEFAULT NULL::integer) RETURNS TABLE(daily_price numeric, weekly_price numeric, monthly_price numeric, applied_rules jsonb, customer_discount numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
    base_pricing RECORD;
    customer_tier RECORD;
    rental_days INTEGER;
    season VARCHAR(20);
    demand_level VARCHAR(20);
    availability_percentage DECIMAL(5,2);
    final_daily DECIMAL(10,2);
    final_weekly DECIMAL(10,2);
    final_monthly DECIMAL(10,2);
    applied_rules JSONB := '[]'::jsonb;
    rule_record RECORD;
    rule_conditions JSONB;
    rule_adjustments JSONB;
    rule_applies BOOLEAN;
    adjustment_type VARCHAR(20);
    adjustment_value DECIMAL(10,2);
BEGIN
    -- Get base pricing for the machine
    SELECT * INTO base_pricing
    FROM machine_pricing
    WHERE rental_machine_id = p_rental_machine_id
      AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No pricing found for machine %', p_rental_machine_id;
    END IF;
    
    -- Calculate rental duration (fixed syntax)
    rental_days := (p_rental_end_date - p_rental_start_date) + 1;
    
    -- Determine season
    season := CASE 
        WHEN EXTRACT(MONTH FROM p_rental_start_date) IN (12, 1, 2) THEN 'winter'
        WHEN EXTRACT(MONTH FROM p_rental_start_date) IN (3, 4, 5) THEN 'spring'
        WHEN EXTRACT(MONTH FROM p_rental_start_date) IN (6, 7, 8) THEN 'summer'
        ELSE 'autumn'
    END;
    
    -- Get demand level for the date (simplified - in real implementation, this would be more sophisticated)
    SELECT COALESCE(dt.demand_level, 'medium') INTO demand_level
    FROM demand_tracking dt
    WHERE dt.rental_machine_id = p_rental_machine_id 
      AND dt.date = p_rental_start_date;
    
    -- Calculate availability percentage
    SELECT 
        (COUNT(CASE WHEN rental_status = 'available' THEN 1 END) * 100.0 / COUNT(*))::DECIMAL(5,2)
    INTO availability_percentage
    FROM rental_machines
    WHERE model_id = (SELECT model_id FROM rental_machines WHERE id = p_rental_machine_id);
    
    -- Start with base prices
    final_daily := base_pricing.base_price_daily;
    final_weekly := COALESCE(base_pricing.base_price_weekly, base_pricing.base_price_daily * 7);
    final_monthly := COALESCE(base_pricing.base_price_monthly, base_pricing.base_price_daily * 30);
    
    -- Apply pricing rules in priority order
    FOR rule_record IN 
        SELECT * FROM pricing_rules 
        WHERE is_active = TRUE 
        ORDER BY priority DESC, id ASC
    LOOP
        rule_conditions := rule_record.conditions;
        rule_adjustments := rule_record.adjustments;
        rule_applies := TRUE;
        
        -- Check if rule conditions are met
        IF rule_conditions ? 'demand_level' THEN
            rule_applies := rule_applies AND (rule_conditions->>'demand_level' = demand_level);
        END IF;
        
        IF rule_conditions ? 'season' THEN
            rule_applies := rule_applies AND (rule_conditions->>'season' = season);
        END IF;
        
        IF rule_conditions ? 'rental_days' THEN
            IF rule_conditions->'rental_days' ? 'gte' THEN
                rule_applies := rule_applies AND (rental_days >= (rule_conditions->'rental_days'->>'gte')::INTEGER);
            END IF;
            IF rule_conditions->'rental_days' ? 'lte' THEN
                rule_applies := rule_applies AND (rental_days <= (rule_conditions->'rental_days'->>'lte')::INTEGER);
            END IF;
        END IF;
        
        IF rule_conditions ? 'availability_percentage' THEN
            IF rule_conditions->'availability_percentage' ? 'lte' THEN
                rule_applies := rule_applies AND (availability_percentage <= (rule_conditions->'availability_percentage'->>'lte')::DECIMAL);
            END IF;
        END IF;
        
        -- Apply rule if conditions are met
        IF rule_applies THEN
            -- Apply daily price adjustments
            IF rule_adjustments ? 'daily_price' THEN
                adjustment_type := rule_adjustments->'daily_price'->>'type';
                adjustment_value := (rule_adjustments->'daily_price'->>'value')::DECIMAL;
                
                IF adjustment_type = 'percentage' THEN
                    final_daily := final_daily * (1 + adjustment_value / 100);
                ELSIF adjustment_type = 'fixed' THEN
                    final_daily := final_daily + adjustment_value;
                END IF;
            END IF;
            
            -- Apply weekly price adjustments
            IF rule_adjustments ? 'weekly_price' THEN
                adjustment_type := rule_adjustments->'weekly_price'->>'type';
                adjustment_value := (rule_adjustments->'weekly_price'->>'value')::DECIMAL;
                
                IF adjustment_type = 'percentage' THEN
                    final_weekly := final_weekly * (1 + adjustment_value / 100);
                ELSIF adjustment_type = 'fixed' THEN
                    final_weekly := final_weekly + adjustment_value;
                END IF;
            END IF;
            
            -- Apply monthly price adjustments
            IF rule_adjustments ? 'monthly_price' THEN
                adjustment_type := rule_adjustments->'monthly_price'->>'type';
                adjustment_value := (rule_adjustments->'monthly_price'->>'value')::DECIMAL;
                
                IF adjustment_type = 'percentage' THEN
                    final_monthly := final_monthly * (1 + adjustment_value / 100);
                ELSIF adjustment_type = 'fixed' THEN
                    final_monthly := final_monthly + adjustment_value;
                END IF;
            END IF;
            
            -- Add rule to applied rules
            applied_rules := applied_rules || jsonb_build_object(
                'rule_id', rule_record.id,
                'rule_name', rule_record.name,
                'conditions', rule_conditions,
                'adjustments', rule_adjustments
            );
        END IF;
    END LOOP;
    
    -- Apply customer tier discount if customer is provided
    IF p_customer_id IS NOT NULL THEN
        SELECT ct.discount_percentage INTO customer_tier
        FROM customer_tier_assignments cta
        JOIN customer_pricing_tiers ct ON cta.tier_id = ct.id
        WHERE cta.customer_id = p_customer_id
          AND cta.is_active = TRUE;
        
        IF FOUND THEN
            final_daily := final_daily * (1 - customer_tier.discount_percentage / 100);
            final_weekly := final_weekly * (1 - customer_tier.discount_percentage / 100);
            final_monthly := final_monthly * (1 - customer_tier.discount_percentage / 100);
        END IF;
    END IF;
    
    -- Return the calculated prices
    RETURN QUERY SELECT 
        final_daily,
        final_weekly,
        final_monthly,
        applied_rules,
        COALESCE(customer_tier.discount_percentage, 0);
END;
$$;


ALTER FUNCTION public.calculate_dynamic_pricing(p_rental_machine_id integer, p_rental_start_date date, p_rental_end_date date, p_customer_id integer) OWNER TO postgres;

--
-- Name: FUNCTION calculate_dynamic_pricing(p_rental_machine_id integer, p_rental_start_date date, p_rental_end_date date, p_customer_id integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.calculate_dynamic_pricing(p_rental_machine_id integer, p_rental_start_date date, p_rental_end_date date, p_customer_id integer) IS 'Calculates dynamic pricing based on rules, demand, and customer tier';


--
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
-- Name: expire_user_permissions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.expire_user_permissions() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO user_permissions_audit (user_id, permission_key, action, granted, performed_by, reason)
    SELECT user_id, permission_key, 'expired', false, granted_by, 'Automatic expiration'
    FROM user_permissions
    WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP AND granted = true;
    DELETE FROM user_permissions
    WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
END;
$$;


ALTER FUNCTION public.expire_user_permissions() OWNER TO postgres;

--
-- Name: generate_formatted_number(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_formatted_number(prefix text DEFAULT ''::text) RETURNS text
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


ALTER FUNCTION public.generate_formatted_number(prefix text) OWNER TO postgres;

--
-- Name: generate_quote_formatted_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_quote_formatted_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.quote_number IS NOT NULL AND NEW.year_created IS NOT NULL THEN
        NEW.formatted_number := 'QT-' || NEW.quote_number || '/' || (NEW.year_created % 100);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.generate_quote_formatted_number() OWNER TO postgres;

--
-- Name: get_next_quote_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_next_quote_number() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_year INTEGER;
    next_number INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    SELECT COALESCE(MAX(quote_number), 0) + 1
    INTO next_number
    FROM quotes
    WHERE year_created = current_year;
    RETURN next_number;
END;
$$;


ALTER FUNCTION public.get_next_quote_number() OWNER TO postgres;

--
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
-- Name: get_next_yearly_sequence(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_next_yearly_sequence(sequence_prefix text) RETURNS integer
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


ALTER FUNCTION public.get_next_yearly_sequence(sequence_prefix text) OWNER TO postgres;

--
-- Name: log_permission_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_permission_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO user_permissions_audit (user_id, permission_key, action, granted, performed_by, reason)
        VALUES (OLD.user_id, OLD.permission_key, 'revoked', false, OLD.granted_by, OLD.reason);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO user_permissions_audit (user_id, permission_key, action, granted, performed_by, reason)
        VALUES (NEW.user_id, NEW.permission_key, 'updated', NEW.granted, NEW.granted_by, NEW.reason);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO user_permissions_audit (user_id, permission_key, action, granted, performed_by, reason)
        VALUES (NEW.user_id, NEW.permission_key, 'granted', NEW.granted, NEW.granted_by, NEW.reason);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.log_permission_change() OWNER TO postgres;

--
-- Name: set_formatted_number_and_year(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_formatted_number_and_year() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    IF NEW.formatted_number IS NULL THEN
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


ALTER FUNCTION public.set_formatted_number_and_year() OWNER TO postgres;

--
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
-- Name: track_rental_machine_status_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.track_rental_machine_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.rental_status IS DISTINCT FROM NEW.rental_status THEN
        INSERT INTO public.rental_machine_status_history (
            rental_machine_id,
            old_status,
            new_status,
            changed_at
        ) VALUES (
            NEW.id,
            OLD.rental_status,
            NEW.rental_status,
            CURRENT_TIMESTAMP
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.track_rental_machine_status_change() OWNER TO postgres;

--
-- Name: update_feedback_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_feedback_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_feedback_updated_at() OWNER TO postgres;

--
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
-- Name: update_quote_templates_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_quote_templates_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_quote_templates_updated_at() OWNER TO postgres;

--
-- Name: update_sales_targets_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_sales_targets_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_sales_targets_updated_at() OWNER TO postgres;

--
-- Name: update_system_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: admin
--

CREATE FUNCTION public.update_system_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_system_settings_updated_at() OWNER TO admin;

--
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

--
-- Name: update_user_table_preferences_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_user_table_preferences_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_user_table_preferences_updated_at() OWNER TO postgres;

--
-- Name: validate_status_transition(integer, character varying, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_status_transition(p_machine_id integer, p_new_status character varying, p_user_id integer DEFAULT NULL::integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    current_status VARCHAR(20);
    transition_rule RECORD;
BEGIN
    SELECT rental_status INTO current_status
    FROM public.rental_machines
    WHERE id = p_machine_id;
    SELECT * INTO transition_rule
    FROM public.rental_status_transition_rules
    WHERE from_status = current_status AND to_status = p_new_status;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    IF transition_rule.requires_approval AND p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$;


ALTER FUNCTION public.validate_status_transition(p_machine_id integer, p_new_status character varying, p_user_id integer) OWNER TO postgres;

--
-- Name: FUNCTION validate_status_transition(p_machine_id integer, p_new_status character varying, p_user_id integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.validate_status_transition(p_machine_id integer, p_new_status character varying, p_user_id integer) IS 'Validates if a status transition is allowed based on business rules';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attachments (
    id integer NOT NULL,
    entity_type character varying(20) NOT NULL,
    entity_id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    original_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_type character varying(50) NOT NULL,
    file_size integer NOT NULL,
    uploaded_by integer,
    uploaded_at timestamp without time zone DEFAULT now(),
    description text,
    version integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT attachments_entity_type_check CHECK (((entity_type)::text = ANY ((ARRAY['repair_ticket'::character varying, 'warranty_repair_ticket'::character varying, 'work_order'::character varying, 'warranty_work_order'::character varying])::text[])))
);


ALTER TABLE public.attachments OWNER TO postgres;

--
-- Name: TABLE attachments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.attachments IS 'Stores file attachments for repair tickets, warranty repair tickets, work orders, and warranty work orders';


--
-- Name: COLUMN attachments.entity_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.attachments.entity_type IS 'Type of entity: repair_ticket, warranty_repair_ticket, work_order, warranty_work_order';


--
-- Name: COLUMN attachments.entity_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.attachments.entity_id IS 'ID of the entity this attachment belongs to';


--
-- Name: COLUMN attachments.file_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.attachments.file_name IS 'Generated file name (e.g., tk_01_25.png)';


--
-- Name: COLUMN attachments.original_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.attachments.original_name IS 'Original filename when uploaded';


--
-- Name: COLUMN attachments.file_path; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.attachments.file_path IS 'Full path to the stored file';


--
-- Name: COLUMN attachments.file_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.attachments.file_type IS 'MIME type of the file';


--
-- Name: COLUMN attachments.file_size; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.attachments.file_size IS 'File size in bytes';


--
-- Name: COLUMN attachments.version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.attachments.version IS 'Version number for file versioning';


--
-- Name: COLUMN attachments.is_active; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.attachments.is_active IS 'Whether this attachment is active (for soft deletes)';


--
-- Name: attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.attachments_id_seq OWNER TO postgres;

--
-- Name: attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attachments_id_seq OWNED BY public.attachments.id;


--
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
    CONSTRAINT customers_customer_type_check CHECK (((customer_type)::text = ANY (ARRAY[('private'::character varying)::text, ('company'::character varying)::text]))),
    CONSTRAINT customers_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('pending'::character varying)::text])))
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: COLUMN customers.customer_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.customers.customer_type IS 'Type of customer: private (individual) or company (business)';


--
-- Name: COLUMN customers.contact_person; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.customers.contact_person IS 'Main contact person for company customers (not used for private customers)';


--
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
    purchase_date date,
    received_date date,
    repair_status character varying(50) DEFAULT 'in_repair'::character varying,
    condition_on_receipt character varying(20) DEFAULT 'unknown'::character varying,
    estimated_repair_cost numeric(10,2),
    actual_repair_cost numeric(10,2),
    repair_notes text,
    warranty_covered boolean DEFAULT false,
    received_by_user_id integer,
    purchased_at character varying(255),
    sale_price numeric(10,2),
    machine_condition character varying(20),
    CONSTRAINT machines_condition_on_receipt_check CHECK (((condition_on_receipt)::text = ANY ((ARRAY['new'::character varying, 'used'::character varying, 'damaged'::character varying, 'unknown'::character varying])::text[]))),
    CONSTRAINT machines_repair_status_check CHECK (((repair_status)::text = ANY ((ARRAY['in_repair'::character varying, 'repaired'::character varying, 'returned'::character varying, 'scrapped'::character varying])::text[])))
);


ALTER TABLE public.machines OWNER TO postgres;

--
-- Name: sold_machines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sold_machines (
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
    CONSTRAINT sold_machines_machine_condition_check CHECK (((machine_condition)::text = ANY (ARRAY[('new'::character varying)::text, ('used'::character varying)::text])))
);


ALTER TABLE public.sold_machines OWNER TO postgres;

--
-- Name: COLUMN sold_machines.purchased_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sold_machines.purchased_at IS 'Where the customer purchased the machine (e.g., shop name, online store, etc.)';


--
-- Name: customer_all_machines; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.customer_all_machines AS
 SELECT 'sold'::text AS machine_type,
    sm.id,
    sm.customer_id,
    sm.serial_id AS model_reference,
    sm.purchase_date AS date,
    sm.sale_price AS cost,
    sm.warranty_expiry_date,
    sm.warranty_active,
    sm.machine_condition AS condition,
    sm.assigned_at AS created_at,
    ms.serial_number,
    mm.name AS model_name,
    mm.manufacturer,
    c.name AS customer_name,
    c.company_name AS customer_company
   FROM (((public.sold_machines sm
     LEFT JOIN public.machine_serials ms ON ((sm.serial_id = ms.id)))
     LEFT JOIN public.machine_models mm ON ((ms.model_id = mm.id)))
     LEFT JOIN public.customers c ON ((sm.customer_id = c.id)))
UNION ALL
 SELECT 'repair'::text AS machine_type,
    m.id,
    m.customer_id,
    NULL::integer AS model_reference,
    m.received_date AS date,
    m.actual_repair_cost AS cost,
    m.warranty_expiry_date,
    m.warranty_covered AS warranty_active,
    m.condition_on_receipt AS condition,
    m.created_at,
    m.serial_number,
    m.model_name,
    m.manufacturer,
    c.name AS customer_name,
    c.company_name AS customer_company
   FROM (public.machines m
     LEFT JOIN public.customers c ON ((m.customer_id = c.id)));


ALTER TABLE public.customer_all_machines OWNER TO postgres;

--
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
    CONSTRAINT customer_communications_direction_check CHECK (((direction)::text = ANY (ARRAY[('inbound'::character varying)::text, ('outbound'::character varying)::text]))),
    CONSTRAINT customer_communications_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('completed'::character varying)::text, ('scheduled'::character varying)::text]))),
    CONSTRAINT customer_communications_type_check CHECK (((type)::text = ANY (ARRAY[('call'::character varying)::text, ('email'::character varying)::text, ('note'::character varying)::text, ('follow_up'::character varying)::text, ('meeting'::character varying)::text])))
);


ALTER TABLE public.customer_communications OWNER TO repairadmin;

--
-- Name: customer_communications_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.customer_communications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.customer_communications_id_seq OWNER TO repairadmin;

--
-- Name: customer_communications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.customer_communications_id_seq OWNED BY public.customer_communications.id;


--
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


ALTER TABLE public.customer_ownership_view OWNER TO postgres;

--
-- Name: customer_portal_activity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_portal_activity (
    id integer NOT NULL,
    customer_id integer,
    portal_user_id integer,
    action character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id integer,
    tracking_number character varying(50),
    ip_address character varying(45),
    user_agent text,
    details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customer_portal_activity OWNER TO postgres;

--
-- Name: TABLE customer_portal_activity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customer_portal_activity IS 'Activity log for customer portal usage tracking';


--
-- Name: customer_portal_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_portal_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.customer_portal_activity_id_seq OWNER TO postgres;

--
-- Name: customer_portal_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_portal_activity_id_seq OWNED BY public.customer_portal_activity.id;


--
-- Name: customer_portal_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_portal_users (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    is_verified boolean DEFAULT false,
    verification_token character varying(255),
    verification_token_expires timestamp without time zone,
    reset_token character varying(255),
    reset_token_expires timestamp without time zone,
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customer_portal_users OWNER TO postgres;

--
-- Name: TABLE customer_portal_users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customer_portal_users IS 'Customer accounts for accessing the customer portal';


--
-- Name: COLUMN customer_portal_users.verification_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.customer_portal_users.verification_token IS 'Token for email verification';


--
-- Name: COLUMN customer_portal_users.reset_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.customer_portal_users.reset_token IS 'Token for password reset';


--
-- Name: customer_portal_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_portal_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.customer_portal_users_id_seq OWNER TO postgres;

--
-- Name: customer_portal_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_portal_users_id_seq OWNED BY public.customer_portal_users.id;


--
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
    CONSTRAINT customer_preferences_category_check CHECK (((category)::text = ANY (ARRAY[('vip'::character varying)::text, ('regular'::character varying)::text, ('new'::character varying)::text, ('inactive'::character varying)::text]))),
    CONSTRAINT customer_preferences_preferred_contact_method_check CHECK (((preferred_contact_method)::text = ANY (ARRAY[('email'::character varying)::text, ('phone'::character varying)::text, ('sms'::character varying)::text, ('mail'::character varying)::text]))),
    CONSTRAINT customer_preferences_preferred_contact_time_check CHECK (((preferred_contact_time)::text = ANY (ARRAY[('morning'::character varying)::text, ('afternoon'::character varying)::text, ('evening'::character varying)::text, ('anytime'::character varying)::text])))
);


ALTER TABLE public.customer_preferences OWNER TO repairadmin;

--
-- Name: customer_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.customer_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.customer_preferences_id_seq OWNER TO repairadmin;

--
-- Name: customer_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.customer_preferences_id_seq OWNED BY public.customer_preferences.id;


--
-- Name: customer_pricing_tiers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_pricing_tiers (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    discount_percentage numeric(5,2) DEFAULT 0,
    minimum_rentals integer DEFAULT 0,
    minimum_total_spent numeric(10,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.customer_pricing_tiers OWNER TO postgres;

--
-- Name: TABLE customer_pricing_tiers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customer_pricing_tiers IS 'Customer pricing tiers with discount levels';


--
-- Name: customer_pricing_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_pricing_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.customer_pricing_tiers_id_seq OWNER TO postgres;

--
-- Name: customer_pricing_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_pricing_tiers_id_seq OWNED BY public.customer_pricing_tiers.id;


--
-- Name: customer_tier_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_tier_assignments (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    tier_id integer NOT NULL,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    assigned_by integer,
    expires_at timestamp without time zone,
    is_active boolean DEFAULT true
);


ALTER TABLE public.customer_tier_assignments OWNER TO postgres;

--
-- Name: TABLE customer_tier_assignments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customer_tier_assignments IS 'Customer assignments to pricing tiers';


--
-- Name: customer_tier_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_tier_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.customer_tier_assignments_id_seq OWNER TO postgres;

--
-- Name: customer_tier_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_tier_assignments_id_seq OWNED BY public.customer_tier_assignments.id;


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.customers_id_seq OWNER TO postgres;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: demand_tracking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.demand_tracking (
    id integer NOT NULL,
    rental_machine_id integer,
    date date NOT NULL,
    demand_level character varying(20) NOT NULL,
    utilization_percentage numeric(5,2),
    booking_requests integer DEFAULT 0,
    completed_rentals integer DEFAULT 0,
    cancelled_rentals integer DEFAULT 0,
    average_rental_duration numeric(5,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.demand_tracking OWNER TO postgres;

--
-- Name: TABLE demand_tracking; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.demand_tracking IS 'Daily demand tracking for pricing decisions';


--
-- Name: demand_tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.demand_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.demand_tracking_id_seq OWNER TO postgres;

--
-- Name: demand_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.demand_tracking_id_seq OWNED BY public.demand_tracking.id;


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feedback (
    id integer NOT NULL,
    user_id integer NOT NULL,
    message text NOT NULL,
    type character varying(20) NOT NULL,
    priority character varying(10) NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    page_url text,
    user_agent text,
    admin_notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp with time zone,
    CONSTRAINT feedback_priority_check CHECK (((priority)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text, ('urgent'::character varying)::text]))),
    CONSTRAINT feedback_status_check CHECK (((status)::text = ANY (ARRAY[('open'::character varying)::text, ('in_progress'::character varying)::text, ('resolved'::character varying)::text, ('closed'::character varying)::text]))),
    CONSTRAINT feedback_type_check CHECK (((type)::text = ANY (ARRAY[('bug'::character varying)::text, ('feature'::character varying)::text, ('improvement'::character varying)::text, ('complaint'::character varying)::text, ('other'::character varying)::text])))
);


ALTER TABLE public.feedback OWNER TO postgres;

--
-- Name: TABLE feedback; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.feedback IS 'User feedback and bug reports for the repair shop application';


--
-- Name: COLUMN feedback.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.user_id IS 'ID of the user who submitted the feedback';


--
-- Name: COLUMN feedback.message; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.message IS 'The feedback message content';


--
-- Name: COLUMN feedback.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.type IS 'Type of feedback: bug, feature, improvement, complaint, or other';


--
-- Name: COLUMN feedback.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.priority IS 'Priority level: low, medium, high, or urgent';


--
-- Name: COLUMN feedback.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.status IS 'Current status: open, in_progress, resolved, or closed';


--
-- Name: COLUMN feedback.page_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.page_url IS 'URL of the page where feedback was submitted';


--
-- Name: COLUMN feedback.user_agent; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.user_agent IS 'User agent string for debugging';


--
-- Name: COLUMN feedback.admin_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.admin_notes IS 'Admin notes and resolution details';


--
-- Name: COLUMN feedback.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.created_at IS 'When the feedback was created';


--
-- Name: COLUMN feedback.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.updated_at IS 'When the feedback was last updated';


--
-- Name: COLUMN feedback.resolved_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.resolved_at IS 'When the feedback was resolved';


--
-- Name: feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.feedback_id_seq OWNER TO postgres;

--
-- Name: feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.feedback_id_seq OWNED BY public.feedback.id;


--
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
-- Name: inventory_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.inventory_categories_id_seq OWNER TO postgres;

--
-- Name: inventory_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_categories_id_seq OWNED BY public.inventory_categories.id;


--
-- Name: inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.inventory_id_seq OWNER TO postgres;

--
-- Name: inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_id_seq OWNED BY public.inventory.id;


--
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
-- Name: lead_follow_ups_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lead_follow_ups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.lead_follow_ups_id_seq OWNER TO postgres;

--
-- Name: lead_follow_ups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lead_follow_ups_id_seq OWNED BY public.lead_follow_ups.id;


--
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
    CONSTRAINT leads_lead_quality_check CHECK (((lead_quality)::text = ANY (ARRAY[('high'::character varying)::text, ('medium'::character varying)::text, ('low'::character varying)::text]))),
    CONSTRAINT leads_sales_stage_check CHECK (((sales_stage)::text = ANY (ARRAY[('new'::character varying)::text, ('contacted'::character varying)::text, ('qualified'::character varying)::text, ('proposal'::character varying)::text, ('negotiation'::character varying)::text, ('won'::character varying)::text, ('lost'::character varying)::text])))
);


ALTER TABLE public.leads OWNER TO postgres;

--
-- Name: leads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.leads_id_seq OWNER TO postgres;

--
-- Name: leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leads_id_seq OWNED BY public.leads.id;


--
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
-- Name: machine_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.machine_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.machine_categories_id_seq OWNER TO repairadmin;

--
-- Name: machine_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.machine_categories_id_seq OWNED BY public.machine_categories.id;


--
-- Name: machine_models_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.machine_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.machine_models_id_seq OWNER TO postgres;

--
-- Name: machine_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.machine_models_id_seq OWNED BY public.machine_models.id;


--
-- Name: machine_models_with_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.machine_models_with_stats AS
 SELECT mm.id,
    mm.name,
    mm.catalogue_number,
    mm.manufacturer,
    mm.category_id,
    mm.description,
    mm.warranty_months,
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
        END) AS unassigned_serials,
    count(DISTINCT am.id) AS total_assigned,
    count(
        CASE
            WHEN ((am.warranty_expiry_date IS NOT NULL) AND (am.warranty_expiry_date > CURRENT_DATE)) THEN 1
            ELSE NULL::integer
        END) AS active_warranty,
    count(
        CASE
            WHEN ((am.warranty_expiry_date IS NOT NULL) AND (am.warranty_expiry_date <= CURRENT_DATE)) THEN 1
            ELSE NULL::integer
        END) AS expired_warranty,
    count(
        CASE
            WHEN (am.is_sale = true) THEN 1
            ELSE NULL::integer
        END) AS total_sales,
    count(
        CASE
            WHEN (am.is_sale = false) THEN 1
            ELSE NULL::integer
        END) AS total_assignments,
    sum(
        CASE
            WHEN (am.is_sale = true) THEN am.sale_price
            ELSE (0)::numeric
        END) AS total_sales_revenue,
    avg(
        CASE
            WHEN ((am.is_sale = true) AND (am.sale_price IS NOT NULL)) THEN am.sale_price
            ELSE NULL::numeric
        END) AS avg_sale_price,
    count(
        CASE
            WHEN (((am.machine_condition)::text = 'new'::text) AND (am.is_sale = true)) THEN 1
            ELSE NULL::integer
        END) AS new_machines_sold,
    count(
        CASE
            WHEN (((am.machine_condition)::text = 'used'::text) AND (am.is_sale = true)) THEN 1
            ELSE NULL::integer
        END) AS used_machines_sold,
    min(ms.created_at) AS first_serial_created,
    max(ms.created_at) AS last_serial_created
   FROM (((public.machine_models mm
     LEFT JOIN public.machine_categories mc ON ((mm.category_id = mc.id)))
     LEFT JOIN public.machine_serials ms ON ((mm.id = ms.model_id)))
     LEFT JOIN public.sold_machines am ON ((ms.id = am.serial_id)))
  GROUP BY mm.id, mm.name, mm.catalogue_number, mm.manufacturer, mm.category_id, mm.description, mm.warranty_months, mm.created_at, mm.updated_at, mc.name;


ALTER TABLE public.machine_models_with_stats OWNER TO postgres;

--
-- Name: machine_pricing; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.machine_pricing (
    id integer NOT NULL,
    rental_machine_id integer NOT NULL,
    base_price_daily numeric(10,2) NOT NULL,
    base_price_weekly numeric(10,2),
    base_price_monthly numeric(10,2),
    minimum_rental_days integer DEFAULT 1,
    maximum_rental_days integer,
    currency character varying(3) DEFAULT 'EUR'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.machine_pricing OWNER TO postgres;

--
-- Name: TABLE machine_pricing; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.machine_pricing IS 'Base pricing for each rental machine';


--
-- Name: machine_pricing_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.machine_pricing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.machine_pricing_id_seq OWNER TO postgres;

--
-- Name: machine_pricing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.machine_pricing_id_seq OWNED BY public.machine_pricing.id;


--
-- Name: machine_rentals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.machine_rentals (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    rental_start_date date NOT NULL,
    rental_end_date date,
    planned_return_date date,
    actual_return_date date,
    rental_status character varying(20),
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
    rental_machine_id integer,
    CONSTRAINT machine_rentals_billing_period_check CHECK (((billing_period)::text = ANY (ARRAY[('daily'::character varying)::text, ('weekly'::character varying)::text, ('monthly'::character varying)::text]))),
    CONSTRAINT machine_rentals_rental_status_check CHECK (((rental_status)::text = ANY (ARRAY[('active'::character varying)::text, ('reserved'::character varying)::text, ('returned'::character varying)::text, ('overdue'::character varying)::text, ('cancelled'::character varying)::text])))
);


ALTER TABLE public.machine_rentals OWNER TO postgres;

--
-- Name: machine_rentals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.machine_rentals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.machine_rentals_id_seq OWNER TO postgres;

--
-- Name: machine_rentals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.machine_rentals_id_seq OWNED BY public.machine_rentals.id;


--
-- Name: machine_serials_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.machine_serials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.machine_serials_id_seq OWNER TO postgres;

--
-- Name: machine_serials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.machine_serials_id_seq OWNED BY public.machine_serials.id;


--
-- Name: machines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.machines_id_seq OWNER TO postgres;

--
-- Name: machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.machines_id_seq OWNED BY public.machines.id;


--
-- Name: notification_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    color character varying(20),
    priority integer DEFAULT 1,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notification_categories OWNER TO postgres;

--
-- Name: TABLE notification_categories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notification_categories IS 'Categories for organizing and prioritizing notifications';


--
-- Name: notification_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notification_categories_id_seq OWNER TO postgres;

--
-- Name: notification_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_categories_id_seq OWNED BY public.notification_categories.id;


--
-- Name: notification_deliveries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_deliveries (
    id integer NOT NULL,
    notification_id integer NOT NULL,
    user_id integer NOT NULL,
    channel character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    sent_at timestamp without time zone,
    delivered_at timestamp without time zone,
    read_at timestamp without time zone,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notification_deliveries OWNER TO postgres;

--
-- Name: TABLE notification_deliveries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notification_deliveries IS 'Tracks delivery status of notifications across different channels';


--
-- Name: notification_deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_deliveries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notification_deliveries_id_seq OWNER TO postgres;

--
-- Name: notification_deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_deliveries_id_seq OWNED BY public.notification_deliveries.id;


--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_templates (
    id integer NOT NULL,
    template_key character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    notification_type character varying(50) NOT NULL,
    subject_template text,
    body_template text,
    variables jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notification_templates OWNER TO postgres;

--
-- Name: TABLE notification_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notification_templates IS 'Templates for different types of notifications with variable substitution';


--
-- Name: notification_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notification_templates_id_seq OWNER TO postgres;

--
-- Name: notification_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_templates_id_seq OWNED BY public.notification_templates.id;


--
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
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notifications_id_seq OWNER TO repairadmin;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: online_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.online_users (
    user_id integer NOT NULL,
    connected_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_activity timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.online_users OWNER TO postgres;

--
-- Name: TABLE online_users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.online_users IS 'Tracks currently online users across all PM2 instances';


--
-- Name: COLUMN online_users.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.online_users.user_id IS 'Reference to the user who is online';


--
-- Name: COLUMN online_users.connected_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.online_users.connected_at IS 'When the user first connected in this session';


--
-- Name: COLUMN online_users.last_activity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.online_users.last_activity IS 'Last time the user had any activity (updated periodically)';


--
-- Name: pricing_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pricing_history (
    id integer NOT NULL,
    rental_machine_id integer NOT NULL,
    old_price_daily numeric(10,2),
    new_price_daily numeric(10,2),
    old_price_weekly numeric(10,2),
    new_price_weekly numeric(10,2),
    old_price_monthly numeric(10,2),
    new_price_monthly numeric(10,2),
    change_reason character varying(255),
    applied_rules jsonb,
    changed_by integer,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.pricing_history OWNER TO postgres;

--
-- Name: TABLE pricing_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.pricing_history IS 'History of price changes for audit trail';


--
-- Name: pricing_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pricing_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.pricing_history_id_seq OWNER TO postgres;

--
-- Name: pricing_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pricing_history_id_seq OWNED BY public.pricing_history.id;


--
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pricing_rules (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    rule_type character varying(50) NOT NULL,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 1,
    conditions jsonb NOT NULL,
    adjustments jsonb NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.pricing_rules OWNER TO postgres;

--
-- Name: TABLE pricing_rules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.pricing_rules IS 'Dynamic pricing rules with conditions and adjustments';


--
-- Name: pricing_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pricing_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.pricing_rules_id_seq OWNER TO postgres;

--
-- Name: pricing_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pricing_rules_id_seq OWNED BY public.pricing_rules.id;


--
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
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    item_type character varying(50) DEFAULT 'custom'::character varying,
    item_reference_id integer,
    item_name character varying(255),
    total_price numeric(12,2),
    category character varying(100)
);


ALTER TABLE public.quote_items OWNER TO postgres;

--
-- Name: quote_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quote_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.quote_items_id_seq OWNER TO postgres;

--
-- Name: quote_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quote_items_id_seq OWNED BY public.quote_items.id;


--
-- Name: quote_template_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_template_items (
    id integer NOT NULL,
    template_id integer NOT NULL,
    item_type character varying(50) NOT NULL,
    item_reference_id integer,
    item_name character varying(255) NOT NULL,
    description text,
    quantity integer DEFAULT 1,
    unit_price numeric(12,2),
    category character varying(100),
    "position" integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.quote_template_items OWNER TO postgres;

--
-- Name: quote_template_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quote_template_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.quote_template_items_id_seq OWNER TO postgres;

--
-- Name: quote_template_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quote_template_items_id_seq OWNED BY public.quote_template_items.id;


--
-- Name: quote_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_templates (
    id integer NOT NULL,
    template_name character varying(100) NOT NULL,
    template_type character varying(50) NOT NULL,
    description text,
    default_valid_days integer DEFAULT 30,
    default_terms_conditions text,
    default_payment_terms text,
    default_delivery_terms text,
    default_discount_percentage numeric(5,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.quote_templates OWNER TO postgres;

--
-- Name: quote_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quote_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.quote_templates_id_seq OWNER TO postgres;

--
-- Name: quote_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quote_templates_id_seq OWNED BY public.quote_templates.id;


--
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
    declined_at timestamp without time zone,
    follow_up_reminder_date date,
    discount_percentage numeric(5,2) DEFAULT 0,
    payment_terms text,
    delivery_terms text,
    quote_type character varying(50) DEFAULT 'custom'::character varying,
    template_id integer,
    version integer DEFAULT 1,
    parent_quote_id integer,
    year_created integer,
    formatted_number character varying(20),
    CONSTRAINT quotes_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('sent'::character varying)::text, ('viewed'::character varying)::text, ('accepted'::character varying)::text, ('rejected'::character varying)::text, ('expired'::character varying)::text, ('converted'::character varying)::text])))
);


ALTER TABLE public.quotes OWNER TO postgres;

--
-- Name: quotes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quotes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.quotes_id_seq OWNER TO postgres;

--
-- Name: quotes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quotes_id_seq OWNED BY public.quotes.id;


--
-- Name: rental_machine_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rental_machine_status_history (
    id integer NOT NULL,
    rental_machine_id integer NOT NULL,
    old_status character varying(20),
    new_status character varying(20) NOT NULL,
    reason text,
    changed_by integer,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text
);


ALTER TABLE public.rental_machine_status_history OWNER TO postgres;

--
-- Name: TABLE rental_machine_status_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rental_machine_status_history IS 'Tracks all status changes for rental machines with timestamps and reasons';


--
-- Name: rental_machine_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rental_machine_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.rental_machine_status_history_id_seq OWNER TO postgres;

--
-- Name: rental_machine_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rental_machine_status_history_id_seq OWNED BY public.rental_machine_status_history.id;


--
-- Name: rental_machines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rental_machines (
    id integer NOT NULL,
    model_id integer NOT NULL,
    serial_number character varying(255) NOT NULL,
    rental_status character varying(20) DEFAULT 'available'::character varying,
    condition character varying(20) DEFAULT 'good'::character varying,
    location character varying(255),
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rental_machines_condition_check CHECK (((condition)::text = ANY (ARRAY[('excellent'::character varying)::text, ('good'::character varying)::text, ('fair'::character varying)::text, ('poor'::character varying)::text]))),
    CONSTRAINT rental_machines_rental_status_check CHECK (((rental_status)::text = ANY (ARRAY[('available'::character varying)::text, ('rented'::character varying)::text, ('reserved'::character varying)::text, ('cleaning'::character varying)::text, ('inspection'::character varying)::text, ('maintenance'::character varying)::text, ('repair'::character varying)::text, ('quarantine'::character varying)::text, ('retired'::character varying)::text])))
);


ALTER TABLE public.rental_machines OWNER TO postgres;

--
-- Name: rental_machines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rental_machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.rental_machines_id_seq OWNER TO postgres;

--
-- Name: rental_machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rental_machines_id_seq OWNED BY public.rental_machines.id;


--
-- Name: rental_status_transition_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rental_status_transition_rules (
    id integer NOT NULL,
    from_status character varying(20) NOT NULL,
    to_status character varying(20) NOT NULL,
    requires_approval boolean DEFAULT false,
    auto_transition_after_hours integer,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.rental_status_transition_rules OWNER TO postgres;

--
-- Name: TABLE rental_status_transition_rules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rental_status_transition_rules IS 'Defines allowed status transitions and business rules';


--
-- Name: rental_status_transition_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rental_status_transition_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.rental_status_transition_rules_id_seq OWNER TO postgres;

--
-- Name: rental_status_transition_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rental_status_transition_rules_id_seq OWNED BY public.rental_status_transition_rules.id;


--
-- Name: repair_machines_with_details; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.repair_machines_with_details AS
 SELECT m.id,
    m.customer_id,
    m.name AS machine_name,
    m.serial_number,
    m.description,
    m.created_at,
    m.warranty_expiry_date,
    m.warranty_active,
    m.updated_at,
    m.catalogue_number,
    m.manufacturer,
    m.model_name,
    m.receipt_number,
    m.purchase_date,
    m.received_date,
    m.repair_status,
    m.condition_on_receipt,
    m.estimated_repair_cost,
    m.actual_repair_cost,
    m.repair_notes,
    m.warranty_covered,
    m.received_by_user_id,
    c.name AS customer_name,
    c.company_name AS customer_company,
    received_by.name AS received_by_name
   FROM ((public.machines m
     LEFT JOIN public.customers c ON ((m.customer_id = c.id)))
     LEFT JOIN public.users received_by ON ((m.received_by_user_id = received_by.id)));


ALTER TABLE public.repair_machines_with_details OWNER TO postgres;

--
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
    repair_machine_id integer,
    CONSTRAINT repair_tickets_lead_quality_check CHECK ((lead_quality = ANY (ARRAY['unknown'::text, 'cold'::text, 'warm'::text, 'hot'::text]))),
    CONSTRAINT repair_tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT repair_tickets_status_check CHECK ((status = ANY (ARRAY['intake'::text, 'converted'::text, 'converted - warranty'::text, 'cancelled'::text])))
);


ALTER TABLE public.repair_tickets OWNER TO postgres;

--
-- Name: COLUMN repair_tickets.machine_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.repair_tickets.machine_id IS 'References machines from either sold_machines or machines table. Validation handled at application level.';


--
-- Name: repair_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repair_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.repair_tickets_id_seq OWNER TO postgres;

--
-- Name: repair_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repair_tickets_id_seq OWNED BY public.repair_tickets.id;


--
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
-- Name: COLUMN work_orders.machine_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.work_orders.machine_id IS 'References machines from either sold_machines or machines table. Validation handled at application level.';


--
-- Name: repair_tickets_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.repair_tickets_view AS
 SELECT rt.id,
    rt.ticket_number,
    rt.formatted_number,
    rt.year_created,
    rt.customer_id,
    c.name AS customer_name,
    c.customer_type,
    c.contact_person,
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
    COALESCE(rm.name, (mm.name)::text) AS model_name,
    COALESCE(rm.manufacturer, (mm.manufacturer)::text) AS manufacturer,
    COALESCE(rm.catalogue_number, (mm.catalogue_number)::text) AS catalogue_number,
    COALESCE(rm.serial_number, (ms.serial_number)::text) AS serial_number,
    COALESCE(rm.category_id, mm.category_id) AS category_id,
    mc.name AS category_name,
    COALESCE(rm.received_date, am.purchase_date) AS purchase_date,
    COALESCE((rm.received_date)::timestamp without time zone, am.assigned_at) AS bought_at,
    am.receipt_number,
    COALESCE(rm.warranty_expiry_date, am.warranty_expiry_date) AS warranty_expiry_date,
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
   FROM ((((((((((public.repair_tickets rt
     LEFT JOIN public.customers c ON ((rt.customer_id = c.id)))
     LEFT JOIN public.users u_owner ON ((c.owner_id = u_owner.id)))
     LEFT JOIN public.machines rm ON ((rt.machine_id = rm.id)))
     LEFT JOIN public.sold_machines am ON ((rt.machine_id = am.id)))
     LEFT JOIN public.machine_serials ms ON ((am.serial_id = ms.id)))
     LEFT JOIN public.machine_models mm ON ((ms.model_id = mm.id)))
     LEFT JOIN public.machine_categories mc ON ((COALESCE(rm.category_id, mm.category_id) = mc.id)))
     LEFT JOIN public.users u ON ((rt.submitted_by = u.id)))
     LEFT JOIN public.work_orders wo ON ((rt.converted_to_work_order_id = wo.id)))
     LEFT JOIN public.users tech ON ((wo.owner_technician_id = tech.id)));


ALTER TABLE public.repair_tickets_view OWNER TO postgres;

--
-- Name: VIEW repair_tickets_view; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.repair_tickets_view IS 'Updated view for repair tickets that works with both sold machines (sold_machines) and repair machines (machines) tables';


--
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
     LEFT JOIN public.sold_machines am ON ((u.id = am.sold_by_user_id)))
  WHERE (u.role = 'sales'::text)
  GROUP BY u.id, u.name;


ALTER TABLE public.sales_metrics OWNER TO postgres;

--
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


ALTER TABLE public.sales_opportunities OWNER TO postgres;

--
-- Name: sales_targets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_targets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    target_type character varying(20) NOT NULL,
    target_amount numeric(12,2) NOT NULL,
    target_period_start date NOT NULL,
    target_period_end date NOT NULL,
    description text,
    created_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    CONSTRAINT sales_targets_target_amount_check CHECK ((target_amount >= (0)::numeric)),
    CONSTRAINT sales_targets_target_type_check CHECK (((target_type)::text = ANY (ARRAY[('monthly'::character varying)::text, ('quarterly'::character varying)::text, ('yearly'::character varying)::text]))),
    CONSTRAINT valid_target_period CHECK ((target_period_end > target_period_start))
);


ALTER TABLE public.sales_targets OWNER TO postgres;

--
-- Name: sales_targets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sales_targets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sales_targets_id_seq OWNER TO postgres;

--
-- Name: sales_targets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sales_targets_id_seq OWNED BY public.sales_targets.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: repairadmin
--

CREATE TABLE public.schema_migrations (
    name text NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.schema_migrations OWNER TO repairadmin;

--
-- Name: sold_machines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sold_machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sold_machines_id_seq OWNER TO postgres;

--
-- Name: sold_machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sold_machines_id_seq OWNED BY public.sold_machines.id;


--
-- Name: sold_machines_with_details; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.sold_machines_with_details AS
 SELECT sm.id,
    sm.serial_id,
    sm.customer_id,
    sm.purchase_date,
    sm.warranty_expiry_date,
    sm.warranty_active,
    sm.description,
    sm.assigned_at,
    sm.updated_at,
    sm.receipt_number,
    sm.sold_by_user_id,
    sm.added_by_user_id,
    sm.machine_condition,
    sm.sale_date,
    sm.sale_price,
    sm.is_sale,
    sm.purchased_at,
    c.name AS customer_name,
    c.company_name AS customer_company,
    ms.serial_number,
    mm.name AS model_name,
    mm.manufacturer,
    mm.catalogue_number,
    sold_by.name AS sold_by_name,
    added_by.name AS added_by_name
   FROM (((((public.sold_machines sm
     LEFT JOIN public.customers c ON ((sm.customer_id = c.id)))
     LEFT JOIN public.machine_serials ms ON ((sm.serial_id = ms.id)))
     LEFT JOIN public.machine_models mm ON ((ms.model_id = mm.id)))
     LEFT JOIN public.users sold_by ON ((sm.sold_by_user_id = sold_by.id)))
     LEFT JOIN public.users added_by ON ((sm.added_by_user_id = added_by.id)));


ALTER TABLE public.sold_machines_with_details OWNER TO postgres;

--
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
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.stock_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.stock_movements_id_seq OWNER TO repairadmin;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.stock_movements_id_seq OWNED BY public.stock_movements.id;


--
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
    CONSTRAINT suppliers_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text])))
);


ALTER TABLE public.suppliers OWNER TO repairadmin;

--
-- Name: suppliers_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.suppliers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.suppliers_id_seq OWNER TO repairadmin;

--
-- Name: suppliers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.suppliers_id_seq OWNED BY public.suppliers.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    setting_key character varying(50) NOT NULL,
    setting_value text NOT NULL,
    description text,
    updated_by integer,
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.system_settings OWNER TO admin;

--
-- Name: TABLE system_settings; Type: COMMENT; Schema: public; Owner: admin
--

COMMENT ON TABLE public.system_settings IS 'Stores system-wide application settings';


--
-- Name: COLUMN system_settings.setting_key; Type: COMMENT; Schema: public; Owner: admin
--

COMMENT ON COLUMN public.system_settings.setting_key IS 'Unique identifier for the setting';


--
-- Name: COLUMN system_settings.setting_value; Type: COMMENT; Schema: public; Owner: admin
--

COMMENT ON COLUMN public.system_settings.setting_value IS 'Value of the setting';


--
-- Name: COLUMN system_settings.description; Type: COMMENT; Schema: public; Owner: admin
--

COMMENT ON COLUMN public.system_settings.description IS 'Human-readable description of the setting';


--
-- Name: COLUMN system_settings.updated_by; Type: COMMENT; Schema: public; Owner: admin
--

COMMENT ON COLUMN public.system_settings.updated_by IS 'User ID who last updated this setting';


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.system_settings_id_seq OWNER TO admin;

--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: ticket_number_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.ticket_number_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ticket_number_seq OWNER TO repairadmin;

--
-- Name: user_action_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_action_logs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    user_name character varying(255) NOT NULL,
    user_role character varying(50) NOT NULL,
    action_type character varying(50) NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id integer,
    entity_name character varying(255),
    action_details jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_action_logs OWNER TO postgres;

--
-- Name: user_action_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_action_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_action_logs_id_seq OWNER TO postgres;

--
-- Name: user_action_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_action_logs_id_seq OWNED BY public.user_action_logs.id;


--
-- Name: user_notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_notification_preferences (
    id integer NOT NULL,
    user_id integer NOT NULL,
    notification_type character varying(50) NOT NULL,
    channel character varying(20) NOT NULL,
    enabled boolean DEFAULT true,
    frequency character varying(20) DEFAULT 'immediate'::character varying,
    quiet_hours_start time without time zone DEFAULT '22:00:00'::time without time zone,
    quiet_hours_end time without time zone DEFAULT '08:00:00'::time without time zone,
    timezone character varying(50) DEFAULT 'Europe/Belgrade'::character varying,
    language character varying(10) DEFAULT 'en'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_notification_preferences OWNER TO postgres;

--
-- Name: TABLE user_notification_preferences; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_notification_preferences IS 'User preferences for notification delivery and timing';


--
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_notification_preferences_id_seq OWNER TO postgres;

--
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_notification_preferences_id_seq OWNED BY public.user_notification_preferences.id;


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    permission_key character varying(100) NOT NULL,
    granted boolean DEFAULT true,
    granted_by integer NOT NULL,
    granted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    reason text,
    CONSTRAINT valid_permission_format CHECK (((permission_key)::text ~ '^[a-z_]+:[a-z_]+$'::text))
);


ALTER TABLE public.user_permissions OWNER TO postgres;

--
-- Name: user_permissions_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_permissions_audit (
    id integer NOT NULL,
    user_id integer NOT NULL,
    permission_key character varying(100) NOT NULL,
    action character varying(20) NOT NULL,
    granted boolean,
    performed_by integer NOT NULL,
    performed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reason text,
    CONSTRAINT valid_audit_action CHECK (((action)::text = ANY (ARRAY[('granted'::character varying)::text, ('revoked'::character varying)::text, ('expired'::character varying)::text, ('updated'::character varying)::text])))
);


ALTER TABLE public.user_permissions_audit OWNER TO postgres;

--
-- Name: user_permissions_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_permissions_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_permissions_audit_id_seq OWNER TO postgres;

--
-- Name: user_permissions_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_permissions_audit_id_seq OWNED BY public.user_permissions_audit.id;


--
-- Name: user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_permissions_id_seq OWNER TO postgres;

--
-- Name: user_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_permissions_id_seq OWNED BY public.user_permissions.id;


--
-- Name: user_table_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_table_preferences (
    id integer NOT NULL,
    user_id integer NOT NULL,
    table_key character varying(50) NOT NULL,
    visible_columns jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_table_preferences OWNER TO postgres;

--
-- Name: user_table_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_table_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_table_preferences_id_seq OWNER TO postgres;

--
-- Name: user_table_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_table_preferences_id_seq OWNED BY public.user_table_preferences.id;


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
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
-- Name: warranty_periods_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.warranty_periods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.warranty_periods_id_seq OWNER TO repairadmin;

--
-- Name: warranty_periods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.warranty_periods_id_seq OWNED BY public.warranty_periods.id;


--
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
-- Name: COLUMN warranty_repair_tickets.machine_id; Type: COMMENT; Schema: public; Owner: repairadmin
--

COMMENT ON COLUMN public.warranty_repair_tickets.machine_id IS 'References machines from either sold_machines or machines table. Validation handled at application level.';


--
-- Name: warranty_repair_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.warranty_repair_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.warranty_repair_tickets_id_seq OWNER TO repairadmin;

--
-- Name: warranty_repair_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.warranty_repair_tickets_id_seq OWNED BY public.warranty_repair_tickets.id;


--
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
-- Name: COLUMN warranty_work_orders.machine_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.warranty_work_orders.machine_id IS 'References machines from either sold_machines or machines table. Validation handled at application level.';


--
-- Name: warranty_repair_tickets_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.warranty_repair_tickets_view AS
 SELECT wrt.id,
    wrt.ticket_number,
    wrt.formatted_number,
    wrt.year_created,
    wrt.customer_id,
    c.name AS customer_name,
    c.customer_type,
    c.contact_person,
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
    COALESCE(mm_sm.manufacturer, (rm.manufacturer)::character varying) AS manufacturer,
    COALESCE(sm.assigned_at, (rm.received_date)::timestamp without time zone) AS bought_at,
    COALESCE(mm_sm.category_id, rm.category_id) AS category_id,
    COALESCE(mc_sm.name, mc_rm.name) AS category_name,
    COALESCE(mm_sm.name, (rm.model_name)::character varying) AS model_name,
    COALESCE(mm_sm.catalogue_number, (rm.catalogue_number)::character varying) AS catalogue_number,
    COALESCE(ms.serial_number, (rm.serial_number)::character varying) AS serial_number,
    COALESCE(sm.receipt_number, rm.receipt_number) AS receipt_number,
    COALESCE(sm.purchase_date, rm.purchase_date) AS purchase_date,
    COALESCE(sm.warranty_expiry_date, rm.warranty_expiry_date) AS warranty_expiry_date,
    COALESCE(sm.warranty_active, rm.warranty_covered) AS warranty_active,
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
   FROM (((((((((((public.warranty_repair_tickets wrt
     LEFT JOIN public.customers c ON ((wrt.customer_id = c.id)))
     LEFT JOIN public.users u_owner ON ((c.owner_id = u_owner.id)))
     LEFT JOIN public.sold_machines sm ON ((wrt.machine_id = sm.id)))
     LEFT JOIN public.machine_serials ms ON ((sm.serial_id = ms.id)))
     LEFT JOIN public.machine_models mm_sm ON ((ms.model_id = mm_sm.id)))
     LEFT JOIN public.machine_categories mc_sm ON ((mm_sm.category_id = mc_sm.id)))
     LEFT JOIN public.machines rm ON ((wrt.machine_id = rm.id)))
     LEFT JOIN public.machine_categories mc_rm ON ((rm.category_id = mc_rm.id)))
     LEFT JOIN public.users u ON ((wrt.submitted_by = u.id)))
     LEFT JOIN public.warranty_work_orders wwo ON ((wrt.converted_to_warranty_work_order_id = wwo.id)))
     LEFT JOIN public.users tech ON ((wwo.owner_technician_id = tech.id)));


ALTER TABLE public.warranty_repair_tickets_view OWNER TO postgres;

--
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
-- Name: warranty_work_order_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.warranty_work_order_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.warranty_work_order_inventory_id_seq OWNER TO postgres;

--
-- Name: warranty_work_order_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.warranty_work_order_inventory_id_seq OWNED BY public.warranty_work_order_inventory.id;


--
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
-- Name: warranty_work_order_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.warranty_work_order_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.warranty_work_order_notes_id_seq OWNER TO postgres;

--
-- Name: warranty_work_order_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.warranty_work_order_notes_id_seq OWNED BY public.warranty_work_order_notes.id;


--
-- Name: warranty_work_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.warranty_work_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.warranty_work_orders_id_seq OWNER TO postgres;

--
-- Name: warranty_work_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.warranty_work_orders_id_seq OWNED BY public.warranty_work_orders.id;


--
-- Name: warranty_work_orders_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.warranty_work_orders_view AS
 SELECT wwo.id,
    wwo.ticket_number,
    wwo.formatted_number,
    wwo.year_created,
    wwo.customer_id,
    c.name AS customer_name,
    c.customer_type,
    c.contact_person,
    c.company_name AS customer_company,
    c.vat_number,
    c.city AS customer_city,
    c.postal_code,
    c.street_address AS customer_address,
    c.phone AS customer_phone,
    c.phone2,
    c.fax,
    c.email AS customer_email,
    c.owner_id,
    c.assigned_at,
    c.ownership_notes,
    u_owner.name AS owner_name,
    wwo.machine_id,
    am.description AS bought_at,
    mm.manufacturer,
    mm.category_id,
    mc.name AS category_name,
    mm.name AS model_name,
    mm.catalogue_number,
    ms.serial_number,
    am.receipt_number,
    am.purchase_date,
    am.warranty_expiry_date,
    am.warranty_active,
    wwo.description,
    wwo.status,
    wwo.priority,
    wwo.technician_id,
    wwo.owner_technician_id,
    tech.name AS technician_name,
    owner_tech.name AS owner_technician_name,
    wwo.started_at,
    wwo.completed_at,
    wwo.labor_hours,
    wwo.labor_rate,
    wwo.troubleshooting_fee,
    wwo.quote_total AS total_cost,
    wwo.quote_subtotal_parts,
    wwo.quote_total,
    wwo.created_at,
    wwo.updated_at,
    ( SELECT wwon.content
           FROM public.warranty_work_order_notes wwon
          WHERE (wwon.warranty_work_order_id = wwo.id)
          ORDER BY wwon.created_at DESC
         LIMIT 1) AS notes,
    ( SELECT json_agg(json_build_object('name', i.name, 'description', i.description, 'quantity', wwoi.quantity, 'unit_price', i.unit_price, 'total_price', ((wwoi.quantity)::numeric * i.unit_price), 'sku', i.sku, 'part_number', i.part_number)) AS json_agg
           FROM (public.warranty_work_order_inventory wwoi
             LEFT JOIN public.inventory i ON ((wwoi.inventory_id = i.id)))
          WHERE (wwoi.warranty_work_order_id = wwo.id)) AS inventory_items
   FROM ((((((((public.warranty_work_orders wwo
     LEFT JOIN public.customers c ON ((wwo.customer_id = c.id)))
     LEFT JOIN public.users u_owner ON ((c.owner_id = u_owner.id)))
     LEFT JOIN public.sold_machines am ON ((wwo.machine_id = am.id)))
     LEFT JOIN public.machine_serials ms ON ((am.serial_id = ms.id)))
     LEFT JOIN public.machine_models mm ON ((ms.model_id = mm.id)))
     LEFT JOIN public.machine_categories mc ON ((mm.category_id = mc.id)))
     LEFT JOIN public.users tech ON ((wwo.technician_id = tech.id)))
     LEFT JOIN public.users owner_tech ON ((wwo.owner_technician_id = owner_tech.id)));


ALTER TABLE public.warranty_work_orders_view OWNER TO postgres;

--
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
-- Name: work_order_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.work_order_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.work_order_attachments_id_seq OWNER TO repairadmin;

--
-- Name: work_order_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.work_order_attachments_id_seq OWNED BY public.work_order_attachments.id;


--
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
-- Name: work_order_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_order_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.work_order_inventory_id_seq OWNER TO postgres;

--
-- Name: work_order_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_order_inventory_id_seq OWNED BY public.work_order_inventory.id;


--
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
-- Name: work_order_notes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_order_notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.work_order_notes_id_seq OWNER TO postgres;

--
-- Name: work_order_notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_order_notes_id_seq OWNED BY public.work_order_notes.id;


--
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
-- Name: work_order_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.work_order_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.work_order_templates_id_seq OWNER TO repairadmin;

--
-- Name: work_order_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.work_order_templates_id_seq OWNED BY public.work_order_templates.id;


--
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
-- Name: work_order_time_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: repairadmin
--

CREATE SEQUENCE public.work_order_time_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.work_order_time_entries_id_seq OWNER TO repairadmin;

--
-- Name: work_order_time_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.work_order_time_entries_id_seq OWNED BY public.work_order_time_entries.id;


--
-- Name: work_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.work_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.work_orders_id_seq OWNER TO postgres;

--
-- Name: work_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_orders_id_seq OWNED BY public.work_orders.id;


--
-- Name: work_orders_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.work_orders_view AS
 SELECT wo.id,
    wo.ticket_number,
    wo.formatted_number,
    wo.year_created,
    wo.customer_id,
    c.name AS customer_name,
    c.customer_type,
    c.contact_person,
    c.company_name AS customer_company,
    c.vat_number,
    c.city AS customer_city,
    c.postal_code,
    c.street_address AS customer_address,
    c.phone AS customer_phone,
    c.phone2,
    c.fax,
    c.email AS customer_email,
    c.owner_id,
    c.assigned_at,
    c.ownership_notes,
    u_owner.name AS owner_name,
    wo.machine_id,
    am.description AS bought_at,
    mm.manufacturer,
    mm.category_id,
    mc.name AS category_name,
    mm.name AS model_name,
    mm.catalogue_number,
    ms.serial_number,
    am.receipt_number,
    am.purchase_date,
    am.warranty_expiry_date,
    am.warranty_active,
    wo.description,
    wo.status,
    wo.priority,
    wo.technician_id,
    wo.owner_technician_id,
    tech.name AS technician_name,
    owner_tech.name AS owner_technician_name,
    wo.started_at,
    wo.completed_at,
    wo.labor_hours,
    wo.labor_rate,
    wo.troubleshooting_fee,
    wo.total_cost,
    wo.quote_subtotal_parts,
    wo.quote_total,
    wo.created_at,
    wo.updated_at,
    ( SELECT won.content
           FROM public.work_order_notes won
          WHERE (won.work_order_id = wo.id)
          ORDER BY won.created_at DESC
         LIMIT 1) AS notes,
    ( SELECT json_agg(json_build_object('name', i.name, 'description', i.description, 'quantity', woi.quantity, 'unit_price', i.unit_price, 'total_price', ((woi.quantity)::numeric * i.unit_price), 'sku', i.sku, 'part_number', i.part_number)) AS json_agg
           FROM (public.work_order_inventory woi
             LEFT JOIN public.inventory i ON ((woi.inventory_id = i.id)))
          WHERE (woi.work_order_id = wo.id)) AS inventory_items
   FROM ((((((((public.work_orders wo
     LEFT JOIN public.customers c ON ((wo.customer_id = c.id)))
     LEFT JOIN public.users u_owner ON ((c.owner_id = u_owner.id)))
     LEFT JOIN public.sold_machines am ON ((wo.machine_id = am.id)))
     LEFT JOIN public.machine_serials ms ON ((am.serial_id = ms.id)))
     LEFT JOIN public.machine_models mm ON ((ms.model_id = mm.id)))
     LEFT JOIN public.machine_categories mc ON ((mm.category_id = mc.id)))
     LEFT JOIN public.users tech ON ((wo.technician_id = tech.id)))
     LEFT JOIN public.users owner_tech ON ((wo.owner_technician_id = owner_tech.id)));


ALTER TABLE public.work_orders_view OWNER TO postgres;

--
-- Name: yearly_sequences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.yearly_sequences (
    id integer NOT NULL,
    year integer NOT NULL,
    prefix character varying(10) NOT NULL,
    current_sequence integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.yearly_sequences OWNER TO postgres;

--
-- Name: yearly_sequences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.yearly_sequences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.yearly_sequences_id_seq OWNER TO postgres;

--
-- Name: yearly_sequences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.yearly_sequences_id_seq OWNED BY public.yearly_sequences.id;


--
-- Name: attachments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachments ALTER COLUMN id SET DEFAULT nextval('public.attachments_id_seq'::regclass);


--
-- Name: customer_communications id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_communications ALTER COLUMN id SET DEFAULT nextval('public.customer_communications_id_seq'::regclass);


--
-- Name: customer_portal_activity id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_activity ALTER COLUMN id SET DEFAULT nextval('public.customer_portal_activity_id_seq'::regclass);


--
-- Name: customer_portal_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_users ALTER COLUMN id SET DEFAULT nextval('public.customer_portal_users_id_seq'::regclass);


--
-- Name: customer_preferences id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_preferences ALTER COLUMN id SET DEFAULT nextval('public.customer_preferences_id_seq'::regclass);


--
-- Name: customer_pricing_tiers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_pricing_tiers ALTER COLUMN id SET DEFAULT nextval('public.customer_pricing_tiers_id_seq'::regclass);


--
-- Name: customer_tier_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tier_assignments ALTER COLUMN id SET DEFAULT nextval('public.customer_tier_assignments_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: demand_tracking id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_tracking ALTER COLUMN id SET DEFAULT nextval('public.demand_tracking_id_seq'::regclass);


--
-- Name: feedback id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback ALTER COLUMN id SET DEFAULT nextval('public.feedback_id_seq'::regclass);


--
-- Name: inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);


--
-- Name: inventory_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_categories ALTER COLUMN id SET DEFAULT nextval('public.inventory_categories_id_seq'::regclass);


--
-- Name: lead_follow_ups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_ups ALTER COLUMN id SET DEFAULT nextval('public.lead_follow_ups_id_seq'::regclass);


--
-- Name: leads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads ALTER COLUMN id SET DEFAULT nextval('public.leads_id_seq'::regclass);


--
-- Name: machine_categories id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.machine_categories ALTER COLUMN id SET DEFAULT nextval('public.machine_categories_id_seq'::regclass);


--
-- Name: machine_models id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_models ALTER COLUMN id SET DEFAULT nextval('public.machine_models_id_seq'::regclass);


--
-- Name: machine_pricing id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_pricing ALTER COLUMN id SET DEFAULT nextval('public.machine_pricing_id_seq'::regclass);


--
-- Name: machine_rentals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals ALTER COLUMN id SET DEFAULT nextval('public.machine_rentals_id_seq'::regclass);


--
-- Name: machine_serials id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_serials ALTER COLUMN id SET DEFAULT nextval('public.machine_serials_id_seq'::regclass);


--
-- Name: machines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines ALTER COLUMN id SET DEFAULT nextval('public.machines_id_seq'::regclass);


--
-- Name: notification_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_categories ALTER COLUMN id SET DEFAULT nextval('public.notification_categories_id_seq'::regclass);


--
-- Name: notification_deliveries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_deliveries ALTER COLUMN id SET DEFAULT nextval('public.notification_deliveries_id_seq'::regclass);


--
-- Name: notification_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates ALTER COLUMN id SET DEFAULT nextval('public.notification_templates_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: pricing_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_history ALTER COLUMN id SET DEFAULT nextval('public.pricing_history_id_seq'::regclass);


--
-- Name: pricing_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules ALTER COLUMN id SET DEFAULT nextval('public.pricing_rules_id_seq'::regclass);


--
-- Name: quote_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items ALTER COLUMN id SET DEFAULT nextval('public.quote_items_id_seq'::regclass);


--
-- Name: quote_template_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_template_items ALTER COLUMN id SET DEFAULT nextval('public.quote_template_items_id_seq'::regclass);


--
-- Name: quote_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_templates ALTER COLUMN id SET DEFAULT nextval('public.quote_templates_id_seq'::regclass);


--
-- Name: quotes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes ALTER COLUMN id SET DEFAULT nextval('public.quotes_id_seq'::regclass);


--
-- Name: rental_machine_status_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machine_status_history ALTER COLUMN id SET DEFAULT nextval('public.rental_machine_status_history_id_seq'::regclass);


--
-- Name: rental_machines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machines ALTER COLUMN id SET DEFAULT nextval('public.rental_machines_id_seq'::regclass);


--
-- Name: rental_status_transition_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_status_transition_rules ALTER COLUMN id SET DEFAULT nextval('public.rental_status_transition_rules_id_seq'::regclass);


--
-- Name: repair_tickets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets ALTER COLUMN id SET DEFAULT nextval('public.repair_tickets_id_seq'::regclass);


--
-- Name: sales_targets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets ALTER COLUMN id SET DEFAULT nextval('public.sales_targets_id_seq'::regclass);


--
-- Name: sold_machines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sold_machines ALTER COLUMN id SET DEFAULT nextval('public.sold_machines_id_seq'::regclass);


--
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);


--
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: user_action_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_action_logs ALTER COLUMN id SET DEFAULT nextval('public.user_action_logs_id_seq'::regclass);


--
-- Name: user_notification_preferences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_notification_preferences_id_seq'::regclass);


--
-- Name: user_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_id_seq'::regclass);


--
-- Name: user_permissions_audit id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions_audit ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_audit_id_seq'::regclass);


--
-- Name: user_table_preferences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_table_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_table_preferences_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: warranty_periods id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_periods ALTER COLUMN id SET DEFAULT nextval('public.warranty_periods_id_seq'::regclass);


--
-- Name: warranty_repair_tickets id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets ALTER COLUMN id SET DEFAULT nextval('public.warranty_repair_tickets_id_seq'::regclass);


--
-- Name: warranty_work_order_inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_inventory ALTER COLUMN id SET DEFAULT nextval('public.warranty_work_order_inventory_id_seq'::regclass);


--
-- Name: warranty_work_order_notes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_notes ALTER COLUMN id SET DEFAULT nextval('public.warranty_work_order_notes_id_seq'::regclass);


--
-- Name: warranty_work_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders ALTER COLUMN id SET DEFAULT nextval('public.warranty_work_orders_id_seq'::regclass);


--
-- Name: work_order_attachments id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_attachments ALTER COLUMN id SET DEFAULT nextval('public.work_order_attachments_id_seq'::regclass);


--
-- Name: work_order_inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_inventory ALTER COLUMN id SET DEFAULT nextval('public.work_order_inventory_id_seq'::regclass);


--
-- Name: work_order_notes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_notes ALTER COLUMN id SET DEFAULT nextval('public.work_order_notes_id_seq'::regclass);


--
-- Name: work_order_templates id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_templates ALTER COLUMN id SET DEFAULT nextval('public.work_order_templates_id_seq'::regclass);


--
-- Name: work_order_time_entries id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_time_entries ALTER COLUMN id SET DEFAULT nextval('public.work_order_time_entries_id_seq'::regclass);


--
-- Name: work_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders ALTER COLUMN id SET DEFAULT nextval('public.work_orders_id_seq'::regclass);


--
-- Name: yearly_sequences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_sequences ALTER COLUMN id SET DEFAULT nextval('public.yearly_sequences_id_seq'::regclass);


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attachments (id, entity_type, entity_id, file_name, original_name, file_path, file_type, file_size, uploaded_by, uploaded_at, description, version, is_active, created_at, updated_at) FROM stdin;
1	work_order	4	wo_04_25.txt	New Tekstualni dokument.txt	/var/www/kamerba/backend/uploads/attachments/2025/10/work_order/wo_04_25.txt	text/plain	276	10	2025-10-14 19:58:00.58306	\N	1	f	2025-10-14 19:58:00.58306	2025-10-14 20:05:22.90506
3	work_order	4	wo_04_25.jpg	masina.jpg	/var/www/kamerba/backend/uploads/attachments/2025/10/work_order/wo_04_25.jpg	image/jpeg	73529	10	2025-10-14 20:08:24.293088	\N	1	f	2025-10-14 20:08:24.293088	2025-10-14 20:11:01.901843
2	work_order	4	wo_04_25.txt	New Tekstualni dokument.txt	/var/www/kamerba/backend/uploads/attachments/2025/10/work_order/wo_04_25.txt	text/plain	1368	10	2025-10-14 20:05:31.527999	\N	1	f	2025-10-14 20:05:31.527999	2025-10-14 20:11:05.168789
4	work_order	4	wo_04_25.jpg	masina.jpg	/var/www/kamerba/backend/uploads/attachments/2025/10/work_order/wo_04_25.jpg	image/jpeg	73529	10	2025-10-14 20:11:09.714692	\N	1	f	2025-10-14 20:11:09.714692	2025-10-14 20:12:51.786059
6	work_order	4	wo_04_25.txt	New Tekstualni dokument.txt	/var/www/kamerba/backend/uploads/attachments/2025/10/work_order/wo_04_25.txt	text/plain	1368	10	2025-10-14 20:19:47.677367	\N	1	f	2025-10-14 20:19:47.677367	2025-10-14 20:21:58.904536
5	work_order	4	wo_04_25.jpg	masina.jpg	/var/www/kamerba/backend/uploads/attachments/2025/10/work_order/wo_04_25.jpg	image/jpeg	73529	10	2025-10-14 20:13:01.867904	Prije testiranja	1	f	2025-10-14 20:13:01.867904	2025-10-14 20:22:07.019944
7	repair_ticket	18	tk_18_25.txt	New Tekstualni dokument.txt	/var/www/kamerba/backend/uploads/attachments/2025/10/repair_ticket/tk_18_25.txt	text/plain	1368	10	2025-10-14 20:24:13.210463	Test	1	f	2025-10-14 20:24:13.210463	2025-10-14 20:24:27.173993
8	repair_ticket	18	tk_18_25.txt	MONRI TEKST.txt	/var/www/kamerba/backend/uploads/attachments/2025/10/repair_ticket/tk_18_25.txt	text/plain	9022	10	2025-10-14 20:28:23.964952	test	1	f	2025-10-14 20:28:23.964952	2025-10-14 20:28:30.279333
9	repair_ticket	18	tk_18_25.jpg	masina.jpg	/var/www/kamerba/backend/uploads/attachments/2025/10/repair_ticket/tk_18_25.jpg	image/jpeg	73529	10	2025-10-14 20:32:47.923837	Test	1	f	2025-10-14 20:32:47.923837	2025-10-14 20:33:11.384437
10	repair_ticket	18	tk_18_25.jpg	masina.jpg	/var/www/kamerba/backend/uploads/attachments/2025/10/repair_ticket/tk_18_25.jpg	image/jpeg	73529	10	2025-10-14 20:37:00.617254	test	1	t	2025-10-14 20:37:00.617254	2025-10-14 20:37:00.617254
11	repair_ticket	18	tk_18_25.txt	MONRI TEKST.txt	/var/www/kamerba/backend/uploads/attachments/2025/10/repair_ticket/tk_18_25.txt	text/plain	9022	10	2025-10-14 20:37:00.623874	test	1	t	2025-10-14 20:37:00.623874	2025-10-14 20:37:00.623874
\.


--
-- Data for Name: customer_communications; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

COPY public.customer_communications (id, customer_id, type, subject, content, direction, status, scheduled_date, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_portal_activity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) FROM stdin;
306	\N	\N	guest_track	repair_ticket	1	TK-01/25	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	2025-10-12 19:54:38.774533
307	\N	\N	guest_track	work_order	1	WO-01/25	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	\N	2025-10-12 19:54:44.225514
308	\N	\N	guest_track	repair_ticket	1	TK-01/25	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36	\N	2025-10-12 20:58:59.738472
309	\N	\N	guest_track	work_order	1	WO-01/25	::ffff:127.0.0.1	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36	\N	2025-10-12 20:59:07.479063
310	\N	\N	guest_track	repair_ticket	1	TK-01/25	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	\N	2025-10-13 07:06:59.592855
311	\N	\N	guest_track	work_order	1	WO-01/25	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	\N	2025-10-13 07:07:38.575184
312	\N	\N	guest_track	repair_ticket	2	TK-02/25	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	\N	2025-10-13 07:34:52.145978
\.


--
-- Data for Name: customer_portal_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_portal_users (id, customer_id, email, password_hash, is_verified, verification_token, verification_token_expires, reset_token, reset_token_expires, is_active, last_login, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_preferences; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

COPY public.customer_preferences (id, customer_id, preferred_contact_method, preferred_contact_time, category, special_requirements, notes, auto_notifications, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_pricing_tiers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_pricing_tiers (id, name, description, discount_percentage, minimum_rentals, minimum_total_spent, is_active, created_at) FROM stdin;
1	Standard	Standard pricing for all customers	0.00	0	0.00	t	2025-09-19 15:01:21.12143
2	Frequent	Frequent customers with 5+ rentals	5.00	5	0.00	t	2025-09-19 15:01:21.12143
3	VIP	VIP customers with 20+ rentals or €10,000+ spent	10.00	20	10000.00	t	2025-09-19 15:01:21.12143
4	Enterprise	Enterprise customers with 50+ rentals or €25,000+ spent	15.00	50	25000.00	t	2025-09-19 15:01:21.12143
\.


--
-- Data for Name: customer_tier_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_tier_assignments (id, customer_id, tier_id, assigned_at, assigned_by, expires_at, is_active) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) FROM stdin;
1	Zakir Činjarević	+38762290305	zakir@gmail.com	2025-10-11 22:47:25.860025	2025-10-11 22:47:25.860025	Codecta d.o.o.		Sarajevo	71000	Čeljigovići 47			11	2025-10-11 22:47:25.860025	VIP	active	private	
2	Muhamed Imamović	+38761616161	muhamed@kamer.ba	2025-10-14 09:15:04.80909	2025-10-14 09:15:04.80909	Kamer Commerce d.o.o.		Sarajevo	71000	Sarajevo bb			11	2025-10-14 09:15:04.80909	VIP	active	private	
\.


--
-- Data for Name: demand_tracking; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.demand_tracking (id, rental_machine_id, date, demand_level, utilization_percentage, booking_requests, completed_rentals, cancelled_rentals, average_rental_duration, created_at) FROM stdin;
\.


--
-- Data for Name: feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.feedback (id, user_id, message, type, priority, status, page_url, user_agent, admin_notes, created_at, updated_at, resolved_at) FROM stdin;
1	12	dfhdrfh	complaint	medium	closed	/machines/model/1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36		2025-10-13 07:12:48.384+00	2025-10-13 07:13:17.21597+00	\N
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory (id, name, description, quantity, created_at, unit_price, updated_at, part_number, barcode, category, reorder_level, supplier_id, location, min_order_quantity, lead_time_days, min_stock_level, supplier, sku) FROM stdin;
2	Četka	četka za bdove	100	2025-10-13 13:54:22.118426	350.00	2025-10-13 13:54:22.118426	\N	\N	Mašine za podove	5	\N	K2	1	7	5	Karcher	789456123
1	Set gumica	gumice	98	2025-10-13 13:53:44.792999	25.00	2025-10-14 14:01:08.530428	\N	\N	Visoki pritisak	5	\N	K1	1	7	5	Karcher	123456789
\.


--
-- Data for Name: inventory_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_categories (id, name, description, created_at, updated_at) FROM stdin;
19	Visoki pritisak	Category for Visoki pritisak	2025-10-13 13:53:27.110468	2025-10-13 13:53:27.110468
20	Mašine za podove	Category for Mašine za podove	2025-10-13 13:54:05.417327	2025-10-13 13:54:05.417327
\.


--
-- Data for Name: lead_follow_ups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_follow_ups (id, lead_id, notes, action_taken, outcome, created_by, created_at, follow_up_date, follow_up_type, completed, completed_at, updated_at) FROM stdin;
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leads (id, customer_name, company_name, email, phone, source, lead_quality, sales_stage, potential_value, sales_notes, next_follow_up, assigned_to, created_by, pipeline_position, created_at, updated_at) FROM stdin;
1	Emir Varupa	Atlantic Group	argeta@atlantic.ba	+3876161616	Cold Call	medium	new	10000.00	Test	\N	11	11	0	2025-10-12 22:16:46.128878	2025-10-12 22:16:46.128878
\.


--
-- Data for Name: machine_categories; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

COPY public.machine_categories (id, name, created_at, updated_at) FROM stdin;
1	Visoki pritisak	2025-10-11 23:00:58.257525	2025-10-11 23:00:58.257525
2	NT usisivači	2025-10-12 02:24:30.3562	2025-10-12 02:24:30.3562
\.


--
-- Data for Name: machine_models; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.machine_models (id, name, catalogue_number, manufacturer, category_id, description, created_at, updated_at, warranty_months) FROM stdin;
2	HDS 8/18-4 C	1174918	Karcher	1	HDS 8/18-4 C, najsnažniji 3-fazni visokotlačni čistač s toplom vodom u kompaktnoj klasi s eco!efficiency i parnim stupnjem, 3-klipnom aksijalnom pumpom i EASY!Force Advanced pištoljem.	2025-10-11 23:02:10.721709	2025-10-11 23:02:10.721709	12
1	HD 5/15 C Plus	1520931	Karcher	1	Praktičan, mobilan, svestran: visokotl. čistač s hlad. vodom HD 5/15 C Plus za rad u vert. i horiz. polož. Sa spremnikom za pribor, cilind. glavom od mesinga i autom. tlačnim rasterećenjem.	2025-10-11 22:47:43.900197	2025-10-12 01:50:47.625167	12
3	NT 65/2	1667291	Karcher	2	NT 65/2 Ap je učinkoviti mokro/suhi usisavač s 2 motora za prof. primjenu. Zahvaljujući učinkovitom čišćenju filtra s ravnim naborima udarom zraka, snaga usisavanja ostaje gotovo konstantna.	2025-10-12 02:24:45.24551	2025-10-12 02:24:45.24551	12
\.


--
-- Data for Name: machine_pricing; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.machine_pricing (id, rental_machine_id, base_price_daily, base_price_weekly, base_price_monthly, minimum_rental_days, maximum_rental_days, currency, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: machine_rentals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.machine_rentals (id, customer_id, rental_start_date, rental_end_date, planned_return_date, actual_return_date, rental_status, price_per_day, price_per_week, price_per_month, billing_period, total_amount, maintenance_reminder_date, rental_notes, created_by, created_at, updated_at, rental_machine_id) FROM stdin;
\.


--
-- Data for Name: machine_serials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) FROM stdin;
2	1	222 111	available	2025-10-11 22:54:50.317207	2025-10-11 22:54:50.317207
3	3	741 852	available	2025-10-12 02:29:59.208142	2025-10-12 02:29:59.208142
4	2	698 259	available	2025-10-12 02:36:48.834945	2025-10-12 02:36:48.834945
5	2	555 666	available	2025-10-12 22:32:30.626483	2025-10-12 22:32:30.626483
6	1	444 555	available	2025-10-13 07:34:13.070142	2025-10-13 07:34:13.070142
\.


--
-- Data for Name: machines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.machines (id, customer_id, name, serial_number, description, created_at, warranty_expiry_date, warranty_active, updated_at, catalogue_number, manufacturer, bought_at, category_id, model_name, receipt_number, purchase_date, received_date, repair_status, condition_on_receipt, estimated_repair_cost, actual_repair_cost, repair_notes, warranty_covered, received_by_user_id, purchased_at, sale_price, machine_condition) FROM stdin;
23	2	NT 65/2	125 896	test	2025-10-14 12:40:32.97989	2026-10-01	t	2025-10-14 12:40:32.97989	1667291	Karcher	\N	2	NT 65/2	BF-564654	2025-10-01	2025-10-14	in_repair	new	\N	\N	\N	\N	10	Kamer.ba	5200.00	new
24	2	HDS 8/18-4 C	753 698	test	2025-10-14 12:44:32.137451	2026-10-02	t	2025-10-14 12:44:32.137451	1174918	Karcher	\N	1	HDS 8/18-4 C	BF-564654	2025-10-02	2025-10-14	in_repair	used	\N	\N	\N	t	10	AMS	1900.00	used
26	2	NT 65/2	\N	Test	2025-10-14 13:34:12.246619	\N	f	2025-10-14 13:34:12.246619	1667291	Karcher	\N	2	NT 65/2	\N	\N	2025-10-14	in_repair	used	\N	\N	\N	\N	10	Kamer.ba	\N	used
\.


--
-- Data for Name: notification_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_categories (id, name, description, icon, color, priority, is_active, created_at) FROM stdin;
1	rental	Rental-related notifications	calendar	blue	2	t	2025-09-19 14:49:57.303317
2	maintenance	Maintenance and repair notifications	wrench	orange	3	t	2025-09-19 14:49:57.303317
3	system	System and security notifications	shield	red	4	t	2025-09-19 14:49:57.303317
4	marketing	Marketing and promotional notifications	megaphone	green	1	t	2025-09-19 14:49:57.303317
5	customer	Customer service notifications	users	purple	2	t	2025-09-19 14:49:57.303317
6	financial	Financial and billing notifications	dollar-sign	yellow	3	t	2025-09-19 14:49:57.303317
\.


--
-- Data for Name: notification_deliveries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_deliveries (id, notification_id, user_id, channel, status, sent_at, delivered_at, read_at, error_message, retry_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notification_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_templates (id, template_key, name, description, notification_type, subject_template, body_template, variables, is_active, created_at, updated_at) FROM stdin;
1	rental_created	New Rental Created	Notification when a new rental is created	rental	New Rental: {{machine_name}} for {{customer_name}}	A new rental has been created for {{customer_name}}.\\n\\nMachine: {{machine_name}}\\nStart Date: {{start_date}}\\nEnd Date: {{end_date}}\\nTotal Amount: {{total_amount}}	{"end_date": "Rental end date", "start_date": "Rental start date", "machine_name": "Name of the rented machine", "total_amount": "Total rental amount", "customer_name": "Customer name"}	t	2025-09-19 14:49:57.305868	2025-09-19 14:49:57.305868
2	rental_activated	Rental Activated	Notification when a reserved rental becomes active	rental	Rental Activated: {{machine_name}}	Your reserved rental for {{machine_name}} has been activated.\\n\\nStart Date: {{start_date}}\\nEnd Date: {{end_date}}\\nPlease ensure the machine is ready for pickup.	{"end_date": "Rental end date", "start_date": "Rental start date", "machine_name": "Name of the rented machine"}	t	2025-09-19 14:49:57.305868	2025-09-19 14:49:57.305868
3	rental_ending_soon	Rental Ending Soon	Notification when rental is ending soon	rental	Rental Ending Soon: {{machine_name}}	Your rental for {{machine_name}} is ending soon.\\n\\nEnd Date: {{end_date}}\\nPlease prepare for return or contact us to extend.	{"end_date": "Rental end date", "machine_name": "Name of the rented machine"}	t	2025-09-19 14:49:57.305868	2025-09-19 14:49:57.305868
4	maintenance_due	Maintenance Due	Notification when maintenance is due	maintenance	Maintenance Due: {{machine_name}}	Maintenance is due for {{machine_name}}.\\n\\nDue Date: {{due_date}}\\nType: {{maintenance_type}}\\nPlease schedule maintenance.	{"due_date": "Maintenance due date", "machine_name": "Name of the machine", "maintenance_type": "Type of maintenance"}	t	2025-09-19 14:49:57.305868	2025-09-19 14:49:57.305868
5	status_change	Machine Status Changed	Notification when machine status changes	system	Status Update: {{machine_name}}	The status of {{machine_name}} has changed from {{old_status}} to {{new_status}}.\\n\\nReason: {{reason}}\\nChanged by: {{changed_by}}	{"reason": "Reason for change", "changed_by": "User who made the change", "new_status": "New status", "old_status": "Previous status", "machine_name": "Name of the machine"}	t	2025-09-19 14:49:57.305868	2025-09-19 14:49:57.305868
6	overdue_rental	Overdue Rental	Notification for overdue rentals	rental	Overdue Rental: {{machine_name}}	The rental for {{machine_name}} is overdue.\\n\\nCustomer: {{customer_name}}\\nDue Date: {{due_date}}\\nDays Overdue: {{days_overdue}}\\nPlease follow up.	{"due_date": "Original due date", "days_overdue": "Number of days overdue", "machine_name": "Name of the rented machine", "customer_name": "Customer name"}	t	2025-09-19 14:49:57.305868	2025-09-19 14:49:57.305868
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

COPY public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) FROM stdin;
3	13	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Zakir Činjarević for repair	machine	f	assigned_machine	1	2025-10-11 22:48:15.212059	2025-10-11 22:48:15.212059			{}
4	12	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Zakir Činjarević for repair	machine	f	assigned_machine	1	2025-10-11 22:48:15.214765	2025-10-11 22:48:15.214765			{}
5	14	Machine Sold	HD 5/15 C Plus (Karcher) has been sold to Zakir Činjarević for $1480.50	machine	f	assigned_machine	2	2025-10-11 22:54:50.350132	2025-10-11 22:54:50.350132			{}
7	13	Machine Sold	HD 5/15 C Plus (Karcher) has been sold to Zakir Činjarević for $1480.50	machine	f	assigned_machine	2	2025-10-11 22:54:50.356053	2025-10-11 22:54:50.356053			{}
8	12	Machine Sold	HD 5/15 C Plus (Karcher) has been sold to Zakir Činjarević for $1480.50	machine	f	assigned_machine	2	2025-10-11 22:54:50.357505	2025-10-11 22:54:50.357505			{}
10	13	Machine Sold	NT 65/2 (Karcher) has been sold to Zakir Činjarević for $1200.00	machine	f	assigned_machine	3	2025-10-12 02:29:59.234264	2025-10-12 02:29:59.234264			{}
11	14	Machine Sold	NT 65/2 (Karcher) has been sold to Zakir Činjarević for $1200.00	machine	f	assigned_machine	3	2025-10-12 02:29:59.237001	2025-10-12 02:29:59.237001			{}
12	12	Machine Sold	NT 65/2 (Karcher) has been sold to Zakir Činjarević for $1200.00	machine	f	assigned_machine	3	2025-10-12 02:29:59.238352	2025-10-12 02:29:59.238352			{}
14	13	Warranty Repair Ticket Created	New warranty repair ticket WT-2/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	1	2025-10-12 02:34:54.486025	2025-10-12 02:34:54.486025			{}
15	14	Warranty Repair Ticket Created	New warranty repair ticket WT-2/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	1	2025-10-12 02:34:54.487749	2025-10-12 02:34:54.487749			{}
16	12	Warranty Repair Ticket Created	New warranty repair ticket WT-2/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	1	2025-10-12 02:34:54.490497	2025-10-12 02:34:54.490497			{}
18	13	Machine Assigned	HDS 8/18-4 C (Karcher) has been assigned to Zakir Činjarević for repair	machine	f	assigned_machine	4	2025-10-12 02:36:48.859501	2025-10-12 02:36:48.859501			{}
19	14	Machine Assigned	HDS 8/18-4 C (Karcher) has been assigned to Zakir Činjarević for repair	machine	f	assigned_machine	4	2025-10-12 02:36:48.86088	2025-10-12 02:36:48.86088			{}
20	12	Machine Assigned	HDS 8/18-4 C (Karcher) has been assigned to Zakir Činjarević for repair	machine	f	assigned_machine	4	2025-10-12 02:36:48.863477	2025-10-12 02:36:48.863477			{}
1	10	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Zakir Činjarević for repair	machine	t	assigned_machine	1	2025-10-11 22:48:15.206589	2025-10-12 02:53:53.899093			{}
22	13	Repair Ticket Converted	Repair ticket TK-01/25 has been converted to a work order	repair_ticket	f	repair_ticket	1	2025-10-12 02:57:19.464335	2025-10-12 02:57:19.464335			{}
24	14	Repair Ticket Converted	Repair ticket TK-01/25 has been converted to a work order	repair_ticket	f	repair_ticket	1	2025-10-12 02:57:19.473546	2025-10-12 02:57:19.473546			{}
25	13	Work Order Created	New work order WO-01/25 has been created	work_order	f	work_order	1	2025-10-12 02:57:19.478538	2025-10-12 02:57:19.478538			{}
26	10	Work Order Created	New work order WO-01/25 has been created	work_order	t	work_order	1	2025-10-12 02:57:19.482568	2025-10-12 12:29:08.933822			{}
23	10	Repair Ticket Converted	Repair ticket TK-01/25 has been converted to a work order	repair_ticket	t	repair_ticket	1	2025-10-12 02:57:19.468761	2025-10-12 12:29:09.718258			{}
27	12	Machine Sold	HDS 8/18-4 C (Karcher) has been sold to Zakir Činjarević for $7650.00	machine	f	assigned_machine	5	2025-10-12 22:32:30.647431	2025-10-12 22:32:30.647431			{}
28	13	Machine Sold	HDS 8/18-4 C (Karcher) has been sold to Zakir Činjarević for $7650.00	machine	f	assigned_machine	5	2025-10-12 22:32:30.651574	2025-10-12 22:32:30.651574			{}
30	14	Machine Sold	HDS 8/18-4 C (Karcher) has been sold to Zakir Činjarević for $7650.00	machine	f	assigned_machine	5	2025-10-12 22:32:30.656777	2025-10-12 22:32:30.656777			{}
32	13	Work Order Status Changed	Work order WO-01/25 status changed from pending to testing	work_order	f	work_order	1	2025-10-13 07:04:28.702102	2025-10-13 07:04:28.702102			{}
34	15	Work Order Status Changed	Work order WO-01/25 status changed from pending to testing	work_order	f	work_order	1	2025-10-13 07:04:28.707735	2025-10-13 07:04:28.707735			{}
35	14	Work Order Status Changed	Work order WO-01/25 status changed from pending to testing	work_order	f	work_order	1	2025-10-13 07:04:28.710982	2025-10-13 07:04:28.710982			{}
37	13	Work Order Status Changed	Work order WO-01/25 status changed from testing to in_progress	work_order	f	work_order	1	2025-10-13 07:05:40.218414	2025-10-13 07:05:40.218414			{}
39	15	Work Order Status Changed	Work order WO-01/25 status changed from testing to in_progress	work_order	f	work_order	1	2025-10-13 07:05:40.228314	2025-10-13 07:05:40.228314			{}
40	14	Work Order Status Changed	Work order WO-01/25 status changed from testing to in_progress	work_order	f	work_order	1	2025-10-13 07:05:40.232382	2025-10-13 07:05:40.232382			{}
41	13	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Zakir Činjarević for repair	machine	f	assigned_machine	6	2025-10-13 07:34:13.093055	2025-10-13 07:34:13.093055			{}
42	15	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Zakir Činjarević for repair	machine	f	assigned_machine	6	2025-10-13 07:34:13.096129	2025-10-13 07:34:13.096129			{}
45	14	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Zakir Činjarević for repair	machine	f	assigned_machine	6	2025-10-13 07:34:13.10279	2025-10-13 07:34:13.10279			{}
38	11	Work Order Status Changed	Work order WO-01/25 status changed from testing to in_progress	work_order	t	work_order	1	2025-10-13 07:05:40.222771	2025-10-13 09:01:18.62399			{}
33	11	Work Order Status Changed	Work order WO-01/25 status changed from pending to testing	work_order	t	work_order	1	2025-10-13 07:04:28.705599	2025-10-13 09:01:19.407664			{}
21	11	Repair Ticket Converted	Repair ticket TK-01/25 has been converted to a work order	repair_ticket	t	repair_ticket	1	2025-10-12 02:57:19.459096	2025-10-13 09:01:20.928039			{}
29	10	Machine Sold	HDS 8/18-4 C (Karcher) has been sold to Zakir Činjarević for $7650.00	machine	t	assigned_machine	5	2025-10-12 22:32:30.653734	2025-10-14 07:53:36.251002			{}
2	11	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Zakir Činjarević for repair	machine	t	assigned_machine	1	2025-10-11 22:48:15.209999	2025-10-14 08:01:39.105188			{}
6	11	Machine Sold	HD 5/15 C Plus (Karcher) has been sold to Zakir Činjarević for $1480.50	machine	t	assigned_machine	2	2025-10-11 22:54:50.35332	2025-10-14 08:01:39.105188			{}
9	11	Machine Sold	NT 65/2 (Karcher) has been sold to Zakir Činjarević for $1200.00	machine	t	assigned_machine	3	2025-10-12 02:29:59.231938	2025-10-14 08:01:39.105188			{}
46	13	Repair Ticket Converted	Repair ticket TK-02/25 has been converted to a work order	repair_ticket	f	repair_ticket	2	2025-10-13 07:35:34.002653	2025-10-13 07:35:34.002653			{}
47	15	Repair Ticket Converted	Repair ticket TK-02/25 has been converted to a work order	repair_ticket	f	repair_ticket	2	2025-10-13 07:35:34.008854	2025-10-13 07:35:34.008854			{}
50	14	Repair Ticket Converted	Repair ticket TK-02/25 has been converted to a work order	repair_ticket	f	repair_ticket	2	2025-10-13 07:35:34.020284	2025-10-13 07:35:34.020284			{}
51	13	Work Order Created	New work order WO-02/25 has been created	work_order	f	work_order	2	2025-10-13 07:35:34.026848	2025-10-13 07:35:34.026848			{}
44	11	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Zakir Činjarević for repair	machine	t	assigned_machine	6	2025-10-13 07:34:13.10038	2025-10-13 08:53:44.690623			{}
49	11	Repair Ticket Converted	Repair ticket TK-02/25 has been converted to a work order	repair_ticket	t	repair_ticket	2	2025-10-13 07:35:34.017016	2025-10-13 09:01:17.877141			{}
31	10	Work Order Status Changed	Work order WO-01/25 status changed from pending to testing	work_order	t	work_order	1	2025-10-13 07:04:28.699411	2025-10-14 07:53:36.251002			{}
36	10	Work Order Status Changed	Work order WO-01/25 status changed from testing to in_progress	work_order	t	work_order	1	2025-10-13 07:05:40.209341	2025-10-14 07:53:36.251002			{}
43	10	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Zakir Činjarević for repair	machine	t	assigned_machine	6	2025-10-13 07:34:13.09882	2025-10-14 07:53:36.251002			{}
48	10	Repair Ticket Converted	Repair ticket TK-02/25 has been converted to a work order	repair_ticket	t	repair_ticket	2	2025-10-13 07:35:34.012329	2025-10-14 07:53:36.251002			{}
52	10	Work Order Created	New work order WO-02/25 has been created	work_order	t	work_order	2	2025-10-13 07:35:34.030348	2025-10-14 07:53:36.251002			{}
17	11	Machine Assigned	HDS 8/18-4 C (Karcher) has been assigned to Zakir Činjarević for repair	machine	t	assigned_machine	4	2025-10-12 02:36:48.85666	2025-10-14 08:01:39.105188			{}
53	12	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Muhamed Imamović for repair	machine	f	assigned_machine	7	2025-10-14 09:35:57.888523	2025-10-14 09:35:57.888523			{}
54	13	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Muhamed Imamović for repair	machine	f	assigned_machine	7	2025-10-14 09:35:57.896188	2025-10-14 09:35:57.896188			{}
55	16	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Muhamed Imamović for repair	machine	f	assigned_machine	7	2025-10-14 09:35:57.902001	2025-10-14 09:35:57.902001			{}
56	11	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Muhamed Imamović for repair	machine	f	assigned_machine	7	2025-10-14 09:35:57.907546	2025-10-14 09:35:57.907546			{}
57	17	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Muhamed Imamović for repair	machine	f	assigned_machine	7	2025-10-14 09:35:57.913269	2025-10-14 09:35:57.913269			{}
58	14	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Muhamed Imamović for repair	machine	f	assigned_machine	7	2025-10-14 09:35:57.917789	2025-10-14 09:35:57.917789			{}
59	15	Machine Assigned	HD 5/15 C Plus (Karcher) has been assigned to Muhamed Imamović for repair	machine	f	assigned_machine	7	2025-10-14 09:35:57.923606	2025-10-14 09:35:57.923606			{}
60	12	Repair Ticket Converted	Repair ticket TK-15/25 has been converted to a work order	repair_ticket	f	repair_ticket	16	2025-10-14 12:37:32.695322	2025-10-14 12:37:32.695322			{}
61	13	Repair Ticket Converted	Repair ticket TK-15/25 has been converted to a work order	repair_ticket	f	repair_ticket	16	2025-10-14 12:37:32.702806	2025-10-14 12:37:32.702806			{}
62	16	Repair Ticket Converted	Repair ticket TK-15/25 has been converted to a work order	repair_ticket	f	repair_ticket	16	2025-10-14 12:37:32.707	2025-10-14 12:37:32.707			{}
63	11	Repair Ticket Converted	Repair ticket TK-15/25 has been converted to a work order	repair_ticket	f	repair_ticket	16	2025-10-14 12:37:32.711894	2025-10-14 12:37:32.711894			{}
64	17	Repair Ticket Converted	Repair ticket TK-15/25 has been converted to a work order	repair_ticket	f	repair_ticket	16	2025-10-14 12:37:32.71555	2025-10-14 12:37:32.71555			{}
65	14	Repair Ticket Converted	Repair ticket TK-15/25 has been converted to a work order	repair_ticket	f	repair_ticket	16	2025-10-14 12:37:32.720214	2025-10-14 12:37:32.720214			{}
66	15	Repair Ticket Converted	Repair ticket TK-15/25 has been converted to a work order	repair_ticket	f	repair_ticket	16	2025-10-14 12:37:32.724276	2025-10-14 12:37:32.724276			{}
67	12	Work Order Assigned	You have been assigned to work order WO-15/25	work_order	f	work_order	3	2025-10-14 12:37:32.728986	2025-10-14 12:37:32.728986			{}
68	12	Warranty Repair Ticket Created	New warranty repair ticket WT-01/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	1	2025-10-14 12:44:56.186706	2025-10-14 12:44:56.186706			{}
69	13	Warranty Repair Ticket Created	New warranty repair ticket WT-01/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	1	2025-10-14 12:44:56.191451	2025-10-14 12:44:56.191451			{}
70	16	Warranty Repair Ticket Created	New warranty repair ticket WT-01/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	1	2025-10-14 12:44:56.194473	2025-10-14 12:44:56.194473			{}
71	11	Warranty Repair Ticket Created	New warranty repair ticket WT-01/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	1	2025-10-14 12:44:56.196127	2025-10-14 12:44:56.196127			{}
72	17	Warranty Repair Ticket Created	New warranty repair ticket WT-01/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	1	2025-10-14 12:44:56.198858	2025-10-14 12:44:56.198858			{}
73	14	Warranty Repair Ticket Created	New warranty repair ticket WT-01/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	1	2025-10-14 12:44:56.200462	2025-10-14 12:44:56.200462			{}
74	15	Warranty Repair Ticket Created	New warranty repair ticket WT-01/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	1	2025-10-14 12:44:56.203272	2025-10-14 12:44:56.203272			{}
75	12	Warranty Repair Ticket Created	New warranty repair ticket WT-02/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 12:56:25.186973	2025-10-14 12:56:25.186973			{}
76	13	Warranty Repair Ticket Created	New warranty repair ticket WT-02/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 12:56:25.191354	2025-10-14 12:56:25.191354			{}
77	16	Warranty Repair Ticket Created	New warranty repair ticket WT-02/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 12:56:25.194511	2025-10-14 12:56:25.194511			{}
78	11	Warranty Repair Ticket Created	New warranty repair ticket WT-02/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 12:56:25.197036	2025-10-14 12:56:25.197036			{}
79	17	Warranty Repair Ticket Created	New warranty repair ticket WT-02/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 12:56:25.200105	2025-10-14 12:56:25.200105			{}
80	14	Warranty Repair Ticket Created	New warranty repair ticket WT-02/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 12:56:25.202339	2025-10-14 12:56:25.202339			{}
81	15	Warranty Repair Ticket Created	New warranty repair ticket WT-02/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 12:56:25.20572	2025-10-14 12:56:25.20572			{}
82	12	Repair Ticket Converted	Repair ticket TK-16/25 has been converted to a work order	repair_ticket	f	repair_ticket	17	2025-10-14 13:01:22.945028	2025-10-14 13:01:22.945028			{}
83	13	Repair Ticket Converted	Repair ticket TK-16/25 has been converted to a work order	repair_ticket	f	repair_ticket	17	2025-10-14 13:01:22.951859	2025-10-14 13:01:22.951859			{}
84	16	Repair Ticket Converted	Repair ticket TK-16/25 has been converted to a work order	repair_ticket	f	repair_ticket	17	2025-10-14 13:01:22.956397	2025-10-14 13:01:22.956397			{}
85	11	Repair Ticket Converted	Repair ticket TK-16/25 has been converted to a work order	repair_ticket	f	repair_ticket	17	2025-10-14 13:01:22.961861	2025-10-14 13:01:22.961861			{}
86	17	Repair Ticket Converted	Repair ticket TK-16/25 has been converted to a work order	repair_ticket	f	repair_ticket	17	2025-10-14 13:01:22.965742	2025-10-14 13:01:22.965742			{}
87	14	Repair Ticket Converted	Repair ticket TK-16/25 has been converted to a work order	repair_ticket	f	repair_ticket	17	2025-10-14 13:01:22.971004	2025-10-14 13:01:22.971004			{}
88	15	Repair Ticket Converted	Repair ticket TK-16/25 has been converted to a work order	repair_ticket	f	repair_ticket	17	2025-10-14 13:01:22.975457	2025-10-14 13:01:22.975457			{}
89	12	Work Order Assigned	You have been assigned to work order WO-16/25	work_order	f	work_order	4	2025-10-14 13:01:22.981672	2025-10-14 13:01:22.981672			{}
90	12	Warranty Repair Ticket Converted	Warranty Repair ticket WT-02/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 13:06:24.902405	2025-10-14 13:06:24.902405			{}
91	13	Warranty Repair Ticket Converted	Warranty Repair ticket WT-02/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 13:06:24.909761	2025-10-14 13:06:24.909761			{}
92	16	Warranty Repair Ticket Converted	Warranty Repair ticket WT-02/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 13:06:24.915297	2025-10-14 13:06:24.915297			{}
93	11	Warranty Repair Ticket Converted	Warranty Repair ticket WT-02/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 13:06:24.920038	2025-10-14 13:06:24.920038			{}
94	17	Warranty Repair Ticket Converted	Warranty Repair ticket WT-02/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 13:06:24.925608	2025-10-14 13:06:24.925608			{}
95	14	Warranty Repair Ticket Converted	Warranty Repair ticket WT-02/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 13:06:24.930242	2025-10-14 13:06:24.930242			{}
96	15	Warranty Repair Ticket Converted	Warranty Repair ticket WT-02/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	2	2025-10-14 13:06:24.935877	2025-10-14 13:06:24.935877			{}
97	12	Warranty Work Order Assigned	You have been assigned to warranty work order WW-02/25	warranty_work_order	f	warranty_work_order	1	2025-10-14 13:06:24.940076	2025-10-14 13:06:24.940076			{}
98	12	Work Order Status Changed	Work order WO-16/25 status changed from pending to testing	work_order	f	work_order	4	2025-10-14 14:01:00.469288	2025-10-14 14:01:00.469288			{}
99	13	Work Order Status Changed	Work order WO-16/25 status changed from pending to testing	work_order	f	work_order	4	2025-10-14 14:01:00.481572	2025-10-14 14:01:00.481572			{}
100	16	Work Order Status Changed	Work order WO-16/25 status changed from pending to testing	work_order	f	work_order	4	2025-10-14 14:01:00.488812	2025-10-14 14:01:00.488812			{}
101	11	Work Order Status Changed	Work order WO-16/25 status changed from pending to testing	work_order	f	work_order	4	2025-10-14 14:01:00.495417	2025-10-14 14:01:00.495417			{}
102	17	Work Order Status Changed	Work order WO-16/25 status changed from pending to testing	work_order	f	work_order	4	2025-10-14 14:01:00.504174	2025-10-14 14:01:00.504174			{}
103	14	Work Order Status Changed	Work order WO-16/25 status changed from pending to testing	work_order	f	work_order	4	2025-10-14 14:01:00.508612	2025-10-14 14:01:00.508612			{}
104	15	Work Order Status Changed	Work order WO-16/25 status changed from pending to testing	work_order	f	work_order	4	2025-10-14 14:01:00.514899	2025-10-14 14:01:00.514899			{}
105	12	Warranty Repair Ticket Created	New warranty repair ticket WT-03/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:05.801681	2025-10-15 07:06:05.801681			{}
106	13	Warranty Repair Ticket Created	New warranty repair ticket WT-03/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:05.807132	2025-10-15 07:06:05.807132			{}
107	16	Warranty Repair Ticket Created	New warranty repair ticket WT-03/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:05.811633	2025-10-15 07:06:05.811633			{}
108	11	Warranty Repair Ticket Created	New warranty repair ticket WT-03/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:05.814775	2025-10-15 07:06:05.814775			{}
109	17	Warranty Repair Ticket Created	New warranty repair ticket WT-03/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:05.819871	2025-10-15 07:06:05.819871			{}
110	14	Warranty Repair Ticket Created	New warranty repair ticket WT-03/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:05.822906	2025-10-15 07:06:05.822906			{}
111	15	Warranty Repair Ticket Created	New warranty repair ticket WT-03/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:05.827716	2025-10-15 07:06:05.827716			{}
112	12	Warranty Repair Ticket Converted	Warranty Repair ticket WT-03/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:11.442321	2025-10-15 07:06:11.442321			{}
113	13	Warranty Repair Ticket Converted	Warranty Repair ticket WT-03/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:11.448786	2025-10-15 07:06:11.448786			{}
114	16	Warranty Repair Ticket Converted	Warranty Repair ticket WT-03/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:11.453292	2025-10-15 07:06:11.453292			{}
115	11	Warranty Repair Ticket Converted	Warranty Repair ticket WT-03/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:11.458446	2025-10-15 07:06:11.458446			{}
116	17	Warranty Repair Ticket Converted	Warranty Repair ticket WT-03/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:11.46437	2025-10-15 07:06:11.46437			{}
117	14	Warranty Repair Ticket Converted	Warranty Repair ticket WT-03/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:11.469591	2025-10-15 07:06:11.469591			{}
118	15	Warranty Repair Ticket Converted	Warranty Repair ticket WT-03/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	3	2025-10-15 07:06:11.47347	2025-10-15 07:06:11.47347			{}
119	12	Warranty Work Order Assigned	You have been assigned to warranty work order WW-03/25	warranty_work_order	f	warranty_work_order	2	2025-10-15 07:06:11.478376	2025-10-15 07:06:11.478376			{}
120	12	Warranty Repair Ticket Created	New warranty repair ticket WT-04/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:07.909909	2025-10-15 07:18:07.909909			{}
121	13	Warranty Repair Ticket Created	New warranty repair ticket WT-04/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:07.917647	2025-10-15 07:18:07.917647			{}
122	16	Warranty Repair Ticket Created	New warranty repair ticket WT-04/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:07.922372	2025-10-15 07:18:07.922372			{}
123	11	Warranty Repair Ticket Created	New warranty repair ticket WT-04/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:07.928069	2025-10-15 07:18:07.928069			{}
124	17	Warranty Repair Ticket Created	New warranty repair ticket WT-04/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:07.934001	2025-10-15 07:18:07.934001			{}
125	14	Warranty Repair Ticket Created	New warranty repair ticket WT-04/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:07.938319	2025-10-15 07:18:07.938319			{}
126	15	Warranty Repair Ticket Created	New warranty repair ticket WT-04/25 has been created	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:07.943583	2025-10-15 07:18:07.943583			{}
127	12	Warranty Repair Ticket Converted	Warranty Repair ticket WT-04/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:13.130481	2025-10-15 07:18:13.130481			{}
128	13	Warranty Repair Ticket Converted	Warranty Repair ticket WT-04/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:13.133301	2025-10-15 07:18:13.133301			{}
129	16	Warranty Repair Ticket Converted	Warranty Repair ticket WT-04/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:13.136032	2025-10-15 07:18:13.136032			{}
130	11	Warranty Repair Ticket Converted	Warranty Repair ticket WT-04/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:13.13743	2025-10-15 07:18:13.13743			{}
131	17	Warranty Repair Ticket Converted	Warranty Repair ticket WT-04/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:13.139873	2025-10-15 07:18:13.139873			{}
132	14	Warranty Repair Ticket Converted	Warranty Repair ticket WT-04/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:13.141275	2025-10-15 07:18:13.141275			{}
133	15	Warranty Repair Ticket Converted	Warranty Repair ticket WT-04/25 has been converted to a work order	warranty_repair_ticket	f	warranty_repair_ticket	4	2025-10-15 07:18:13.143556	2025-10-15 07:18:13.143556			{}
134	12	Warranty Work Order Assigned	You have been assigned to warranty work order WW-04/25	warranty_work_order	f	warranty_work_order	3	2025-10-15 07:18:13.144698	2025-10-15 07:18:13.144698			{}
\.


--
-- Data for Name: online_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.online_users (user_id, connected_at, last_activity) FROM stdin;
\.


--
-- Data for Name: pricing_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pricing_history (id, rental_machine_id, old_price_daily, new_price_daily, old_price_weekly, new_price_weekly, old_price_monthly, new_price_monthly, change_reason, applied_rules, changed_by, changed_at) FROM stdin;
\.


--
-- Data for Name: pricing_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.pricing_rules (id, name, description, rule_type, is_active, priority, conditions, adjustments, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quote_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_items (id, quote_id, description, quantity, unit_price, total, "position", created_at, item_type, item_reference_id, item_name, total_price, category) FROM stdin;
\.


--
-- Data for Name: quote_template_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_template_items (id, template_id, item_type, item_reference_id, item_name, description, quantity, unit_price, category, "position", created_at) FROM stdin;
\.


--
-- Data for Name: quote_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_templates (id, template_name, template_type, description, default_valid_days, default_terms_conditions, default_payment_terms, default_delivery_terms, default_discount_percentage, is_active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quotes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quotes (id, quote_number, customer_id, customer_name, customer_email, customer_phone, title, description, subtotal, tax_rate, tax_amount, discount_amount, total_amount, status, valid_until, notes, terms_conditions, sent_at, viewed_at, accepted_at, rejected_at, converted_at, created_by, created_at, updated_at, declined_at, follow_up_reminder_date, discount_percentage, payment_terms, delivery_terms, quote_type, template_id, version, parent_quote_id, year_created, formatted_number) FROM stdin;
\.


--
-- Data for Name: rental_machine_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rental_machine_status_history (id, rental_machine_id, old_status, new_status, reason, changed_by, changed_at, notes) FROM stdin;
\.


--
-- Data for Name: rental_machines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rental_machines (id, model_id, serial_number, rental_status, condition, location, notes, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: rental_status_transition_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) FROM stdin;
1	available	rented	f	\N	Machine rented to customer	2025-09-19 13:46:13.093605
2	rented	cleaning	f	\N	Machine returned and needs cleaning	2025-09-19 13:46:13.093605
3	cleaning	inspection	f	2	Auto-transition to inspection after 2 hours	2025-09-19 13:46:13.093605
4	inspection	available	f	1	Auto-transition to available after 1 hour	2025-09-19 13:46:13.093605
5	inspection	repair	t	\N	Issues found during inspection	2025-09-19 13:46:13.093605
6	inspection	quarantine	t	\N	Safety issues found during inspection	2025-09-19 13:46:13.093605
7	available	maintenance	t	\N	Scheduled maintenance	2025-09-19 13:46:13.093605
8	maintenance	inspection	f	\N	Maintenance completed, needs inspection	2025-09-19 13:46:13.093605
9	maintenance	repair	t	\N	Maintenance revealed repair needs	2025-09-19 13:46:13.093605
10	repair	inspection	f	\N	Repair completed, needs inspection	2025-09-19 13:46:13.093605
11	repair	quarantine	t	\N	Repair failed or safety concerns	2025-09-19 13:46:13.093605
12	quarantine	repair	t	\N	Issues resolved, needs repair	2025-09-19 13:46:13.093605
13	quarantine	inspection	t	\N	Issues resolved, needs inspection	2025-09-19 13:46:13.093605
14	quarantine	retired	t	\N	Machine deemed unsafe for service	2025-09-19 13:46:13.093605
15	available	reserved	f	\N	Machine reserved for future rental	2025-09-19 13:46:13.093605
16	reserved	rented	f	\N	Reserved rental becomes active	2025-09-19 13:46:13.093605
17	available	retired	t	\N	Machine retired from service	2025-09-19 13:46:13.093605
18	maintenance	retired	t	\N	Machine retired during maintenance	2025-09-19 13:46:13.093605
19	repair	retired	t	\N	Machine retired during repair	2025-09-19 13:46:13.093605
20	quarantine	retired	t	\N	Machine retired from quarantine	2025-09-19 13:46:13.093605
21	available	rented	f	\N	Machine rented to customer	2025-09-19 13:46:29.146107
22	rented	cleaning	f	\N	Machine returned and needs cleaning	2025-09-19 13:46:29.146107
23	cleaning	inspection	f	2	Auto-transition to inspection after 2 hours	2025-09-19 13:46:29.146107
24	inspection	available	f	1	Auto-transition to available after 1 hour	2025-09-19 13:46:29.146107
25	inspection	repair	t	\N	Issues found during inspection	2025-09-19 13:46:29.146107
26	inspection	quarantine	t	\N	Safety issues found during inspection	2025-09-19 13:46:29.146107
27	available	maintenance	t	\N	Scheduled maintenance	2025-09-19 13:46:29.146107
28	maintenance	inspection	f	\N	Maintenance completed, needs inspection	2025-09-19 13:46:29.146107
29	maintenance	repair	t	\N	Maintenance revealed repair needs	2025-09-19 13:46:29.146107
30	repair	inspection	f	\N	Repair completed, needs inspection	2025-09-19 13:46:29.146107
31	repair	quarantine	t	\N	Repair failed or safety concerns	2025-09-19 13:46:29.146107
32	quarantine	repair	t	\N	Issues resolved, needs repair	2025-09-19 13:46:29.146107
33	quarantine	inspection	t	\N	Issues resolved, needs inspection	2025-09-19 13:46:29.146107
34	quarantine	retired	t	\N	Machine deemed unsafe for service	2025-09-19 13:46:29.146107
35	available	reserved	f	\N	Machine reserved for future rental	2025-09-19 13:46:29.146107
36	reserved	rented	f	\N	Reserved rental becomes active	2025-09-19 13:46:29.146107
37	available	retired	t	\N	Machine retired from service	2025-09-19 13:46:29.146107
38	maintenance	retired	t	\N	Machine retired during maintenance	2025-09-19 13:46:29.146107
39	repair	retired	t	\N	Machine retired during repair	2025-09-19 13:46:29.146107
40	quarantine	retired	t	\N	Machine retired from quarantine	2025-09-19 13:46:29.146107
\.


--
-- Data for Name: repair_tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority, repair_machine_id) FROM stdin;
1	1	4	Test	converted	10	2025-10-12 02:56:47.662423	2025-10-12 02:57:19.434952	2025-10-12 02:57:19.434952	1	\N	1	Test	Test	Test	Zakir	TK-01/25	2025	f	\N	0.00	\N	unknown	medium	\N
2	1	6	NE PALI SE	converted	12	2025-10-13 07:34:30.010476	2025-10-13 07:35:33.982504	2025-10-13 07:35:33.982504	2	\N	2	NE PALI SE	PEGLA COVJEK, NAPLATITI SVE	CRIJEVFO, PISTOLJ	ZAKIR	TK-02/25	2025	f	\N	0.00	\N	unknown	high	\N
17	2	23	test	converted	10	2025-10-14 12:40:40.007659	2025-10-14 13:01:22.916856	2025-10-14 13:01:22.916856	4	\N	3	test	test	test	test	TK-16/25	2025	f	\N	0.00	\N	unknown	medium	\N
18	2	26	test	intake	10	2025-10-14 13:34:18.192596	2025-10-14 13:34:18.192596	\N	\N	\N	4	test	test	test	test	TK-17/25	2025	f	\N	0.00	\N	unknown	medium	\N
\.


--
-- Data for Name: sales_targets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales_targets (id, user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by, created_at, updated_at, is_active) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

COPY public.schema_migrations (name, executed_at) FROM stdin;
001_add_work_order_quote.sql	2025-08-17 23:09:42.242091
002_add_ticket_number.sql	2025-08-18 01:15:02.86269
003_machines_model_unique.sql	2025-08-18 01:52:10.595526
20250127_add_warranty_work_order_reference.sql	2025-08-19 16:20:27.015052
20250127_remove_problem_description.sql	2025-08-21 16:41:37.043194
20250127_comprehensive_schema_update.sql	2025-08-21 16:49:53.335496
011_add_notification_translation_support.sql	2025-08-26 13:54:48.858295
\.


--
-- Data for Name: sold_machines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sold_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) FROM stdin;
2	2	1	2025-10-11	2026-10-11	t	Kupljena nova.	2025-10-11 22:54:50.317207	2025-10-11 22:54:50.317207	BF-789456	10	10	new	2025-10-11	1480.50	t	Kamer.ba
3	3	1	2025-10-12	2026-10-12	t	Kupio na naš nagovor	2025-10-12 02:29:59.208142	2025-10-12 02:29:59.208142	BF-658947	10	10	new	2025-10-12	1200.00	t	Kamer.ba
4	4	1	\N	\N	f	U lošem stanju	2025-10-12 02:36:48.834945	2025-10-12 02:36:48.834945	\N	\N	10	used	\N	\N	f	\N
5	5	1	2025-10-12	2026-10-12	t	Test	2025-10-12 22:32:30.626483	2025-10-12 22:32:30.626483	BF-55589	11	11	new	2025-10-12	7650.00	t	Kamer.ba
6	6	1	2025-10-01	2026-10-01	t	U UZASNOM STANJU STIGLA	2025-10-13 07:34:13.070142	2025-10-13 07:34:13.070142	BF-654654	\N	12	used	2025-10-01	2000.00	f	AMS
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

COPY public.stock_movements (id, inventory_id, quantity_change, reason, work_order_id, notes, user_id, previous_quantity, new_quantity, created_at) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

COPY public.suppliers (id, name, email, phone, address, category, contact_person, website, payment_terms, status, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.system_settings (id, setting_key, setting_value, description, updated_by, updated_at, created_at) FROM stdin;
2	app_name	Kamer.ba	Application display name	\N	2025-10-15 09:01:30.656963	2025-10-15 09:01:30.656963
3	app_version	1.0.0	Application version	\N	2025-10-15 09:01:30.656963	2025-10-15 09:01:30.656963
4	maintenance_mode	false	Enable maintenance mode (true/false)	\N	2025-10-15 09:01:30.656963	2025-10-15 09:01:30.656963
5	max_file_size	52428800	Maximum file upload size in bytes (50MB)	\N	2025-10-15 09:01:30.656963	2025-10-15 09:01:30.656963
6	allowed_file_types	png,jpg,jpeg,pdf,docx,xlsx	Allowed file types for uploads	\N	2025-10-15 09:01:30.656963	2025-10-15 09:01:30.656963
1	app_language	bs	Application language for all users (en/bs)	10	2025-10-16 07:41:17.035295	2025-10-15 09:01:30.656963
\.


--
-- Data for Name: user_action_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) FROM stdin;
49	10	Admin User	admin	create	user	11	Hamza Merdžanić	{"role": "sales", "email": "hamza@kamer.ba", "department": "Sales"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-11 21:14:45.04518
50	10	Admin User	admin	create	user	12	Hamza Čajić	{"role": "technician", "email": "hamza.cajic@kamer.ba", "department": "Technical Support"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-11 21:19:49.912486
51	10	Admin User	admin	create	user	13	Fuad Ferhatović	{"role": "manager", "email": "fuad@kamer.ba", "department": "Technical Manager"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-11 21:20:49.070892
52	10	Admin User	admin	create	user	14	Bilal Alihodžić	{"role": "technician", "email": "bilal@kamer.ba", "department": "Technical Support"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-11 22:31:20.049916
53	14	Bilal Alihodžić	technician	assign	machine	16	HD 5/15 C Plus - 111 222	{"is_sale": false, "model_name": "HD 5/15 C Plus", "sale_price": null, "customer_id": 19, "manufacturer": "Karcher", "customer_name": "Zakir Činjarević", "machine_condition": "new"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-11 22:34:40.007706
54	14	Bilal Alihodžić	technician	create	repair_ticket	16	TK-77/25	{"priority": "high", "customer_name": "Zakir Činjarević", "machine_serial": "111 222"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-11 22:35:23.663565
55	14	Bilal Alihodžić	technician	assign	machine	1	HD 5/15 C Plus - 111 222	{"is_sale": false, "model_name": "HD 5/15 C Plus", "sale_price": null, "customer_id": 1, "manufacturer": "Karcher", "customer_name": "Zakir Činjarević", "machine_condition": "new"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-11 22:43:14.384959
56	14	Bilal Alihodžić	technician	create	repair_ticket	1	TK-78/25	{"priority": "high", "customer_name": "Zakir Činjarević", "machine_serial": "111 222"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-11 22:43:42.69528
57	14	Bilal Alihodžić	technician	delete	repair_ticket	1	TK-78/25	{"customer_name": "Zakir Činjarević", "machine_serial": "111 222"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-11 22:46:34.51795
58	14	Bilal Alihodžić	technician	assign	machine	1	HD 5/15 C Plus - 111 222	{"is_sale": false, "model_name": "HD 5/15 C Plus", "sale_price": null, "customer_id": 1, "manufacturer": "Karcher", "customer_name": "Zakir Činjarević", "machine_condition": "new"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-11 22:48:15.20432
59	14	Bilal Alihodžić	technician	create	repair_ticket	1	TK-1/25	{"priority": "high", "customer_name": "Zakir Činjarević", "machine_serial": "111 222"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-11 22:48:41.258987
60	10	Admin User	admin	delete	repair_ticket	1	TK-1/25	{"customer_name": "Zakir Činjarević", "machine_serial": "111 222"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-11 22:50:59.504784
61	10	Admin User	admin	sell	machine	2	HD 5/15 C Plus - 222 111	{"is_sale": true, "model_name": "HD 5/15 C Plus", "sale_price": "1480.50", "customer_id": 1, "manufacturer": "Karcher", "customer_name": "Zakir Činjarević", "machine_condition": "new"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-11 22:54:50.345739
62	10	Admin User	admin	sell	machine	3	NT 65/2 - 741 852	{"is_sale": true, "model_name": "NT 65/2", "sale_price": "1200.00", "customer_id": 1, "manufacturer": "Karcher", "customer_name": "Zakir Činjarević", "machine_condition": "new"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-12 02:29:59.228279
63	10	Admin User	admin	create	warranty_repair_ticket	1	WT-2/25	{"priority": "medium", "customer_name": "Zakir Činjarević", "machine_serial": "741 852"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-12 02:34:54.492152
64	10	Admin User	admin	assign	machine	4	HDS 8/18-4 C - 698 259	{"is_sale": false, "model_name": "HDS 8/18-4 C", "sale_price": null, "customer_id": 1, "manufacturer": "Karcher", "customer_name": "Zakir Činjarević", "machine_condition": "used"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-12 02:36:48.854649
65	10	Admin User	admin	create	repair_ticket	2	TK-3/25	{"priority": "low", "customer_name": "Zakir Činjarević", "machine_serial": "698 259"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-12 02:37:17.158611
66	10	Admin User	admin	create	repair_ticket	3	TK-01/25	{"priority": "medium", "customer_name": "Zakir Činjarević", "machine_serial": "698 259"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-12 02:47:45.463584
67	10	Admin User	admin	create	repair_ticket	1	TK-01/25	{"priority": "medium", "customer_name": "Zakir Činjarević", "machine_serial": "698 259"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-12 02:56:47.69078
68	12	Hamza Čajić	technician	convert	repair_ticket	1	TK-01/25	{"converted_to": "work_order", "technician_id": 12, "work_order_id": 1, "work_order_number": "WO-01/25"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-12 02:57:19.486726
69	10	Admin User	admin	update	user	13	Fuad Ferhatović	{"role": "manager", "status": "active", "updated_fields": [], "password_changed": true}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-12 21:05:36.30567
70	11	Hamza Merdžanić	sales	create	lead	1	Emir Varupa	{"source": "Cold Call", "sales_stage": "new", "lead_quality": "medium", "potential_value": 10000}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-12 22:16:46.133068
71	11	Hamza Merdžanić	sales	sell	machine	5	HDS 8/18-4 C - 555 666	{"is_sale": true, "model_name": "HDS 8/18-4 C", "sale_price": "7650.00", "customer_id": 1, "manufacturer": "Karcher", "customer_name": "Zakir Činjarević", "machine_condition": "new"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0	2025-10-12 22:32:30.643856
72	10	Admin User	admin	create	user	15	Muhamed Imamović	{"role": "sales", "email": "muhamed@kamer.ba", "department": "Sales"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-13 06:16:50.995574
73	12	Hamza Čajić	technician	update	work_order	1	WO-01/25	{"status_change": {"to": "testing", "from": "pending"}, "updated_fields": ["status", "technician_id", "labor_rate", "total_cost"], "technician_assigned": false}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-10-13 07:04:28.691004
74	12	Hamza Čajić	technician	update	work_order	1	WO-01/25	{"status_change": null, "updated_fields": ["technician_id", "troubleshooting_fee", "total_cost"], "technician_assigned": false}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-10-13 07:05:15.801115
75	12	Hamza Čajić	technician	update	work_order	1	WO-01/25	{"status_change": {"to": "in_progress", "from": "testing"}, "updated_fields": ["status", "technician_id", "total_cost"], "technician_assigned": false}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-10-13 07:05:40.191547
76	12	Hamza Čajić	technician	assign	machine	6	HD 5/15 C Plus - 444 555	{"is_sale": false, "model_name": "HD 5/15 C Plus", "sale_price": "2000.00", "customer_id": 1, "manufacturer": "Karcher", "customer_name": "Zakir Činjarević", "machine_condition": "used"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-10-13 07:34:13.090776
77	12	Hamza Čajić	technician	create	repair_ticket	2	TK-02/25	{"priority": "high", "customer_name": "Zakir Činjarević", "machine_serial": "444 555"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-10-13 07:34:30.025832
78	12	Hamza Čajić	technician	convert	repair_ticket	2	TK-02/25	{"converted_to": "work_order", "technician_id": 12, "work_order_id": 2, "work_order_number": "WO-02/25"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36	2025-10-13 07:35:34.03534
79	10	Admin User	admin	create	user	16	Damir Goković	{"role": "sales", "email": "damir@kamer.ba", "department": "Sales"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-13 08:50:04.74997
80	10	Admin User	admin	create	user	17	Faruk Tupo	{"role": "sales", "email": "faruk@kamer.ba", "department": "Sales"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-13 08:50:45.892406
81	10	Admin User	admin	assign	machine	7	HD 5/15 C Plus - 123 321	{"is_sale": false, "model_name": "HD 5/15 C Plus", "sale_price": null, "customer_id": 2, "manufacturer": "Karcher", "customer_name": "Muhamed Imamović", "machine_condition": "used"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 09:35:57.881301
82	10	Admin User	admin	create	repair_ticket	3	TK-03/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": "123 321"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 09:36:17.528773
83	10	Admin User	admin	create	repair_ticket	4	TK-04/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": "698 259"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 10:36:58.438113
84	10	Admin User	admin	delete	repair_ticket	4	TK-04/25	{"customer_name": "Muhamed Imamović", "machine_serial": "698 259"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 10:42:31.168641
85	10	Admin User	admin	create	repair_ticket	5	TK-05/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": "555 666"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 10:42:56.295064
86	10	Admin User	admin	delete	repair_ticket	5	TK-05/25	{"customer_name": "Muhamed Imamović", "machine_serial": "555 666"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 10:43:47.009785
87	10	Admin User	admin	create	repair_ticket	6	TK-06/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": "444 555"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 10:44:21.259584
88	10	Admin User	admin	delete	repair_ticket	6	TK-06/25	{"customer_name": "Muhamed Imamović", "machine_serial": "444 555"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 10:45:23.707678
89	10	Admin User	admin	create	repair_ticket	7	TK-07/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": "123 321"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 10:48:43.989895
90	10	Admin User	admin	delete	repair_ticket	3	TK-03/25	{"customer_name": "Muhamed Imamović", "machine_serial": "123 321"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 10:49:23.825704
91	10	Admin User	admin	delete	repair_ticket	7	TK-07/25	{"customer_name": "Muhamed Imamović", "machine_serial": "123 321"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 10:49:26.389008
92	10	Admin User	admin	create	repair_ticket	9	TK-08/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 11:03:16.754343
93	10	Admin User	admin	delete	repair_ticket	9	TK-08/25	{"customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 11:20:25.835722
94	10	Admin User	admin	create	repair_ticket	10	TK-09/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 11:28:50.504632
95	10	Admin User	admin	delete	repair_ticket	10	TK-09/25	{"customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 11:42:12.772958
96	10	Admin User	admin	create	repair_ticket	11	TK-10/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 11:49:16.39224
97	10	Admin User	admin	delete	repair_ticket	11	TK-10/25	{"customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 11:55:17.403134
98	10	Admin User	admin	create	repair_ticket	12	TK-11/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 11:55:40.576599
99	10	Admin User	admin	delete	repair_ticket	12	TK-11/25	{"customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 11:59:46.791363
100	10	Admin User	admin	create	repair_ticket	13	TK-12/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:14:15.453038
101	10	Admin User	admin	create	repair_ticket	14	TK-13/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": "789 547"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:21:19.917142
102	10	Admin User	admin	delete	repair_ticket	14	TK-13/25	{"customer_name": "Muhamed Imamović", "machine_serial": "789 547"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:29:05.113784
103	10	Admin User	admin	delete	repair_ticket	13	TK-12/25	{"customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:29:07.433637
104	10	Admin User	admin	create	repair_ticket	15	TK-14/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": "454 544"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:30:07.424167
105	10	Admin User	admin	delete	repair_ticket	15	TK-14/25	{"customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:33:21.425361
106	10	Admin User	admin	create	repair_ticket	16	TK-15/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": "444 123"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:33:57.975561
107	10	Admin User	admin	convert	repair_ticket	16	TK-15/25	{"converted_to": "work_order", "technician_id": 12, "work_order_id": 3, "work_order_number": "WO-15/25"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:37:32.733515
108	10	Admin User	admin	delete	work_order	3	WO-15/25	{"is_warranty": false, "was_converted_from_ticket": true}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:40:04.839436
109	10	Admin User	admin	delete	repair_ticket	16	TK-15/25	{"customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:40:07.562616
110	10	Admin User	admin	create	repair_ticket	17	TK-16/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": "125 896"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:40:40.044664
111	10	Admin User	admin	create	warranty_repair_ticket	1	WT-01/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:44:56.205489
112	10	Admin User	admin	delete	warranty_repair_ticket	1	WT-01/25	{"customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:55:19.991064
113	10	Admin User	admin	create	warranty_repair_ticket	2	WT-02/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 12:56:25.208433
114	10	Admin User	admin	convert	repair_ticket	17	TK-16/25	{"converted_to": "work_order", "technician_id": 12, "work_order_id": 4, "work_order_number": "WO-16/25"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-14 13:01:22.988122
115	10	Admin User	admin	create	repair_ticket	18	TK-17/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": null}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-14 13:34:18.21537
116	10	Admin User	admin	update	work_order	4	WO-16/25	{"status_change": {"to": "testing", "from": "pending"}, "updated_fields": ["status", "technician_id", "labor_rate", "total_cost"], "technician_assigned": false}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-14 14:01:00.448304
117	10	Admin User	admin	update	work_order	4	WO-16/25	{"status_change": null, "updated_fields": ["total_cost"], "technician_assigned": false}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-14 14:01:08.658957
118	10	Admin User	admin	update	work_order	4	WO-16/25	{"status_change": null, "updated_fields": ["technician_id", "total_cost"], "technician_assigned": false}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-14 14:01:18.954618
119	10	Admin User	admin	update	work_order	4	WO-16/25	{"status_change": null, "updated_fields": ["technician_id", "labor_hours", "total_cost"], "technician_assigned": false}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36	2025-10-14 14:01:26.973406
120	10	Admin User	admin	create	warranty_repair_ticket	3	WT-03/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": "5641654"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-15 07:06:05.832239
121	10	Admin User	admin	create	warranty_repair_ticket	4	WT-04/25	{"priority": "medium", "customer_name": "Muhamed Imamović", "machine_serial": "753 698"}	::ffff:127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0	2025-10-15 07:18:07.949358
\.


--
-- Data for Name: user_notification_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_permissions (id, user_id, permission_key, granted, granted_by, granted_at, expires_at, reason) FROM stdin;
\.


--
-- Data for Name: user_permissions_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) FROM stdin;
1	11	sales_targets:read	granted	t	10	2025-10-12 20:48:43.68428	\N
2	11	sales_targets:read	revoked	f	10	2025-10-12 20:49:12.807801	\N
\.


--
-- Data for Name: user_table_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_table_preferences (id, user_id, table_key, visible_columns, created_at, updated_at) FROM stdin;
2	11	repair_tickets	["ticket_number", "customer", "machine", "problem", "status", "priority", "created_at", "submitted_by"]	2025-10-11 22:50:16.672043	2025-10-11 22:50:17.592919
1	10	repair_tickets	["ticket_number", "customer", "machine", "problem", "status", "priority", "created_at", "submitted_by"]	2025-10-11 22:50:06.754147	2025-10-11 22:50:21.894731
3	12	customers	["customer", "type", "contact", "status", "machines", "owner", "total_spent"]	2025-10-13 07:00:57.233497	2025-10-13 07:01:03.550642
4	16	customers	["customer", "type", "contact", "status", "machines", "owner", "total_spent"]	2025-10-14 06:42:34.614292	2025-10-14 06:42:35.2903
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) FROM stdin;
12	Hamza Čajić	hamza.cajic@kamer.ba	technician	2025-10-11 21:19:49.909738	$2b$12$yER7EzoVHgiA/uwAdmytvuB5CGyctewzlxmACaG7Oqf8HJhJ2M86y	t	\N	2025-10-13 07:36:32.791793	+38762157542	Technical Support	active	2025-10-13 07:24:16.235926	2025-10-13 07:36:32.791793+00	2025-10-13 07:36:32.763832
16	Damir Goković	damir@kamer.ba	sales	2025-10-13 08:50:04.747146	$2b$12$XNJVe4e1Szsq.Gygm..MKejpjiA1KgY//yZuNxX1PpDAc7qTKnRby	t	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsImlhdCI6MTc2MDQyMzcyNSwiZXhwIjoxNzYxMDI4NTI1fQ.dwt9V9G3kHLvV702BBZEXKVksLhvFDZGQPh89AUKNs0	2025-10-14 06:53:13.653656	+38761107558	Sales	active	2025-10-14 06:35:25.95245	2025-10-14 06:53:13.653656+00	\N
11	Hamza Merdžanić	hamza@kamer.ba	sales	2025-10-11 21:14:45.041306	$2b$12$S0Biw90qJIT4wBweK33ONuOk4oIQ8SPywir2erPj4Bl.SE3mQ90gu	t	\N	2025-10-20 18:46:06.862699	+38761174610	Sales	active	2025-10-20 18:34:18.301603	2025-10-20 18:46:06.862699+00	2025-10-20 18:46:06.762798
10	Admin User	admin@kamer.ba	admin	2025-10-11 20:04:13.774565	$2b$10$MUDkU1oi5n4tkVpZrqS/quZaVHWr31fW4R9lBmAUUDAKnJZCnmHse	t	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTAsImlhdCI6MTc2MDk4NTk2OSwiZXhwIjoxNzYxNTkwNzY5fQ.0ffZIeJf1V-rYAbq9WJA3QCsRKxt6pKgECrXx9uyxMM	2025-10-20 19:13:45.338751	\N	\N	active	2025-10-20 18:46:09.594462	2025-10-20 19:13:45.338751+00	2025-10-20 18:34:06.926598
17	Faruk Tupo	faruk@kamer.ba	sales	2025-10-13 08:50:45.890566	$2b$12$dMI48iIzgCwzkbObtrhK3.O9skjlG9vciLmSPaia9LDjTDnpjS2vm	t	\N	2025-10-13 08:50:45.890566	+38761216640	Sales	active	\N	2025-10-13 08:50:45.890566+00	\N
14	Bilal Alihodžić	bilal@kamer.ba	technician	2025-10-11 22:31:20.046179	$2b$12$NG1HBKXZjTEhLK6lcS8kru/66MuKeVQ5BnQtsxTSwg03qqgjRwkQ6	t	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTQsImlhdCI6MTc2MDIyMTkwNCwiZXhwIjoxNzYwODI2NzA0fQ.RVVD72fwz42UnPN5HHdqcIySJU1m5-FsqkLpYhv5VYk	2025-10-11 23:31:50.66951	+38762459323	Technical Support	active	2025-10-11 22:31:44.030609	2025-10-11 23:31:50.66951+00	\N
15	Muhamed Imamović	muhamed@kamer.ba	sales	2025-10-13 06:16:50.991705	$2b$12$fJxbeciR6/s4kL3q/.ZSG.NWx7HZqR02Bof53aUXCK2.1huFrDV7e	t	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTUsImlhdCI6MTc2MDM0NTI2MSwiZXhwIjoxNzYwOTUwMDYxfQ.tiOqbozeiNClvq-ht-kY35jhcOLYwvW0VkvySBFsqVc	2025-10-13 09:40:50.481996	+38761368579	Sales	active	2025-10-13 08:47:41.54743	2025-10-13 09:40:50.481996+00	\N
13	Fuad Ferhatović	fuad@kamer.ba	manager	2025-10-11 21:20:49.068718	$2b$10$5j/RJhOBLTwjB0prk5G7VOTOgTVb.e/H6lsiY.HIRwP4/6isTHjxO	t	\N	2025-10-19 17:50:22.661865	+38761712728	Technical Manager	active	2025-10-19 17:49:49.590696	2025-10-19 17:50:22.661865+00	2025-10-19 17:50:22.507904
\.


--
-- Data for Name: warranty_periods; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

COPY public.warranty_periods (id, manufacturer, model_name, warranty_months, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: warranty_repair_tickets; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

COPY public.warranty_repair_tickets (id, ticket_number, customer_id, machine_id, problem_description, notes, additional_equipment, brought_by, submitted_by, status, converted_to_warranty_work_order_id, created_at, updated_at, formatted_number, year_created, converted_at, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) FROM stdin;
2	1	2	25	test	test	test	test	10	converted	1	2025-10-14 12:56:25.163092	2025-10-14 13:06:24.873657	WT-02/25	2025	2025-10-14 13:06:24.873657	f	\N	0.00	\N	unknown	medium
3	2	2	25	test	test	test	test	10	converted	2	2025-10-15 07:06:05.773566	2025-10-15 07:06:11.418699	WT-03/25	2025	2025-10-15 07:06:11.418699	f	\N	0.00	\N	unknown	medium
4	3	2	24	test	test	test	test	10	converted	3	2025-10-15 07:18:07.868528	2025-10-15 07:18:13.105688	WT-04/25	2025	2025-10-15 07:18:13.105688	f	\N	0.00	\N	unknown	medium
\.


--
-- Data for Name: warranty_work_order_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warranty_work_order_inventory (id, warranty_work_order_id, inventory_id, quantity, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: warranty_work_order_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warranty_work_order_notes (id, warranty_work_order_id, content, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: warranty_work_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.warranty_work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, labor_hours, labor_rate, troubleshooting_fee, quote_subtotal_parts, quote_total, converted_from_ticket_id, ticket_number, owner_technician_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, customer_satisfaction_score, upsell_opportunity, recommended_products) FROM stdin;
1	25	2	test	pending	2025-10-14 13:06:24.873657	2025-10-14 13:06:24.873657	12	medium	\N	\N	\N	\N	\N	50.00	0.00	0.00	0.00	2	1	12	WW-02/25	2025	f	\N	\N	\N	\N	f	\N
2	25	2	test	pending	2025-10-15 07:06:11.418699	2025-10-15 07:06:11.418699	12	medium	\N	\N	\N	\N	\N	50.00	0.00	0.00	0.00	3	2	12	WW-03/25	2025	f	\N	\N	\N	\N	f	\N
3	24	2	test	pending	2025-10-15 07:18:13.105688	2025-10-15 07:18:13.105688	12	medium	\N	\N	\N	\N	\N	50.00	0.00	0.00	0.00	4	3	12	WW-04/25	2025	f	\N	\N	\N	\N	f	\N
\.


--
-- Data for Name: work_order_attachments; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

COPY public.work_order_attachments (id, work_order_id, filename, original_name, file_path, file_size, file_type, description, uploaded_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: work_order_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_order_inventory (id, work_order_id, inventory_id, quantity, created_at, updated_at) FROM stdin;
1	4	1	2	2025-10-14 14:01:08.530428	2025-10-14 14:01:08.530428
\.


--
-- Data for Name: work_order_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_order_notes (id, work_order_id, content, created_at, updated_at) FROM stdin;
1	4	Test	2025-10-14 14:01:14.354326	2025-10-14 14:01:14.354326
\.


--
-- Data for Name: work_order_templates; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

COPY public.work_order_templates (id, name, description, category, estimated_hours, required_parts, steps, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: work_order_time_entries; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

COPY public.work_order_time_entries (id, work_order_id, technician_id, start_time, end_time, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: work_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) FROM stdin;
1	4	1	Test	in_progress	2025-10-12 02:57:19.434952	2025-10-13 07:05:40.183792	12	medium	\N	2025-10-13 07:05:40.183792	\N	\N	100.00	f	\N	50.00	\N	\N	\N	\N	100.00	\N	1	1	12	12	WO-01/25	2025	f	\N	\N	\N	\N	\N	f	\N	not_applicable
2	6	1	NE PALI SE	pending	2025-10-13 07:35:33.982504	2025-10-13 07:35:33.982504	12	high	\N	\N	\N	\N	0.00	f	\N	\N	\N	\N	\N	\N	\N	\N	2	2	12	12	WO-02/25	2025	f	\N	\N	\N	\N	\N	f	\N	not_applicable
4	23	2	test	testing	2025-10-14 13:01:22.916856	2025-10-14 14:01:26.967278	12	medium	\N	\N	\N	\N	175.00	f	2.50	50.00	\N	\N	\N	\N	\N	\N	3	17	12	10	WO-16/25	2025	f	\N	\N	\N	\N	\N	f	\N	not_applicable
\.


--
-- Data for Name: yearly_sequences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.yearly_sequences (id, year, prefix, current_sequence, created_at, updated_at) FROM stdin;
1	2025	TK	17	2025-10-12 02:56:47.662423	2025-10-14 13:34:18.192596
2	2025	WT	4	2025-10-14 12:44:56.150192	2025-10-15 07:18:07.868528
\.


--
-- Name: attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attachments_id_seq', 11, true);


--
-- Name: customer_communications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.customer_communications_id_seq', 1, false);


--
-- Name: customer_portal_activity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_portal_activity_id_seq', 312, true);


--
-- Name: customer_portal_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_portal_users_id_seq', 1, true);


--
-- Name: customer_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.customer_preferences_id_seq', 1, false);


--
-- Name: customer_pricing_tiers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_pricing_tiers_id_seq', 4, true);


--
-- Name: customer_tier_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_tier_assignments_id_seq', 1, false);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 2, true);


--
-- Name: demand_tracking_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.demand_tracking_id_seq', 1, false);


--
-- Name: feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.feedback_id_seq', 1, true);


--
-- Name: inventory_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_categories_id_seq', 20, true);


--
-- Name: inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_id_seq', 2, true);


--
-- Name: lead_follow_ups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lead_follow_ups_id_seq', 5, true);


--
-- Name: leads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leads_id_seq', 1, true);


--
-- Name: machine_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.machine_categories_id_seq', 2, true);


--
-- Name: machine_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machine_models_id_seq', 3, true);


--
-- Name: machine_pricing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machine_pricing_id_seq', 2, true);


--
-- Name: machine_rentals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machine_rentals_id_seq', 42, true);


--
-- Name: machine_serials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machine_serials_id_seq', 7, true);


--
-- Name: machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machines_id_seq', 26, true);


--
-- Name: notification_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notification_categories_id_seq', 6, true);


--
-- Name: notification_deliveries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notification_deliveries_id_seq', 1, false);


--
-- Name: notification_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notification_templates_id_seq', 6, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.notifications_id_seq', 134, true);


--
-- Name: pricing_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pricing_history_id_seq', 1, false);


--
-- Name: pricing_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pricing_rules_id_seq', 8, true);


--
-- Name: quote_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quote_items_id_seq', 1, false);


--
-- Name: quote_template_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quote_template_items_id_seq', 9, true);


--
-- Name: quote_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quote_templates_id_seq', 8, true);


--
-- Name: quotes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quotes_id_seq', 1, false);


--
-- Name: rental_machine_status_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rental_machine_status_history_id_seq', 36, true);


--
-- Name: rental_machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rental_machines_id_seq', 5, true);


--
-- Name: rental_status_transition_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rental_status_transition_rules_id_seq', 40, true);


--
-- Name: repair_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repair_tickets_id_seq', 18, true);


--
-- Name: sales_targets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sales_targets_id_seq', 1, false);


--
-- Name: sold_machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sold_machines_id_seq', 7, true);


--
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 1, false);


--
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 5, true);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 13, true);


--
-- Name: ticket_number_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.ticket_number_seq', 1009, true);


--
-- Name: user_action_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_action_logs_id_seq', 121, true);


--
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_notification_preferences_id_seq', 36, true);


--
-- Name: user_permissions_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_permissions_audit_id_seq', 2, true);


--
-- Name: user_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_permissions_id_seq', 12, true);


--
-- Name: user_table_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_table_preferences_id_seq', 4, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 17, true);


--
-- Name: warranty_periods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.warranty_periods_id_seq', 1, false);


--
-- Name: warranty_repair_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.warranty_repair_tickets_id_seq', 4, true);


--
-- Name: warranty_work_order_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warranty_work_order_inventory_id_seq', 1, false);


--
-- Name: warranty_work_order_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warranty_work_order_notes_id_seq', 1, false);


--
-- Name: warranty_work_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warranty_work_orders_id_seq', 3, true);


--
-- Name: work_order_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.work_order_attachments_id_seq', 1, false);


--
-- Name: work_order_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_order_inventory_id_seq', 1, true);


--
-- Name: work_order_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_order_notes_id_seq', 1, true);


--
-- Name: work_order_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.work_order_templates_id_seq', 3, true);


--
-- Name: work_order_time_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.work_order_time_entries_id_seq', 1, false);


--
-- Name: work_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_orders_id_seq', 4, true);


--
-- Name: yearly_sequences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.yearly_sequences_id_seq', 2, true);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: customer_communications customer_communications_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_communications
    ADD CONSTRAINT customer_communications_pkey PRIMARY KEY (id);


--
-- Name: customer_portal_activity customer_portal_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_activity
    ADD CONSTRAINT customer_portal_activity_pkey PRIMARY KEY (id);


--
-- Name: customer_portal_users customer_portal_users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_users
    ADD CONSTRAINT customer_portal_users_email_key UNIQUE (email);


--
-- Name: customer_portal_users customer_portal_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_users
    ADD CONSTRAINT customer_portal_users_pkey PRIMARY KEY (id);


--
-- Name: customer_preferences customer_preferences_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_preferences
    ADD CONSTRAINT customer_preferences_customer_id_key UNIQUE (customer_id);


--
-- Name: customer_preferences customer_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_preferences
    ADD CONSTRAINT customer_preferences_pkey PRIMARY KEY (id);


--
-- Name: customer_pricing_tiers customer_pricing_tiers_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_pricing_tiers
    ADD CONSTRAINT customer_pricing_tiers_name_key UNIQUE (name);


--
-- Name: customer_pricing_tiers customer_pricing_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_pricing_tiers
    ADD CONSTRAINT customer_pricing_tiers_pkey PRIMARY KEY (id);


--
-- Name: customer_tier_assignments customer_tier_assignments_customer_id_tier_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tier_assignments
    ADD CONSTRAINT customer_tier_assignments_customer_id_tier_id_key UNIQUE (customer_id, tier_id);


--
-- Name: customer_tier_assignments customer_tier_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tier_assignments
    ADD CONSTRAINT customer_tier_assignments_pkey PRIMARY KEY (id);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: demand_tracking demand_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_tracking
    ADD CONSTRAINT demand_tracking_pkey PRIMARY KEY (id);


--
-- Name: demand_tracking demand_tracking_rental_machine_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_tracking
    ADD CONSTRAINT demand_tracking_rental_machine_id_date_key UNIQUE (rental_machine_id, date);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_barcode_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_barcode_key UNIQUE (barcode);


--
-- Name: inventory_categories inventory_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_name_key UNIQUE (name);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: lead_follow_ups lead_follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: machine_categories machine_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.machine_categories
    ADD CONSTRAINT machine_categories_name_key UNIQUE (name);


--
-- Name: machine_categories machine_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.machine_categories
    ADD CONSTRAINT machine_categories_pkey PRIMARY KEY (id);


--
-- Name: machine_models machine_models_name_catalogue_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_models
    ADD CONSTRAINT machine_models_name_catalogue_number_key UNIQUE (name, catalogue_number);


--
-- Name: machine_models machine_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_models
    ADD CONSTRAINT machine_models_pkey PRIMARY KEY (id);


--
-- Name: machine_pricing machine_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_pricing
    ADD CONSTRAINT machine_pricing_pkey PRIMARY KEY (id);


--
-- Name: machine_pricing machine_pricing_rental_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_pricing
    ADD CONSTRAINT machine_pricing_rental_machine_id_key UNIQUE (rental_machine_id);


--
-- Name: machine_rentals machine_rentals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals
    ADD CONSTRAINT machine_rentals_pkey PRIMARY KEY (id);


--
-- Name: machine_serials machine_serials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_serials
    ADD CONSTRAINT machine_serials_pkey PRIMARY KEY (id);


--
-- Name: machine_serials machine_serials_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_serials
    ADD CONSTRAINT machine_serials_serial_number_key UNIQUE (serial_number);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- Name: machines machines_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_serial_number_key UNIQUE (serial_number);


--
-- Name: notification_categories notification_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_categories
    ADD CONSTRAINT notification_categories_name_key UNIQUE (name);


--
-- Name: notification_categories notification_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_categories
    ADD CONSTRAINT notification_categories_pkey PRIMARY KEY (id);


--
-- Name: notification_deliveries notification_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_template_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_template_key_key UNIQUE (template_key);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: online_users online_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_users
    ADD CONSTRAINT online_users_pkey PRIMARY KEY (user_id);


--
-- Name: pricing_history pricing_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_history
    ADD CONSTRAINT pricing_history_pkey PRIMARY KEY (id);


--
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: quote_items quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_pkey PRIMARY KEY (id);


--
-- Name: quote_template_items quote_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_template_items
    ADD CONSTRAINT quote_template_items_pkey PRIMARY KEY (id);


--
-- Name: quote_templates quote_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_templates
    ADD CONSTRAINT quote_templates_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_quote_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_quote_number_key UNIQUE (quote_number);


--
-- Name: rental_machine_status_history rental_machine_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machine_status_history
    ADD CONSTRAINT rental_machine_status_history_pkey PRIMARY KEY (id);


--
-- Name: rental_machines rental_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machines
    ADD CONSTRAINT rental_machines_pkey PRIMARY KEY (id);


--
-- Name: rental_machines rental_machines_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machines
    ADD CONSTRAINT rental_machines_serial_number_key UNIQUE (serial_number);


--
-- Name: rental_status_transition_rules rental_status_transition_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_status_transition_rules
    ADD CONSTRAINT rental_status_transition_rules_pkey PRIMARY KEY (id);


--
-- Name: repair_tickets repair_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_pkey PRIMARY KEY (id);


--
-- Name: repair_tickets repair_tickets_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_ticket_number_key UNIQUE (ticket_number);


--
-- Name: sales_targets sales_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- Name: sold_machines sold_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sold_machines
    ADD CONSTRAINT sold_machines_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_name_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_name_key UNIQUE (name);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: sales_targets unique_active_target; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT unique_active_target EXCLUDE USING btree (user_id WITH =, target_type WITH =, target_period_start WITH =) WHERE ((is_active = true));


--
-- Name: customer_portal_users unique_customer_portal_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_users
    ADD CONSTRAINT unique_customer_portal_user UNIQUE (customer_id);


--
-- Name: user_action_logs user_action_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_action_logs
    ADD CONSTRAINT user_action_logs_pkey PRIMARY KEY (id);


--
-- Name: user_notification_preferences user_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_notification_preferences user_notification_preferences_user_id_notification_type_cha_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_notification_type_cha_key UNIQUE (user_id, notification_type, channel);


--
-- Name: user_permissions_audit user_permissions_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions_audit
    ADD CONSTRAINT user_permissions_audit_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_user_id_permission_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_permission_key_key UNIQUE (user_id, permission_key);


--
-- Name: user_table_preferences user_table_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_table_preferences
    ADD CONSTRAINT user_table_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_table_preferences user_table_preferences_user_id_table_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_table_preferences
    ADD CONSTRAINT user_table_preferences_user_id_table_key_key UNIQUE (user_id, table_key);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: warranty_periods warranty_periods_manufacturer_model_name_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_periods
    ADD CONSTRAINT warranty_periods_manufacturer_model_name_key UNIQUE (manufacturer, model_name);


--
-- Name: warranty_periods warranty_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_periods
    ADD CONSTRAINT warranty_periods_pkey PRIMARY KEY (id);


--
-- Name: warranty_repair_tickets warranty_repair_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_pkey PRIMARY KEY (id);


--
-- Name: warranty_repair_tickets warranty_repair_tickets_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_ticket_number_key UNIQUE (ticket_number);


--
-- Name: warranty_work_order_inventory warranty_work_order_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_inventory
    ADD CONSTRAINT warranty_work_order_inventory_pkey PRIMARY KEY (id);


--
-- Name: warranty_work_order_notes warranty_work_order_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_notes
    ADD CONSTRAINT warranty_work_order_notes_pkey PRIMARY KEY (id);


--
-- Name: warranty_work_orders warranty_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_pkey PRIMARY KEY (id);


--
-- Name: work_order_attachments work_order_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_attachments
    ADD CONSTRAINT work_order_attachments_pkey PRIMARY KEY (id);


--
-- Name: work_order_inventory work_order_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_inventory
    ADD CONSTRAINT work_order_inventory_pkey PRIMARY KEY (id);


--
-- Name: work_order_notes work_order_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_notes
    ADD CONSTRAINT work_order_notes_pkey PRIMARY KEY (id);


--
-- Name: work_order_templates work_order_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_templates
    ADD CONSTRAINT work_order_templates_pkey PRIMARY KEY (id);


--
-- Name: work_order_time_entries work_order_time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_time_entries
    ADD CONSTRAINT work_order_time_entries_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_ticket_number_key UNIQUE (ticket_number);


--
-- Name: yearly_sequences yearly_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_sequences
    ADD CONSTRAINT yearly_sequences_pkey PRIMARY KEY (id);


--
-- Name: yearly_sequences yearly_sequences_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_sequences
    ADD CONSTRAINT yearly_sequences_unique UNIQUE (year, prefix);


--
-- Name: idx_assigned_machines_added_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_added_by ON public.sold_machines USING btree (added_by_user_id);


--
-- Name: idx_assigned_machines_condition; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_condition ON public.sold_machines USING btree (machine_condition);


--
-- Name: idx_assigned_machines_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_customer_id ON public.sold_machines USING btree (customer_id);


--
-- Name: idx_assigned_machines_customer_serial; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_customer_serial ON public.sold_machines USING btree (customer_id, serial_id);


--
-- Name: idx_assigned_machines_serial_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_serial_id ON public.sold_machines USING btree (serial_id);


--
-- Name: idx_assigned_machines_serial_model; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_serial_model ON public.sold_machines USING btree (serial_id, customer_id);


--
-- Name: idx_assigned_machines_sold_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_sold_by ON public.sold_machines USING btree (sold_by_user_id);


--
-- Name: idx_attachments_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attachments_active ON public.attachments USING btree (is_active);


--
-- Name: idx_attachments_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attachments_entity ON public.attachments USING btree (entity_type, entity_id);


--
-- Name: idx_attachments_unique_file; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_attachments_unique_file ON public.attachments USING btree (entity_type, entity_id, file_name) WHERE (is_active = true);


--
-- Name: idx_attachments_uploaded_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attachments_uploaded_at ON public.attachments USING btree (uploaded_at);


--
-- Name: idx_attachments_uploaded_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attachments_uploaded_by ON public.attachments USING btree (uploaded_by);


--
-- Name: idx_customer_tier_assignments_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_tier_assignments_active ON public.customer_tier_assignments USING btree (is_active);


--
-- Name: idx_customer_tier_assignments_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_tier_assignments_customer_id ON public.customer_tier_assignments USING btree (customer_id);


--
-- Name: idx_customer_tier_assignments_tier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_tier_assignments_tier_id ON public.customer_tier_assignments USING btree (tier_id);


--
-- Name: idx_customers_contact_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_contact_person ON public.customers USING btree (contact_person);


--
-- Name: idx_customers_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_created_at_status ON public.customers USING btree (created_at DESC, status);


--
-- Name: idx_customers_customer_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_customer_type ON public.customers USING btree (customer_type);


--
-- Name: idx_customers_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_owner_id ON public.customers USING btree (owner_id);


--
-- Name: idx_customers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_status ON public.customers USING btree (status);


--
-- Name: idx_customers_status_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_status_owner ON public.customers USING btree (status, owner_id);


--
-- Name: idx_demand_tracking_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_demand_tracking_date ON public.demand_tracking USING btree (date);


--
-- Name: idx_demand_tracking_demand_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_demand_tracking_demand_level ON public.demand_tracking USING btree (demand_level);


--
-- Name: idx_demand_tracking_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_demand_tracking_machine_id ON public.demand_tracking USING btree (rental_machine_id);


--
-- Name: idx_feedback_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedback_created_at ON public.feedback USING btree (created_at);


--
-- Name: idx_feedback_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedback_priority ON public.feedback USING btree (priority);


--
-- Name: idx_feedback_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedback_status ON public.feedback USING btree (status);


--
-- Name: idx_feedback_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedback_type ON public.feedback USING btree (type);


--
-- Name: idx_feedback_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedback_user_id ON public.feedback USING btree (user_id);


--
-- Name: idx_inventory_categories_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_categories_name ON public.inventory_categories USING btree (name);


--
-- Name: idx_inventory_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_category ON public.inventory USING btree (category);


--
-- Name: idx_inventory_category_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_category_supplier ON public.inventory USING btree (category, supplier);


--
-- Name: idx_inventory_quantity_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_quantity_category ON public.inventory USING btree (quantity, category);


--
-- Name: idx_inventory_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_sku ON public.inventory USING btree (sku);


--
-- Name: idx_inventory_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_supplier ON public.inventory USING btree (supplier);


--
-- Name: idx_inventory_updated_at_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_updated_at_category ON public.inventory USING btree (updated_at DESC, category);


--
-- Name: idx_lead_follow_ups_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_follow_ups_created_at ON public.lead_follow_ups USING btree (created_at);


--
-- Name: idx_lead_follow_ups_lead_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_follow_ups_lead_id ON public.lead_follow_ups USING btree (lead_id);


--
-- Name: idx_leads_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_assigned_to ON public.leads USING btree (assigned_to);


--
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at);


--
-- Name: idx_leads_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_created_by ON public.leads USING btree (created_by);


--
-- Name: idx_leads_lead_quality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_lead_quality ON public.leads USING btree (lead_quality);


--
-- Name: idx_leads_next_follow_up; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_next_follow_up ON public.leads USING btree (next_follow_up);


--
-- Name: idx_leads_quality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_quality ON public.leads USING btree (lead_quality);


--
-- Name: idx_leads_sales_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_sales_stage ON public.leads USING btree (sales_stage);


--
-- Name: idx_leads_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_stage ON public.leads USING btree (sales_stage);


--
-- Name: idx_machine_categories_name; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_machine_categories_name ON public.machine_categories USING btree (name);


--
-- Name: idx_machine_models_catalogue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_catalogue ON public.machine_models USING btree (catalogue_number);


--
-- Name: idx_machine_models_category_manufacturer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_category_manufacturer ON public.machine_models USING btree (category_id, manufacturer);


--
-- Name: idx_machine_models_manufacturer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_manufacturer ON public.machine_models USING btree (manufacturer);


--
-- Name: idx_machine_models_manufacturer_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_manufacturer_name ON public.machine_models USING btree (manufacturer, name);


--
-- Name: idx_machine_models_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_name ON public.machine_models USING btree (name);


--
-- Name: idx_machine_pricing_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_pricing_active ON public.machine_pricing USING btree (is_active);


--
-- Name: idx_machine_pricing_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_pricing_machine_id ON public.machine_pricing USING btree (rental_machine_id);


--
-- Name: idx_machine_rentals_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_rentals_customer ON public.machine_rentals USING btree (customer_id);


--
-- Name: idx_machine_rentals_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_rentals_dates ON public.machine_rentals USING btree (rental_start_date, rental_end_date);


--
-- Name: idx_machine_rentals_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_rentals_status ON public.machine_rentals USING btree (rental_status);


--
-- Name: idx_machine_serials_model_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_serials_model_id ON public.machine_serials USING btree (model_id);


--
-- Name: idx_machine_serials_model_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_serials_model_status ON public.machine_serials USING btree (model_id, status);


--
-- Name: idx_machine_serials_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_serials_status ON public.machine_serials USING btree (status);


--
-- Name: idx_machines_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machines_customer_id ON public.machines USING btree (customer_id);


--
-- Name: idx_machines_received_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machines_received_date ON public.machines USING btree (received_date);


--
-- Name: idx_machines_repair_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machines_repair_status ON public.machines USING btree (repair_status);


--
-- Name: idx_machines_serial_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machines_serial_number ON public.machines USING btree (serial_number);


--
-- Name: idx_notification_deliveries_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_deliveries_channel ON public.notification_deliveries USING btree (channel);


--
-- Name: idx_notification_deliveries_notification_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_deliveries_notification_id ON public.notification_deliveries USING btree (notification_id);


--
-- Name: idx_notification_deliveries_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_deliveries_status ON public.notification_deliveries USING btree (status);


--
-- Name: idx_notification_deliveries_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_deliveries_user_id ON public.notification_deliveries USING btree (user_id);


--
-- Name: idx_notification_templates_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_templates_active ON public.notification_templates USING btree (is_active);


--
-- Name: idx_notification_templates_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_templates_key ON public.notification_templates USING btree (template_key);


--
-- Name: idx_notification_templates_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_templates_type ON public.notification_templates USING btree (notification_type);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_message_key; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_message_key ON public.notifications USING btree (message_key);


--
-- Name: idx_notifications_title_key; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_title_key ON public.notifications USING btree (title_key);


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_online_users_last_activity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_online_users_last_activity ON public.online_users USING btree (last_activity);


--
-- Name: idx_portal_activity_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_activity_action ON public.customer_portal_activity USING btree (action);


--
-- Name: idx_portal_activity_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_activity_created ON public.customer_portal_activity USING btree (created_at DESC);


--
-- Name: idx_portal_activity_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_activity_customer ON public.customer_portal_activity USING btree (customer_id);


--
-- Name: idx_portal_activity_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_activity_entity ON public.customer_portal_activity USING btree (entity_type, entity_id);


--
-- Name: idx_portal_activity_portal_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_activity_portal_user ON public.customer_portal_activity USING btree (portal_user_id);


--
-- Name: idx_portal_activity_tracking; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_activity_tracking ON public.customer_portal_activity USING btree (tracking_number);


--
-- Name: idx_portal_users_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_users_customer_id ON public.customer_portal_users USING btree (customer_id);


--
-- Name: idx_portal_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_users_email ON public.customer_portal_users USING btree (email);


--
-- Name: idx_portal_users_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_users_is_active ON public.customer_portal_users USING btree (is_active);


--
-- Name: idx_portal_users_reset_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_users_reset_token ON public.customer_portal_users USING btree (reset_token);


--
-- Name: idx_portal_users_verification_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_users_verification_token ON public.customer_portal_users USING btree (verification_token);


--
-- Name: idx_pricing_history_changed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pricing_history_changed_at ON public.pricing_history USING btree (changed_at);


--
-- Name: idx_pricing_history_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pricing_history_machine_id ON public.pricing_history USING btree (rental_machine_id);


--
-- Name: idx_pricing_rules_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pricing_rules_active ON public.pricing_rules USING btree (is_active);


--
-- Name: idx_pricing_rules_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pricing_rules_priority ON public.pricing_rules USING btree (priority);


--
-- Name: idx_pricing_rules_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pricing_rules_type ON public.pricing_rules USING btree (rule_type);


--
-- Name: idx_quote_items_quote_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_items_quote_id ON public.quote_items USING btree (quote_id);


--
-- Name: idx_quote_template_items_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_template_items_reference ON public.quote_template_items USING btree (item_reference_id);


--
-- Name: idx_quote_template_items_template; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_template_items_template ON public.quote_template_items USING btree (template_id);


--
-- Name: idx_quote_template_items_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_template_items_type ON public.quote_template_items USING btree (item_type);


--
-- Name: idx_quote_templates_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_templates_active ON public.quote_templates USING btree (is_active);


--
-- Name: idx_quote_templates_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_templates_created_by ON public.quote_templates USING btree (created_by);


--
-- Name: idx_quote_templates_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_templates_type ON public.quote_templates USING btree (template_type);


--
-- Name: idx_quotes_accepted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_accepted_at ON public.quotes USING btree (accepted_at);


--
-- Name: idx_quotes_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_created_at ON public.quotes USING btree (created_at);


--
-- Name: idx_quotes_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_created_by ON public.quotes USING btree (created_by);


--
-- Name: idx_quotes_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_customer_id ON public.quotes USING btree (customer_id);


--
-- Name: idx_quotes_follow_up; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_follow_up ON public.quotes USING btree (follow_up_reminder_date);


--
-- Name: idx_quotes_formatted_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_formatted_number ON public.quotes USING btree (formatted_number);


--
-- Name: idx_quotes_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_parent_id ON public.quotes USING btree (parent_quote_id);


--
-- Name: idx_quotes_sent_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_sent_at ON public.quotes USING btree (sent_at);


--
-- Name: idx_quotes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_status ON public.quotes USING btree (status);


--
-- Name: idx_quotes_template_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_template_id ON public.quotes USING btree (template_id);


--
-- Name: idx_quotes_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_type ON public.quotes USING btree (quote_type);


--
-- Name: idx_quotes_valid_until; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_valid_until ON public.quotes USING btree (valid_until);


--
-- Name: idx_quotes_year_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_year_created ON public.quotes USING btree (year_created);


--
-- Name: idx_rental_machine_status_history_changed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machine_status_history_changed_at ON public.rental_machine_status_history USING btree (changed_at);


--
-- Name: idx_rental_machine_status_history_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machine_status_history_machine_id ON public.rental_machine_status_history USING btree (rental_machine_id);


--
-- Name: idx_rental_machine_status_history_new_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machine_status_history_new_status ON public.rental_machine_status_history USING btree (new_status);


--
-- Name: idx_rental_machines_condition; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machines_condition ON public.rental_machines USING btree (condition);


--
-- Name: idx_rental_machines_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machines_created_by ON public.rental_machines USING btree (created_by);


--
-- Name: idx_rental_machines_model_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machines_model_id ON public.rental_machines USING btree (model_id);


--
-- Name: idx_rental_machines_rental_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machines_rental_status ON public.rental_machines USING btree (rental_status);


--
-- Name: idx_rental_machines_serial_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machines_serial_number ON public.rental_machines USING btree (serial_number);


--
-- Name: idx_repair_tickets_converted_to_warranty_work_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_converted_to_warranty_work_order_id ON public.repair_tickets USING btree (converted_to_warranty_work_order_id);


--
-- Name: idx_repair_tickets_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_created_at_status ON public.repair_tickets USING btree (created_at DESC, status);


--
-- Name: idx_repair_tickets_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_created_by ON public.repair_tickets USING btree (submitted_by);


--
-- Name: idx_repair_tickets_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_customer_id ON public.repair_tickets USING btree (customer_id);


--
-- Name: idx_repair_tickets_customer_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_customer_status ON public.repair_tickets USING btree (customer_id, status);


--
-- Name: idx_repair_tickets_formatted_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_formatted_number ON public.repair_tickets USING btree (formatted_number);


--
-- Name: idx_repair_tickets_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_machine_id ON public.repair_tickets USING btree (machine_id);


--
-- Name: idx_repair_tickets_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_priority ON public.repair_tickets USING btree (priority);


--
-- Name: idx_repair_tickets_repair_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_repair_machine_id ON public.repair_tickets USING btree (repair_machine_id);


--
-- Name: idx_repair_tickets_sales_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_sales_user_id ON public.repair_tickets USING btree (sales_user_id);


--
-- Name: idx_repair_tickets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_status ON public.repair_tickets USING btree (status);


--
-- Name: idx_repair_tickets_status_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_status_priority ON public.repair_tickets USING btree (status, priority);


--
-- Name: idx_repair_tickets_technician_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_technician_status ON public.repair_tickets USING btree (submitted_by, status);


--
-- Name: idx_repair_tickets_ticket_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_ticket_number ON public.repair_tickets USING btree (ticket_number);


--
-- Name: idx_repair_tickets_year_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_year_created ON public.repair_tickets USING btree (year_created);


--
-- Name: idx_sales_targets_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_targets_active ON public.sales_targets USING btree (is_active);


--
-- Name: idx_sales_targets_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_targets_created_by ON public.sales_targets USING btree (created_by);


--
-- Name: idx_sales_targets_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_targets_period ON public.sales_targets USING btree (target_period_start, target_period_end);


--
-- Name: idx_sales_targets_target_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_targets_target_type ON public.sales_targets USING btree (target_type);


--
-- Name: idx_sales_targets_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_targets_user_id ON public.sales_targets USING btree (user_id);


--
-- Name: idx_system_settings_key; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_system_settings_key ON public.system_settings USING btree (setting_key);


--
-- Name: idx_system_settings_updated_at; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_system_settings_updated_at ON public.system_settings USING btree (updated_at);


--
-- Name: idx_system_settings_updated_by; Type: INDEX; Schema: public; Owner: admin
--

CREATE INDEX idx_system_settings_updated_by ON public.system_settings USING btree (updated_by);


--
-- Name: idx_user_action_logs_action_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_action_type ON public.user_action_logs USING btree (action_type);


--
-- Name: idx_user_action_logs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_created ON public.user_action_logs USING btree (created_at DESC);


--
-- Name: idx_user_action_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_entity ON public.user_action_logs USING btree (entity_type, entity_id);


--
-- Name: idx_user_action_logs_entity_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_entity_created ON public.user_action_logs USING btree (entity_type, created_at DESC);


--
-- Name: idx_user_action_logs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_user ON public.user_action_logs USING btree (user_id);


--
-- Name: idx_user_action_logs_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_user_created ON public.user_action_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_user_action_logs_user_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_user_entity ON public.user_action_logs USING btree (user_id, entity_type, created_at DESC);


--
-- Name: idx_user_notification_preferences_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_notification_preferences_channel ON public.user_notification_preferences USING btree (channel);


--
-- Name: idx_user_notification_preferences_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_notification_preferences_type ON public.user_notification_preferences USING btree (notification_type);


--
-- Name: idx_user_notification_preferences_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_notification_preferences_user_id ON public.user_notification_preferences USING btree (user_id);


--
-- Name: idx_user_permissions_audit_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_audit_date ON public.user_permissions_audit USING btree (performed_at);


--
-- Name: idx_user_permissions_audit_performed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_audit_performed_by ON public.user_permissions_audit USING btree (performed_by);


--
-- Name: idx_user_permissions_audit_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_audit_user ON public.user_permissions_audit USING btree (user_id);


--
-- Name: idx_user_permissions_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_expires ON public.user_permissions USING btree (expires_at);


--
-- Name: idx_user_permissions_granted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_granted ON public.user_permissions USING btree (granted);


--
-- Name: idx_user_permissions_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_key ON public.user_permissions USING btree (permission_key);


--
-- Name: idx_user_permissions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- Name: idx_user_table_prefs_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_table_prefs_table ON public.user_table_preferences USING btree (table_key);


--
-- Name: idx_user_table_prefs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_table_prefs_user ON public.user_table_preferences USING btree (user_id);


--
-- Name: idx_user_table_prefs_user_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_table_prefs_user_table ON public.user_table_preferences USING btree (user_id, table_key);


--
-- Name: idx_users_department; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_department ON public.users USING btree (department);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_last_login; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_last_login ON public.users USING btree (last_login);


--
-- Name: idx_users_last_logout; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_last_logout ON public.users USING btree (last_logout);


--
-- Name: idx_users_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_name ON public.users USING btree (name);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: idx_warranty_repair_tickets_converted_at; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_converted_at ON public.warranty_repair_tickets USING btree (converted_at);


--
-- Name: idx_warranty_repair_tickets_created_at_status; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_created_at_status ON public.warranty_repair_tickets USING btree (created_at DESC, status);


--
-- Name: idx_warranty_repair_tickets_customer_id; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_customer_id ON public.warranty_repair_tickets USING btree (customer_id);


--
-- Name: idx_warranty_repair_tickets_customer_status; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_customer_status ON public.warranty_repair_tickets USING btree (customer_id, status);


--
-- Name: idx_warranty_repair_tickets_formatted_number; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_formatted_number ON public.warranty_repair_tickets USING btree (formatted_number);


--
-- Name: idx_warranty_repair_tickets_machine_id; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_machine_id ON public.warranty_repair_tickets USING btree (machine_id);


--
-- Name: idx_warranty_repair_tickets_priority; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_priority ON public.warranty_repair_tickets USING btree (priority);


--
-- Name: idx_warranty_repair_tickets_sales_user_id; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_sales_user_id ON public.warranty_repair_tickets USING btree (sales_user_id);


--
-- Name: idx_warranty_repair_tickets_status; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_status ON public.warranty_repair_tickets USING btree (status);


--
-- Name: idx_warranty_repair_tickets_status_priority; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_status_priority ON public.warranty_repair_tickets USING btree (status, priority);


--
-- Name: idx_warranty_repair_tickets_technician_status; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_technician_status ON public.warranty_repair_tickets USING btree (submitted_by, status);


--
-- Name: idx_warranty_repair_tickets_ticket_number; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_ticket_number ON public.warranty_repair_tickets USING btree (ticket_number);


--
-- Name: idx_warranty_repair_tickets_year_created; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_year_created ON public.warranty_repair_tickets USING btree (year_created);


--
-- Name: idx_warranty_work_orders_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_created_at_status ON public.warranty_work_orders USING btree (created_at DESC, status);


--
-- Name: idx_warranty_work_orders_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_customer_id ON public.warranty_work_orders USING btree (customer_id);


--
-- Name: idx_warranty_work_orders_customer_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_customer_status ON public.warranty_work_orders USING btree (customer_id, status);


--
-- Name: idx_warranty_work_orders_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_due_date ON public.warranty_work_orders USING btree (due_date);


--
-- Name: idx_warranty_work_orders_formatted_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_formatted_number ON public.warranty_work_orders USING btree (formatted_number);


--
-- Name: idx_warranty_work_orders_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_machine_id ON public.warranty_work_orders USING btree (machine_id);


--
-- Name: idx_warranty_work_orders_owner_technician_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_owner_technician_id ON public.warranty_work_orders USING btree (owner_technician_id);


--
-- Name: idx_warranty_work_orders_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_priority ON public.warranty_work_orders USING btree (priority);


--
-- Name: idx_warranty_work_orders_sales_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_sales_user_id ON public.warranty_work_orders USING btree (sales_user_id);


--
-- Name: idx_warranty_work_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_status ON public.warranty_work_orders USING btree (status);


--
-- Name: idx_warranty_work_orders_status_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_status_priority ON public.warranty_work_orders USING btree (status, priority);


--
-- Name: idx_warranty_work_orders_technician_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_technician_id ON public.warranty_work_orders USING btree (technician_id);


--
-- Name: idx_warranty_work_orders_technician_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_technician_status ON public.warranty_work_orders USING btree (owner_technician_id, status);


--
-- Name: idx_warranty_work_orders_ticket_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_ticket_number ON public.warranty_work_orders USING btree (ticket_number);


--
-- Name: idx_warranty_work_orders_year_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_year_created ON public.warranty_work_orders USING btree (year_created);


--
-- Name: idx_work_orders_converted_by_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_converted_by_user_id ON public.work_orders USING btree (converted_by_user_id);


--
-- Name: idx_work_orders_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_created_at ON public.work_orders USING btree (created_at);


--
-- Name: idx_work_orders_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_created_at_status ON public.work_orders USING btree (created_at DESC, status);


--
-- Name: idx_work_orders_customer_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_customer_status ON public.work_orders USING btree (customer_id, status);


--
-- Name: idx_work_orders_formatted_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_formatted_number ON public.work_orders USING btree (formatted_number);


--
-- Name: idx_work_orders_owner_technician_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_owner_technician_id ON public.work_orders USING btree (owner_technician_id);


--
-- Name: idx_work_orders_sales_opportunity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_sales_opportunity ON public.work_orders USING btree (sales_opportunity);


--
-- Name: idx_work_orders_sales_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_sales_stage ON public.work_orders USING btree (sales_stage);


--
-- Name: idx_work_orders_sales_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_sales_user_id ON public.work_orders USING btree (sales_user_id);


--
-- Name: idx_work_orders_status_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_status_priority ON public.work_orders USING btree (status, priority);


--
-- Name: idx_work_orders_technician_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_technician_status ON public.work_orders USING btree (owner_technician_id, status);


--
-- Name: idx_work_orders_ticket_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_ticket_number ON public.work_orders USING btree (ticket_number);


--
-- Name: idx_work_orders_year_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_year_created ON public.work_orders USING btree (year_created);


--
-- Name: machines_unique_serial_when_not_null; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX machines_unique_serial_when_not_null ON public.machines USING btree (name, catalogue_number, serial_number) WHERE (serial_number IS NOT NULL);


--
-- Name: INDEX machines_unique_serial_when_not_null; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.machines_unique_serial_when_not_null IS 'Ensures serial numbers are unique per model when provided, but allows multiple machines with NULL serial numbers for repair shop scenarios';


--
-- Name: rental_machines rental_machine_status_change_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER rental_machine_status_change_trigger AFTER UPDATE ON public.rental_machines FOR EACH ROW EXECUTE FUNCTION public.track_rental_machine_status_change();


--
-- Name: repair_tickets set_formatted_number_repair_tickets; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_formatted_number_repair_tickets BEFORE INSERT ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();


--
-- Name: warranty_repair_tickets set_formatted_number_warranty_repair_tickets; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_formatted_number_warranty_repair_tickets BEFORE INSERT ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();


--
-- Name: warranty_work_orders set_formatted_number_warranty_work_orders; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_formatted_number_warranty_work_orders BEFORE INSERT ON public.warranty_work_orders FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();


--
-- Name: work_orders set_formatted_number_work_orders; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_formatted_number_work_orders BEFORE INSERT ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();


--
-- Name: quotes set_quote_formatted_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_quote_formatted_number BEFORE INSERT OR UPDATE OF quote_number, year_created ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.generate_quote_formatted_number();


--
-- Name: repair_tickets set_ticket_number_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_ticket_number_trigger BEFORE INSERT ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();


--
-- Name: customers set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: machines set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notifications set_updated_at; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: repair_tickets set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: warranty_work_order_inventory set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_order_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: warranty_work_order_notes set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_order_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: warranty_work_orders set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: work_order_inventory set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: work_order_notes set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: work_orders set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sold_machines set_updated_at_assigned_machines; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_assigned_machines BEFORE UPDATE ON public.sold_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory_categories set_updated_at_inventory_categories; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_inventory_categories BEFORE UPDATE ON public.inventory_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lead_follow_ups set_updated_at_lead_follow_ups; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_lead_follow_ups BEFORE UPDATE ON public.lead_follow_ups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: machine_models set_updated_at_machine_models; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_machine_models BEFORE UPDATE ON public.machine_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: machine_pricing set_updated_at_machine_pricing; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_machine_pricing BEFORE UPDATE ON public.machine_pricing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: machine_rentals set_updated_at_machine_rentals; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_machine_rentals BEFORE UPDATE ON public.machine_rentals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: machine_serials set_updated_at_machine_serials; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_machine_serials BEFORE UPDATE ON public.machine_serials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_deliveries set_updated_at_notification_deliveries; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_notification_deliveries BEFORE UPDATE ON public.notification_deliveries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_templates set_updated_at_notification_templates; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_notification_templates BEFORE UPDATE ON public.notification_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pricing_rules set_updated_at_pricing_rules; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_pricing_rules BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: rental_machines set_updated_at_rental_machines; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_rental_machines BEFORE UPDATE ON public.rental_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: machine_categories set_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.machine_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: warranty_periods set_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.warranty_periods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: warranty_repair_tickets set_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: user_notification_preferences set_updated_at_user_notification_preferences; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_user_notification_preferences BEFORE UPDATE ON public.user_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: machines set_warranty_expiry_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_warranty_expiry_trigger BEFORE INSERT OR UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_expiry();


--
-- Name: warranty_repair_tickets set_warranty_ticket_number_trigger; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_warranty_ticket_number_trigger BEFORE INSERT ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();


--
-- Name: machines trg_set_warranty_active; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_set_warranty_active BEFORE INSERT OR UPDATE OF warranty_expiry_date ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_active();


--
-- Name: sold_machines trg_set_warranty_active_assigned_machines; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_set_warranty_active_assigned_machines BEFORE INSERT OR UPDATE OF warranty_expiry_date ON public.sold_machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_active_assigned_machines();


--
-- Name: feedback trigger_update_feedback_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_feedback_updated_at BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.update_feedback_updated_at();


--
-- Name: customer_portal_users update_customer_portal_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_customer_portal_users_updated_at BEFORE UPDATE ON public.customer_portal_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quotes update_quote_status_timestamp_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_quote_status_timestamp_trigger BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_quote_status_timestamp();


--
-- Name: quote_templates update_quote_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_quote_templates_updated_at BEFORE UPDATE ON public.quote_templates FOR EACH ROW EXECUTE FUNCTION public.update_quote_templates_updated_at();


--
-- Name: quotes update_quotes_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_quotes_timestamp BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: sales_targets update_sales_targets_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_sales_targets_updated_at BEFORE UPDATE ON public.sales_targets FOR EACH ROW EXECUTE FUNCTION public.update_sales_targets_updated_at();


--
-- Name: system_settings update_system_settings_updated_at; Type: TRIGGER; Schema: public; Owner: admin
--

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.update_system_settings_updated_at();


--
-- Name: user_table_preferences update_user_table_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_table_preferences_updated_at BEFORE UPDATE ON public.user_table_preferences FOR EACH ROW EXECUTE FUNCTION public.update_user_table_preferences_updated_at();


--
-- Name: user_permissions user_permissions_audit_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_permissions_audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.log_permission_change();


--
-- Name: attachments attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: customer_communications customer_communications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_communications
    ADD CONSTRAINT customer_communications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: customer_communications customer_communications_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_communications
    ADD CONSTRAINT customer_communications_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_portal_activity customer_portal_activity_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_activity
    ADD CONSTRAINT customer_portal_activity_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: customer_portal_activity customer_portal_activity_portal_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_activity
    ADD CONSTRAINT customer_portal_activity_portal_user_id_fkey FOREIGN KEY (portal_user_id) REFERENCES public.customer_portal_users(id) ON DELETE SET NULL;


--
-- Name: customer_portal_users customer_portal_users_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_users
    ADD CONSTRAINT customer_portal_users_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_preferences customer_preferences_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_preferences
    ADD CONSTRAINT customer_preferences_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_tier_assignments customer_tier_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tier_assignments
    ADD CONSTRAINT customer_tier_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- Name: customer_tier_assignments customer_tier_assignments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tier_assignments
    ADD CONSTRAINT customer_tier_assignments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_tier_assignments customer_tier_assignments_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tier_assignments
    ADD CONSTRAINT customer_tier_assignments_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.customer_pricing_tiers(id) ON DELETE CASCADE;


--
-- Name: customers customers_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: demand_tracking demand_tracking_rental_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_tracking
    ADD CONSTRAINT demand_tracking_rental_machine_id_fkey FOREIGN KEY (rental_machine_id) REFERENCES public.rental_machines(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: leads fk_leads_created_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT fk_leads_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: online_users fk_online_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_users
    ADD CONSTRAINT fk_online_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: work_orders fk_work_orders_converted_from_ticket; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT fk_work_orders_converted_from_ticket FOREIGN KEY (converted_from_ticket_id) REFERENCES public.repair_tickets(id) ON DELETE SET NULL;


--
-- Name: inventory inventory_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- Name: lead_follow_ups lead_follow_ups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: lead_follow_ups lead_follow_ups_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: leads leads_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: leads leads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: machine_models machine_models_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_models
    ADD CONSTRAINT machine_models_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.machine_categories(id);


--
-- Name: machine_pricing machine_pricing_rental_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_pricing
    ADD CONSTRAINT machine_pricing_rental_machine_id_fkey FOREIGN KEY (rental_machine_id) REFERENCES public.rental_machines(id) ON DELETE CASCADE;


--
-- Name: machine_rentals machine_rentals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals
    ADD CONSTRAINT machine_rentals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: machine_rentals machine_rentals_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals
    ADD CONSTRAINT machine_rentals_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: machine_serials machine_serials_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_serials
    ADD CONSTRAINT machine_serials_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.machine_models(id) ON DELETE CASCADE;


--
-- Name: machines machines_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.machine_categories(id) ON DELETE SET NULL;


--
-- Name: machines machines_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: machines machines_received_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_received_by_user_id_fkey FOREIGN KEY (received_by_user_id) REFERENCES public.users(id);


--
-- Name: notification_deliveries notification_deliveries_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: notification_deliveries notification_deliveries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: online_users online_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_users
    ADD CONSTRAINT online_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pricing_history pricing_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_history
    ADD CONSTRAINT pricing_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: pricing_history pricing_history_rental_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_history
    ADD CONSTRAINT pricing_history_rental_machine_id_fkey FOREIGN KEY (rental_machine_id) REFERENCES public.rental_machines(id) ON DELETE CASCADE;


--
-- Name: pricing_rules pricing_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: quote_items quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: quote_template_items quote_template_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_template_items
    ADD CONSTRAINT quote_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.quote_templates(id) ON DELETE CASCADE;


--
-- Name: quote_templates quote_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_templates
    ADD CONSTRAINT quote_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: quotes quotes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: quotes quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: rental_machine_status_history rental_machine_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machine_status_history
    ADD CONSTRAINT rental_machine_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: rental_machine_status_history rental_machine_status_history_rental_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machine_status_history
    ADD CONSTRAINT rental_machine_status_history_rental_machine_id_fkey FOREIGN KEY (rental_machine_id) REFERENCES public.rental_machines(id) ON DELETE CASCADE;


--
-- Name: rental_machines rental_machines_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machines
    ADD CONSTRAINT rental_machines_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: rental_machines rental_machines_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machines
    ADD CONSTRAINT rental_machines_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.machine_models(id) ON DELETE CASCADE;


--
-- Name: repair_tickets repair_tickets_converted_to_warranty_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_converted_to_warranty_work_order_id_fkey FOREIGN KEY (converted_to_warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE SET NULL;


--
-- Name: repair_tickets repair_tickets_converted_to_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_converted_to_work_order_id_fkey FOREIGN KEY (converted_to_work_order_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;


--
-- Name: repair_tickets repair_tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_created_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: repair_tickets repair_tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: repair_tickets repair_tickets_repair_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_repair_machine_id_fkey FOREIGN KEY (repair_machine_id) REFERENCES public.machines(id) ON DELETE CASCADE;


--
-- Name: repair_tickets repair_tickets_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sales_targets sales_targets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: sales_targets sales_targets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sold_machines sold_machines_added_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sold_machines
    ADD CONSTRAINT sold_machines_added_by_user_id_fkey FOREIGN KEY (added_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sold_machines sold_machines_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sold_machines
    ADD CONSTRAINT sold_machines_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: sold_machines sold_machines_serial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sold_machines
    ADD CONSTRAINT sold_machines_serial_id_fkey FOREIGN KEY (serial_id) REFERENCES public.machine_serials(id) ON DELETE CASCADE;


--
-- Name: sold_machines sold_machines_sold_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sold_machines
    ADD CONSTRAINT sold_machines_sold_by_user_id_fkey FOREIGN KEY (sold_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stock_movements stock_movements_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: user_action_logs user_action_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_action_logs
    ADD CONSTRAINT user_action_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_notification_preferences user_notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_permissions_audit user_permissions_audit_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions_audit
    ADD CONSTRAINT user_permissions_audit_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: user_permissions user_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_table_preferences user_table_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_table_preferences
    ADD CONSTRAINT user_table_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: warranty_repair_tickets warranty_repair_tickets_converted_to_warranty_work_order_i_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_converted_to_warranty_work_order_i_fkey FOREIGN KEY (converted_to_warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE SET NULL;


--
-- Name: warranty_repair_tickets warranty_repair_tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: warranty_repair_tickets warranty_repair_tickets_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: warranty_repair_tickets warranty_repair_tickets_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: warranty_work_order_inventory warranty_work_order_inventory_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_inventory
    ADD CONSTRAINT warranty_work_order_inventory_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE RESTRICT;


--
-- Name: warranty_work_order_inventory warranty_work_order_inventory_warranty_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_inventory
    ADD CONSTRAINT warranty_work_order_inventory_warranty_work_order_id_fkey FOREIGN KEY (warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE CASCADE;


--
-- Name: warranty_work_order_notes warranty_work_order_notes_warranty_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_notes
    ADD CONSTRAINT warranty_work_order_notes_warranty_work_order_id_fkey FOREIGN KEY (warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE CASCADE;


--
-- Name: warranty_work_orders warranty_work_orders_converted_from_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_converted_from_ticket_id_fkey FOREIGN KEY (converted_from_ticket_id) REFERENCES public.warranty_repair_tickets(id) ON DELETE SET NULL;


--
-- Name: warranty_work_orders warranty_work_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: warranty_work_orders warranty_work_orders_owner_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_owner_technician_id_fkey FOREIGN KEY (owner_technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: warranty_work_orders warranty_work_orders_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: warranty_work_orders warranty_work_orders_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: work_order_attachments work_order_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_attachments
    ADD CONSTRAINT work_order_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: work_order_attachments work_order_attachments_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_attachments
    ADD CONSTRAINT work_order_attachments_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_order_inventory work_order_inventory_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_inventory
    ADD CONSTRAINT work_order_inventory_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE RESTRICT;


--
-- Name: work_order_inventory work_order_inventory_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_inventory
    ADD CONSTRAINT work_order_inventory_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_order_notes work_order_notes_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_notes
    ADD CONSTRAINT work_order_notes_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_order_time_entries work_order_time_entries_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_time_entries
    ADD CONSTRAINT work_order_time_entries_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id);


--
-- Name: work_order_time_entries work_order_time_entries_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_time_entries
    ADD CONSTRAINT work_order_time_entries_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_orders work_orders_converted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_converted_by_user_id_fkey FOREIGN KEY (converted_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: work_orders work_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: work_orders work_orders_owner_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_owner_technician_id_fkey FOREIGN KEY (owner_technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: work_orders work_orders_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: work_orders work_orders_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

REVOKE ALL ON SCHEMA public FROM postgres;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO pg_database_owner;
GRANT ALL ON SCHEMA public TO PUBLIC;
GRANT ALL ON SCHEMA public TO admin;


--
-- Name: TABLE attachments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.attachments TO admin;


--
-- Name: SEQUENCE attachments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.attachments_id_seq TO admin;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customers TO repairadmin;
GRANT ALL ON TABLE public.customers TO admin;


--
-- Name: TABLE machine_models; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.machine_models TO admin;


--
-- Name: TABLE machine_serials; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.machine_serials TO admin;


--
-- Name: TABLE machines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.machines TO repairadmin;
GRANT ALL ON TABLE public.machines TO admin;


--
-- Name: TABLE sold_machines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sold_machines TO admin;


--
-- Name: TABLE customer_all_machines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_all_machines TO admin;


--
-- Name: TABLE customer_communications; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON TABLE public.customer_communications TO admin;


--
-- Name: SEQUENCE customer_communications_id_seq; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON SEQUENCE public.customer_communications_id_seq TO admin;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO repairadmin;
GRANT ALL ON TABLE public.users TO admin;


--
-- Name: TABLE customer_ownership_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_ownership_view TO admin;


--
-- Name: TABLE customer_portal_activity; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_portal_activity TO admin;


--
-- Name: SEQUENCE customer_portal_activity_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customer_portal_activity_id_seq TO admin;


--
-- Name: TABLE customer_portal_users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_portal_users TO admin;


--
-- Name: SEQUENCE customer_portal_users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customer_portal_users_id_seq TO admin;


--
-- Name: TABLE customer_preferences; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON TABLE public.customer_preferences TO admin;


--
-- Name: SEQUENCE customer_preferences_id_seq; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON SEQUENCE public.customer_preferences_id_seq TO admin;


--
-- Name: TABLE customer_pricing_tiers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_pricing_tiers TO admin;


--
-- Name: SEQUENCE customer_pricing_tiers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customer_pricing_tiers_id_seq TO admin;


--
-- Name: TABLE customer_tier_assignments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customer_tier_assignments TO admin;


--
-- Name: SEQUENCE customer_tier_assignments_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customer_tier_assignments_id_seq TO admin;


--
-- Name: SEQUENCE customers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customers_id_seq TO repairadmin;
GRANT ALL ON SEQUENCE public.customers_id_seq TO admin;


--
-- Name: TABLE demand_tracking; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.demand_tracking TO admin;


--
-- Name: SEQUENCE demand_tracking_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.demand_tracking_id_seq TO admin;


--
-- Name: TABLE feedback; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.feedback TO admin;


--
-- Name: SEQUENCE feedback_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.feedback_id_seq TO admin;


--
-- Name: TABLE inventory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventory TO repairadmin;
GRANT ALL ON TABLE public.inventory TO admin;


--
-- Name: TABLE inventory_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventory_categories TO admin;


--
-- Name: SEQUENCE inventory_categories_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.inventory_categories_id_seq TO admin;


--
-- Name: SEQUENCE inventory_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.inventory_id_seq TO repairadmin;
GRANT ALL ON SEQUENCE public.inventory_id_seq TO admin;


--
-- Name: TABLE lead_follow_ups; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.lead_follow_ups TO admin;


--
-- Name: SEQUENCE lead_follow_ups_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.lead_follow_ups_id_seq TO admin;


--
-- Name: TABLE leads; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.leads TO admin;


--
-- Name: SEQUENCE leads_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.leads_id_seq TO admin;


--
-- Name: TABLE machine_categories; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON TABLE public.machine_categories TO admin;


--
-- Name: SEQUENCE machine_categories_id_seq; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON SEQUENCE public.machine_categories_id_seq TO admin;


--
-- Name: SEQUENCE machine_models_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.machine_models_id_seq TO admin;


--
-- Name: TABLE machine_models_with_stats; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.machine_models_with_stats TO admin;


--
-- Name: TABLE machine_pricing; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.machine_pricing TO admin;


--
-- Name: SEQUENCE machine_pricing_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.machine_pricing_id_seq TO admin;


--
-- Name: TABLE machine_rentals; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.machine_rentals TO admin;


--
-- Name: SEQUENCE machine_rentals_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.machine_rentals_id_seq TO admin;


--
-- Name: SEQUENCE machine_serials_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.machine_serials_id_seq TO admin;


--
-- Name: SEQUENCE machines_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.machines_id_seq TO repairadmin;
GRANT ALL ON SEQUENCE public.machines_id_seq TO admin;


--
-- Name: TABLE notification_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_categories TO admin;


--
-- Name: SEQUENCE notification_categories_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.notification_categories_id_seq TO admin;


--
-- Name: TABLE notification_deliveries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_deliveries TO admin;


--
-- Name: SEQUENCE notification_deliveries_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.notification_deliveries_id_seq TO admin;


--
-- Name: TABLE notification_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_templates TO admin;


--
-- Name: SEQUENCE notification_templates_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.notification_templates_id_seq TO admin;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON TABLE public.notifications TO admin;


--
-- Name: SEQUENCE notifications_id_seq; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON SEQUENCE public.notifications_id_seq TO admin;


--
-- Name: TABLE online_users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.online_users TO admin;


--
-- Name: TABLE pricing_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pricing_history TO admin;


--
-- Name: SEQUENCE pricing_history_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.pricing_history_id_seq TO admin;


--
-- Name: TABLE pricing_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pricing_rules TO admin;


--
-- Name: SEQUENCE pricing_rules_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.pricing_rules_id_seq TO admin;


--
-- Name: TABLE quote_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.quote_items TO admin;


--
-- Name: SEQUENCE quote_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.quote_items_id_seq TO admin;


--
-- Name: TABLE quote_template_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.quote_template_items TO admin;


--
-- Name: SEQUENCE quote_template_items_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.quote_template_items_id_seq TO admin;


--
-- Name: TABLE quote_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.quote_templates TO admin;


--
-- Name: SEQUENCE quote_templates_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.quote_templates_id_seq TO admin;


--
-- Name: TABLE quotes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.quotes TO admin;


--
-- Name: SEQUENCE quotes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.quotes_id_seq TO admin;


--
-- Name: TABLE rental_machine_status_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rental_machine_status_history TO admin;


--
-- Name: SEQUENCE rental_machine_status_history_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.rental_machine_status_history_id_seq TO admin;


--
-- Name: TABLE rental_machines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rental_machines TO admin;


--
-- Name: SEQUENCE rental_machines_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.rental_machines_id_seq TO admin;


--
-- Name: TABLE rental_status_transition_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rental_status_transition_rules TO admin;


--
-- Name: SEQUENCE rental_status_transition_rules_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.rental_status_transition_rules_id_seq TO admin;


--
-- Name: TABLE repair_machines_with_details; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.repair_machines_with_details TO admin;


--
-- Name: TABLE repair_tickets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.repair_tickets TO admin;


--
-- Name: SEQUENCE repair_tickets_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.repair_tickets_id_seq TO admin;


--
-- Name: TABLE work_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.work_orders TO repairadmin;
GRANT ALL ON TABLE public.work_orders TO admin;


--
-- Name: TABLE repair_tickets_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.repair_tickets_view TO admin;


--
-- Name: TABLE sales_metrics; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sales_metrics TO admin;


--
-- Name: TABLE sales_opportunities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sales_opportunities TO admin;


--
-- Name: TABLE sales_targets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sales_targets TO admin;


--
-- Name: SEQUENCE sales_targets_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.sales_targets_id_seq TO admin;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON TABLE public.schema_migrations TO admin;


--
-- Name: SEQUENCE sold_machines_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.sold_machines_id_seq TO admin;


--
-- Name: TABLE sold_machines_with_details; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sold_machines_with_details TO admin;


--
-- Name: TABLE stock_movements; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON TABLE public.stock_movements TO admin;


--
-- Name: SEQUENCE stock_movements_id_seq; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON SEQUENCE public.stock_movements_id_seq TO admin;


--
-- Name: TABLE suppliers; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON TABLE public.suppliers TO admin;


--
-- Name: SEQUENCE suppliers_id_seq; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON SEQUENCE public.suppliers_id_seq TO admin;


--
-- Name: SEQUENCE ticket_number_seq; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON SEQUENCE public.ticket_number_seq TO admin;


--
-- Name: TABLE user_action_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_action_logs TO admin;


--
-- Name: SEQUENCE user_action_logs_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_action_logs_id_seq TO admin;


--
-- Name: TABLE user_notification_preferences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_notification_preferences TO admin;


--
-- Name: SEQUENCE user_notification_preferences_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_notification_preferences_id_seq TO admin;


--
-- Name: TABLE user_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_permissions TO admin;


--
-- Name: TABLE user_permissions_audit; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_permissions_audit TO admin;


--
-- Name: SEQUENCE user_permissions_audit_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_permissions_audit_id_seq TO admin;


--
-- Name: SEQUENCE user_permissions_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_permissions_id_seq TO admin;


--
-- Name: TABLE user_table_preferences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_table_preferences TO admin;


--
-- Name: SEQUENCE user_table_preferences_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.user_table_preferences_id_seq TO admin;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.users_id_seq TO repairadmin;
GRANT ALL ON SEQUENCE public.users_id_seq TO admin;


--
-- Name: TABLE warranty_periods; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON TABLE public.warranty_periods TO admin;


--
-- Name: SEQUENCE warranty_periods_id_seq; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON SEQUENCE public.warranty_periods_id_seq TO admin;


--
-- Name: TABLE warranty_repair_tickets; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON TABLE public.warranty_repair_tickets TO admin;


--
-- Name: SEQUENCE warranty_repair_tickets_id_seq; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON SEQUENCE public.warranty_repair_tickets_id_seq TO admin;


--
-- Name: TABLE warranty_work_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.warranty_work_orders TO admin;


--
-- Name: TABLE warranty_repair_tickets_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.warranty_repair_tickets_view TO admin;


--
-- Name: TABLE warranty_work_order_inventory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.warranty_work_order_inventory TO admin;


--
-- Name: SEQUENCE warranty_work_order_inventory_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.warranty_work_order_inventory_id_seq TO admin;


--
-- Name: TABLE warranty_work_order_notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.warranty_work_order_notes TO admin;


--
-- Name: SEQUENCE warranty_work_order_notes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.warranty_work_order_notes_id_seq TO admin;


--
-- Name: SEQUENCE warranty_work_orders_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.warranty_work_orders_id_seq TO admin;


--
-- Name: TABLE warranty_work_orders_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.warranty_work_orders_view TO admin;


--
-- Name: TABLE work_order_attachments; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON TABLE public.work_order_attachments TO admin;


--
-- Name: SEQUENCE work_order_attachments_id_seq; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON SEQUENCE public.work_order_attachments_id_seq TO admin;


--
-- Name: TABLE work_order_inventory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.work_order_inventory TO repairadmin;
GRANT ALL ON TABLE public.work_order_inventory TO admin;


--
-- Name: SEQUENCE work_order_inventory_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.work_order_inventory_id_seq TO repairadmin;
GRANT ALL ON SEQUENCE public.work_order_inventory_id_seq TO admin;


--
-- Name: TABLE work_order_notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.work_order_notes TO admin;


--
-- Name: SEQUENCE work_order_notes_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.work_order_notes_id_seq TO admin;


--
-- Name: TABLE work_order_templates; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON TABLE public.work_order_templates TO admin;


--
-- Name: SEQUENCE work_order_templates_id_seq; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON SEQUENCE public.work_order_templates_id_seq TO admin;


--
-- Name: TABLE work_order_time_entries; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON TABLE public.work_order_time_entries TO admin;


--
-- Name: SEQUENCE work_order_time_entries_id_seq; Type: ACL; Schema: public; Owner: repairadmin
--

GRANT ALL ON SEQUENCE public.work_order_time_entries_id_seq TO admin;


--
-- Name: SEQUENCE work_orders_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.work_orders_id_seq TO repairadmin;
GRANT ALL ON SEQUENCE public.work_orders_id_seq TO admin;


--
-- Name: TABLE work_orders_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.work_orders_view TO admin;


--
-- Name: TABLE yearly_sequences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.yearly_sequences TO admin;


--
-- Name: SEQUENCE yearly_sequences_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.yearly_sequences_id_seq TO admin;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO admin;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO admin;


--
-- PostgreSQL database dump complete
--

\unrestrict FUtVkAQsyJ8z6MpjccHBFRNqAwWBCfTJE53Q8b4LbIb2WHa7Aq1shrs59pvM982

