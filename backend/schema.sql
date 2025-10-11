--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

-- Started on 2025-10-11 14:27:08

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
-- TOC entry 6231 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 400 (class 1255 OID 314398)
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
-- TOC entry 6232 (class 0 OID 0)
-- Dependencies: 400
-- Name: FUNCTION calculate_dynamic_pricing(p_rental_machine_id integer, p_rental_start_date date, p_rental_end_date date, p_customer_id integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.calculate_dynamic_pricing(p_rental_machine_id integer, p_rental_start_date date, p_rental_end_date date, p_customer_id integer) IS 'Calculates dynamic pricing based on rules, demand, and customer tier';


--
-- TOC entry 385 (class 1255 OID 269835)
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
-- TOC entry 379 (class 1255 OID 246262)
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
-- TOC entry 384 (class 1255 OID 253764)
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
-- TOC entry 399 (class 1255 OID 322350)
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
-- TOC entry 406 (class 1255 OID 338709)
-- Name: generate_formatted_number(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_formatted_number(prefix text DEFAULT ''::text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    sequence_num integer;
    current_year integer;
    formatted text;
BEGIN
    sequence_num := get_next_yearly_sequence();
    current_year := EXTRACT(YEAR FROM CURRENT_DATE);
    IF prefix != '' THEN
        formatted := prefix || '-' || sequence_num || '/' || (current_year % 100);
    ELSE
        formatted := sequence_num || '/' || (current_year % 100);
    END IF;
    RETURN formatted;
END;
$$;


ALTER FUNCTION public.generate_formatted_number(prefix text) OWNER TO postgres;

--
-- TOC entry 408 (class 1255 OID 338715)
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
-- TOC entry 405 (class 1255 OID 338708)
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
-- TOC entry 382 (class 1255 OID 246260)
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
-- TOC entry 383 (class 1255 OID 253757)
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
-- TOC entry 403 (class 1255 OID 322348)
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
-- TOC entry 407 (class 1255 OID 338710)
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
-- TOC entry 378 (class 1255 OID 246261)
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
-- TOC entry 381 (class 1255 OID 246267)
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
-- TOC entry 342 (class 1255 OID 32847)
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
-- TOC entry 357 (class 1255 OID 262434)
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
-- TOC entry 380 (class 1255 OID 246263)
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
-- TOC entry 397 (class 1255 OID 314177)
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
-- TOC entry 396 (class 1255 OID 305906)
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
-- TOC entry 366 (class 1255 OID 287842)
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
-- TOC entry 404 (class 1255 OID 338700)
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
-- TOC entry 402 (class 1255 OID 322297)
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
-- TOC entry 343 (class 1255 OID 287840)
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
-- TOC entry 344 (class 1255 OID 32888)
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
-- TOC entry 401 (class 1255 OID 322372)
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
-- TOC entry 398 (class 1255 OID 314179)
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
-- TOC entry 6233 (class 0 OID 0)
-- Dependencies: 398
-- Name: FUNCTION validate_status_transition(p_machine_id integer, p_new_status character varying, p_user_id integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.validate_status_transition(p_machine_id integer, p_new_status character varying, p_user_id integer) IS 'Validates if a status transition is allowed based on business rules';


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
-- TOC entry 6234 (class 0 OID 0)
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
-- TOC entry 6235 (class 0 OID 0)
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
-- TOC entry 6236 (class 0 OID 0)
-- Dependencies: 223
-- Name: COLUMN customers.customer_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.customers.customer_type IS 'Type of customer: private (individual) or company (business)';


--
-- TOC entry 6237 (class 0 OID 0)
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
-- TOC entry 6240 (class 0 OID 0)
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
-- TOC entry 340 (class 1259 OID 338740)
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
-- TOC entry 6241 (class 0 OID 0)
-- Dependencies: 340
-- Name: TABLE customer_portal_activity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customer_portal_activity IS 'Activity log for customer portal usage tracking';


--
-- TOC entry 339 (class 1259 OID 338739)
-- Name: customer_portal_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_portal_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_portal_activity_id_seq OWNER TO postgres;

--
-- TOC entry 6242 (class 0 OID 0)
-- Dependencies: 339
-- Name: customer_portal_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_portal_activity_id_seq OWNED BY public.customer_portal_activity.id;


--
-- TOC entry 338 (class 1259 OID 338718)
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
-- TOC entry 6243 (class 0 OID 0)
-- Dependencies: 338
-- Name: TABLE customer_portal_users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customer_portal_users IS 'Customer accounts for accessing the customer portal';


--
-- TOC entry 6244 (class 0 OID 0)
-- Dependencies: 338
-- Name: COLUMN customer_portal_users.verification_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.customer_portal_users.verification_token IS 'Token for email verification';


--
-- TOC entry 6245 (class 0 OID 0)
-- Dependencies: 338
-- Name: COLUMN customer_portal_users.reset_token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.customer_portal_users.reset_token IS 'Token for password reset';


--
-- TOC entry 337 (class 1259 OID 338717)
-- Name: customer_portal_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_portal_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_portal_users_id_seq OWNER TO postgres;

--
-- TOC entry 6246 (class 0 OID 0)
-- Dependencies: 337
-- Name: customer_portal_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_portal_users_id_seq OWNED BY public.customer_portal_users.id;


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
-- TOC entry 6247 (class 0 OID 0)
-- Dependencies: 242
-- Name: customer_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.customer_preferences_id_seq OWNED BY public.customer_preferences.id;


--
-- TOC entry 320 (class 1259 OID 314352)
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
-- TOC entry 6248 (class 0 OID 0)
-- Dependencies: 320
-- Name: TABLE customer_pricing_tiers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customer_pricing_tiers IS 'Customer pricing tiers with discount levels';


--
-- TOC entry 319 (class 1259 OID 314351)
-- Name: customer_pricing_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_pricing_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_pricing_tiers_id_seq OWNER TO postgres;

--
-- TOC entry 6249 (class 0 OID 0)
-- Dependencies: 319
-- Name: customer_pricing_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_pricing_tiers_id_seq OWNED BY public.customer_pricing_tiers.id;


--
-- TOC entry 322 (class 1259 OID 314368)
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
-- TOC entry 6250 (class 0 OID 0)
-- Dependencies: 322
-- Name: TABLE customer_tier_assignments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customer_tier_assignments IS 'Customer assignments to pricing tiers';


--
-- TOC entry 321 (class 1259 OID 314367)
-- Name: customer_tier_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.customer_tier_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.customer_tier_assignments_id_seq OWNER TO postgres;

--
-- TOC entry 6251 (class 0 OID 0)
-- Dependencies: 321
-- Name: customer_tier_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customer_tier_assignments_id_seq OWNED BY public.customer_tier_assignments.id;


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
-- TOC entry 6252 (class 0 OID 0)
-- Dependencies: 222
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- TOC entry 318 (class 1259 OID 314331)
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
-- TOC entry 6254 (class 0 OID 0)
-- Dependencies: 318
-- Name: TABLE demand_tracking; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.demand_tracking IS 'Daily demand tracking for pricing decisions';


--
-- TOC entry 317 (class 1259 OID 314330)
-- Name: demand_tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.demand_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.demand_tracking_id_seq OWNER TO postgres;

--
-- TOC entry 6255 (class 0 OID 0)
-- Dependencies: 317
-- Name: demand_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.demand_tracking_id_seq OWNED BY public.demand_tracking.id;


--
-- TOC entry 296 (class 1259 OID 305882)
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
    CONSTRAINT feedback_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT feedback_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'resolved'::character varying, 'closed'::character varying])::text[]))),
    CONSTRAINT feedback_type_check CHECK (((type)::text = ANY ((ARRAY['bug'::character varying, 'feature'::character varying, 'improvement'::character varying, 'complaint'::character varying, 'other'::character varying])::text[])))
);


ALTER TABLE public.feedback OWNER TO postgres;

--
-- TOC entry 6256 (class 0 OID 0)
-- Dependencies: 296
-- Name: TABLE feedback; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.feedback IS 'User feedback and bug reports for the repair shop application';


--
-- TOC entry 6257 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN feedback.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.user_id IS 'ID of the user who submitted the feedback';


--
-- TOC entry 6258 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN feedback.message; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.message IS 'The feedback message content';


--
-- TOC entry 6259 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN feedback.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.type IS 'Type of feedback: bug, feature, improvement, complaint, or other';


--
-- TOC entry 6260 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN feedback.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.priority IS 'Priority level: low, medium, high, or urgent';


--
-- TOC entry 6261 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN feedback.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.status IS 'Current status: open, in_progress, resolved, or closed';


--
-- TOC entry 6262 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN feedback.page_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.page_url IS 'URL of the page where feedback was submitted';


--
-- TOC entry 6263 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN feedback.user_agent; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.user_agent IS 'User agent string for debugging';


--
-- TOC entry 6264 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN feedback.admin_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.admin_notes IS 'Admin notes and resolution details';


--
-- TOC entry 6265 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN feedback.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.created_at IS 'When the feedback was created';


--
-- TOC entry 6266 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN feedback.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.updated_at IS 'When the feedback was last updated';


--
-- TOC entry 6267 (class 0 OID 0)
-- Dependencies: 296
-- Name: COLUMN feedback.resolved_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.feedback.resolved_at IS 'When the feedback was resolved';


--
-- TOC entry 295 (class 1259 OID 305881)
-- Name: feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.feedback_id_seq OWNER TO postgres;

--
-- TOC entry 6268 (class 0 OID 0)
-- Dependencies: 295
-- Name: feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.feedback_id_seq OWNED BY public.feedback.id;


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
-- TOC entry 6270 (class 0 OID 0)
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
-- TOC entry 6271 (class 0 OID 0)
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
-- TOC entry 6273 (class 0 OID 0)
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
-- TOC entry 6274 (class 0 OID 0)
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
-- TOC entry 6275 (class 0 OID 0)
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
-- TOC entry 6276 (class 0 OID 0)
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
-- TOC entry 314 (class 1259 OID 314288)
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
-- TOC entry 6277 (class 0 OID 0)
-- Dependencies: 314
-- Name: TABLE machine_pricing; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.machine_pricing IS 'Base pricing for each rental machine';


--
-- TOC entry 313 (class 1259 OID 314287)
-- Name: machine_pricing_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.machine_pricing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.machine_pricing_id_seq OWNER TO postgres;

--
-- TOC entry 6278 (class 0 OID 0)
-- Dependencies: 313
-- Name: machine_pricing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.machine_pricing_id_seq OWNED BY public.machine_pricing.id;


--
-- TOC entry 276 (class 1259 OID 286248)
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
    CONSTRAINT machine_rentals_billing_period_check CHECK (((billing_period)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'monthly'::character varying])::text[]))),
    CONSTRAINT machine_rentals_rental_status_check CHECK (((rental_status)::text = ANY ((ARRAY['active'::character varying, 'reserved'::character varying, 'returned'::character varying, 'overdue'::character varying, 'cancelled'::character varying])::text[])))
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
-- TOC entry 6279 (class 0 OID 0)
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
-- TOC entry 6280 (class 0 OID 0)
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
-- TOC entry 6282 (class 0 OID 0)
-- Dependencies: 224
-- Name: machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.machines_id_seq OWNED BY public.machines.id;


--
-- TOC entry 310 (class 1259 OID 314250)
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
-- TOC entry 6284 (class 0 OID 0)
-- Dependencies: 310
-- Name: TABLE notification_categories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notification_categories IS 'Categories for organizing and prioritizing notifications';


--
-- TOC entry 309 (class 1259 OID 314249)
-- Name: notification_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_categories_id_seq OWNER TO postgres;

--
-- TOC entry 6285 (class 0 OID 0)
-- Dependencies: 309
-- Name: notification_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_categories_id_seq OWNED BY public.notification_categories.id;


--
-- TOC entry 308 (class 1259 OID 314223)
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
-- TOC entry 6286 (class 0 OID 0)
-- Dependencies: 308
-- Name: TABLE notification_deliveries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notification_deliveries IS 'Tracks delivery status of notifications across different channels';


--
-- TOC entry 307 (class 1259 OID 314222)
-- Name: notification_deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_deliveries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_deliveries_id_seq OWNER TO postgres;

--
-- TOC entry 6287 (class 0 OID 0)
-- Dependencies: 307
-- Name: notification_deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_deliveries_id_seq OWNED BY public.notification_deliveries.id;


--
-- TOC entry 306 (class 1259 OID 314206)
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
-- TOC entry 6288 (class 0 OID 0)
-- Dependencies: 306
-- Name: TABLE notification_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.notification_templates IS 'Templates for different types of notifications with variable substitution';


--
-- TOC entry 305 (class 1259 OID 314205)
-- Name: notification_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notification_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_templates_id_seq OWNER TO postgres;

--
-- TOC entry 6289 (class 0 OID 0)
-- Dependencies: 305
-- Name: notification_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notification_templates_id_seq OWNED BY public.notification_templates.id;


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
-- TOC entry 6290 (class 0 OID 0)
-- Dependencies: 248
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: repairadmin
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- TOC entry 316 (class 1259 OID 314309)
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
-- TOC entry 6291 (class 0 OID 0)
-- Dependencies: 316
-- Name: TABLE pricing_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.pricing_history IS 'History of price changes for audit trail';


--
-- TOC entry 315 (class 1259 OID 314308)
-- Name: pricing_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pricing_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pricing_history_id_seq OWNER TO postgres;

--
-- TOC entry 6292 (class 0 OID 0)
-- Dependencies: 315
-- Name: pricing_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pricing_history_id_seq OWNED BY public.pricing_history.id;


--
-- TOC entry 312 (class 1259 OID 314267)
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
-- TOC entry 6293 (class 0 OID 0)
-- Dependencies: 312
-- Name: TABLE pricing_rules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.pricing_rules IS 'Dynamic pricing rules with conditions and adjustments';


--
-- TOC entry 311 (class 1259 OID 314266)
-- Name: pricing_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pricing_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pricing_rules_id_seq OWNER TO postgres;

--
-- TOC entry 6294 (class 0 OID 0)
-- Dependencies: 311
-- Name: pricing_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pricing_rules_id_seq OWNED BY public.pricing_rules.id;


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
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    item_type character varying(50) DEFAULT 'custom'::character varying,
    item_reference_id integer,
    item_name character varying(255),
    total_price numeric(12,2),
    category character varying(100)
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
-- TOC entry 6295 (class 0 OID 0)
-- Dependencies: 280
-- Name: quote_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quote_items_id_seq OWNED BY public.quote_items.id;


--
-- TOC entry 336 (class 1259 OID 338672)
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
-- TOC entry 335 (class 1259 OID 338671)
-- Name: quote_template_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quote_template_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quote_template_items_id_seq OWNER TO postgres;

--
-- TOC entry 6296 (class 0 OID 0)
-- Dependencies: 335
-- Name: quote_template_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quote_template_items_id_seq OWNED BY public.quote_template_items.id;


--
-- TOC entry 334 (class 1259 OID 338653)
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
-- TOC entry 333 (class 1259 OID 338652)
-- Name: quote_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.quote_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quote_templates_id_seq OWNER TO postgres;

--
-- TOC entry 6297 (class 0 OID 0)
-- Dependencies: 333
-- Name: quote_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quote_templates_id_seq OWNED BY public.quote_templates.id;


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
-- TOC entry 6298 (class 0 OID 0)
-- Dependencies: 278
-- Name: quotes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.quotes_id_seq OWNED BY public.quotes.id;


--
-- TOC entry 300 (class 1259 OID 314143)
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
-- TOC entry 6299 (class 0 OID 0)
-- Dependencies: 300
-- Name: TABLE rental_machine_status_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rental_machine_status_history IS 'Tracks all status changes for rental machines with timestamps and reasons';


--
-- TOC entry 299 (class 1259 OID 314142)
-- Name: rental_machine_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rental_machine_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rental_machine_status_history_id_seq OWNER TO postgres;

--
-- TOC entry 6300 (class 0 OID 0)
-- Dependencies: 299
-- Name: rental_machine_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rental_machine_status_history_id_seq OWNED BY public.rental_machine_status_history.id;


--
-- TOC entry 298 (class 1259 OID 314107)
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
    CONSTRAINT rental_machines_condition_check CHECK (((condition)::text = ANY ((ARRAY['excellent'::character varying, 'good'::character varying, 'fair'::character varying, 'poor'::character varying])::text[]))),
    CONSTRAINT rental_machines_rental_status_check CHECK (((rental_status)::text = ANY ((ARRAY['available'::character varying, 'rented'::character varying, 'reserved'::character varying, 'cleaning'::character varying, 'inspection'::character varying, 'maintenance'::character varying, 'repair'::character varying, 'quarantine'::character varying, 'retired'::character varying])::text[])))
);


ALTER TABLE public.rental_machines OWNER TO postgres;

--
-- TOC entry 297 (class 1259 OID 314106)
-- Name: rental_machines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rental_machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rental_machines_id_seq OWNER TO postgres;

--
-- TOC entry 6301 (class 0 OID 0)
-- Dependencies: 297
-- Name: rental_machines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rental_machines_id_seq OWNED BY public.rental_machines.id;


--
-- TOC entry 302 (class 1259 OID 314166)
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
-- TOC entry 6302 (class 0 OID 0)
-- Dependencies: 302
-- Name: TABLE rental_status_transition_rules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rental_status_transition_rules IS 'Defines allowed status transitions and business rules';


--
-- TOC entry 301 (class 1259 OID 314165)
-- Name: rental_status_transition_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rental_status_transition_rules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rental_status_transition_rules_id_seq OWNER TO postgres;

--
-- TOC entry 6303 (class 0 OID 0)
-- Dependencies: 301
-- Name: rental_status_transition_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rental_status_transition_rules_id_seq OWNED BY public.rental_status_transition_rules.id;


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
-- TOC entry 6304 (class 0 OID 0)
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
-- TOC entry 291 (class 1259 OID 289502)
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
-- TOC entry 324 (class 1259 OID 322266)
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
    CONSTRAINT sales_targets_target_type_check CHECK (((target_type)::text = ANY ((ARRAY['monthly'::character varying, 'quarterly'::character varying, 'yearly'::character varying])::text[]))),
    CONSTRAINT valid_target_period CHECK ((target_period_end > target_period_start))
);


ALTER TABLE public.sales_targets OWNER TO postgres;

--
-- TOC entry 323 (class 1259 OID 322265)
-- Name: sales_targets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sales_targets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sales_targets_id_seq OWNER TO postgres;

--
-- TOC entry 6306 (class 0 OID 0)
-- Dependencies: 323
-- Name: sales_targets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sales_targets_id_seq OWNED BY public.sales_targets.id;


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
-- TOC entry 6307 (class 0 OID 0)
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
-- TOC entry 6308 (class 0 OID 0)
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
-- TOC entry 332 (class 1259 OID 330458)
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
-- TOC entry 331 (class 1259 OID 330457)
-- Name: user_action_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_action_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_action_logs_id_seq OWNER TO postgres;

--
-- TOC entry 6309 (class 0 OID 0)
-- Dependencies: 331
-- Name: user_action_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_action_logs_id_seq OWNED BY public.user_action_logs.id;


--
-- TOC entry 304 (class 1259 OID 314181)
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
-- TOC entry 6310 (class 0 OID 0)
-- Dependencies: 304
-- Name: TABLE user_notification_preferences; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_notification_preferences IS 'User preferences for notification delivery and timing';


--
-- TOC entry 303 (class 1259 OID 314180)
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_notification_preferences_id_seq OWNER TO postgres;

--
-- TOC entry 6311 (class 0 OID 0)
-- Dependencies: 303
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_notification_preferences_id_seq OWNED BY public.user_notification_preferences.id;


--
-- TOC entry 326 (class 1259 OID 322302)
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
-- TOC entry 328 (class 1259 OID 322330)
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
    CONSTRAINT valid_audit_action CHECK (((action)::text = ANY ((ARRAY['granted'::character varying, 'revoked'::character varying, 'expired'::character varying, 'updated'::character varying])::text[])))
);


ALTER TABLE public.user_permissions_audit OWNER TO postgres;

--
-- TOC entry 327 (class 1259 OID 322329)
-- Name: user_permissions_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_permissions_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_permissions_audit_id_seq OWNER TO postgres;

--
-- TOC entry 6312 (class 0 OID 0)
-- Dependencies: 327
-- Name: user_permissions_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_permissions_audit_id_seq OWNED BY public.user_permissions_audit.id;


--
-- TOC entry 325 (class 1259 OID 322301)
-- Name: user_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_permissions_id_seq OWNER TO postgres;

--
-- TOC entry 6313 (class 0 OID 0)
-- Dependencies: 325
-- Name: user_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_permissions_id_seq OWNED BY public.user_permissions.id;


--
-- TOC entry 330 (class 1259 OID 322352)
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
-- TOC entry 329 (class 1259 OID 322351)
-- Name: user_table_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_table_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_table_preferences_id_seq OWNER TO postgres;

--
-- TOC entry 6314 (class 0 OID 0)
-- Dependencies: 329
-- Name: user_table_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_table_preferences_id_seq OWNED BY public.user_table_preferences.id;


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
-- TOC entry 6315 (class 0 OID 0)
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
-- TOC entry 6317 (class 0 OID 0)
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
-- TOC entry 6318 (class 0 OID 0)
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
-- TOC entry 292 (class 1259 OID 297689)
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
    am.warranty_active,
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
-- TOC entry 6319 (class 0 OID 0)
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
-- TOC entry 6320 (class 0 OID 0)
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
-- TOC entry 6321 (class 0 OID 0)
-- Dependencies: 254
-- Name: warranty_work_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.warranty_work_orders_id_seq OWNED BY public.warranty_work_orders.id;


--
-- TOC entry 294 (class 1259 OID 297750)
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
     LEFT JOIN public.assigned_machines am ON ((wwo.machine_id = am.id)))
     LEFT JOIN public.machine_serials ms ON ((am.serial_id = ms.id)))
     LEFT JOIN public.machine_models mm ON ((ms.model_id = mm.id)))
     LEFT JOIN public.machine_categories mc ON ((mm.category_id = mc.id)))
     LEFT JOIN public.users tech ON ((wwo.technician_id = tech.id)))
     LEFT JOIN public.users owner_tech ON ((wwo.owner_technician_id = owner_tech.id)));


ALTER VIEW public.warranty_work_orders_view OWNER TO postgres;

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
-- TOC entry 6322 (class 0 OID 0)
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
-- TOC entry 6324 (class 0 OID 0)
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
-- TOC entry 6326 (class 0 OID 0)
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
-- TOC entry 6327 (class 0 OID 0)
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
-- TOC entry 6328 (class 0 OID 0)
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
-- TOC entry 6329 (class 0 OID 0)
-- Dependencies: 226
-- Name: work_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.work_orders_id_seq OWNED BY public.work_orders.id;


--
-- TOC entry 293 (class 1259 OID 297745)
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
     LEFT JOIN public.assigned_machines am ON ((wo.machine_id = am.id)))
     LEFT JOIN public.machine_serials ms ON ((am.serial_id = ms.id)))
     LEFT JOIN public.machine_models mm ON ((ms.model_id = mm.id)))
     LEFT JOIN public.machine_categories mc ON ((mm.category_id = mc.id)))
     LEFT JOIN public.users tech ON ((wo.technician_id = tech.id)))
     LEFT JOIN public.users owner_tech ON ((wo.owner_technician_id = owner_tech.id)));


ALTER VIEW public.work_orders_view OWNER TO postgres;

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
-- TOC entry 6331 (class 0 OID 0)
-- Dependencies: 266
-- Name: yearly_sequences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.yearly_sequences_id_seq OWNED BY public.yearly_sequences.id;


--
-- TOC entry 5257 (class 2604 OID 262395)
-- Name: assigned_machines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigned_machines ALTER COLUMN id SET DEFAULT nextval('public.assigned_machines_id_seq'::regclass);


--
-- TOC entry 5184 (class 2604 OID 62790)
-- Name: customer_communications id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_communications ALTER COLUMN id SET DEFAULT nextval('public.customer_communications_id_seq'::regclass);


--
-- TOC entry 5391 (class 2604 OID 338743)
-- Name: customer_portal_activity id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_activity ALTER COLUMN id SET DEFAULT nextval('public.customer_portal_activity_id_seq'::regclass);


--
-- TOC entry 5386 (class 2604 OID 338721)
-- Name: customer_portal_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_users ALTER COLUMN id SET DEFAULT nextval('public.customer_portal_users_id_seq'::regclass);


--
-- TOC entry 5188 (class 2604 OID 72159)
-- Name: customer_preferences id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_preferences ALTER COLUMN id SET DEFAULT nextval('public.customer_preferences_id_seq'::regclass);


--
-- TOC entry 5353 (class 2604 OID 314355)
-- Name: customer_pricing_tiers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_pricing_tiers ALTER COLUMN id SET DEFAULT nextval('public.customer_pricing_tiers_id_seq'::regclass);


--
-- TOC entry 5359 (class 2604 OID 314371)
-- Name: customer_tier_assignments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tier_assignments ALTER COLUMN id SET DEFAULT nextval('public.customer_tier_assignments_id_seq'::regclass);


--
-- TOC entry 5136 (class 2604 OID 16407)
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- TOC entry 5348 (class 2604 OID 314334)
-- Name: demand_tracking id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_tracking ALTER COLUMN id SET DEFAULT nextval('public.demand_tracking_id_seq'::regclass);


--
-- TOC entry 5299 (class 2604 OID 305885)
-- Name: feedback id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback ALTER COLUMN id SET DEFAULT nextval('public.feedback_id_seq'::regclass);


--
-- TOC entry 5156 (class 2604 OID 16458)
-- Name: inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);


--
-- TOC entry 5296 (class 2604 OID 289254)
-- Name: inventory_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_categories ALTER COLUMN id SET DEFAULT nextval('public.inventory_categories_id_seq'::regclass);


--
-- TOC entry 5292 (class 2604 OID 287874)
-- Name: lead_follow_ups id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_ups ALTER COLUMN id SET DEFAULT nextval('public.lead_follow_ups_id_seq'::regclass);


--
-- TOC entry 5286 (class 2604 OID 287848)
-- Name: leads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads ALTER COLUMN id SET DEFAULT nextval('public.leads_id_seq'::regclass);


--
-- TOC entry 5230 (class 2604 OID 246185)
-- Name: machine_categories id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.machine_categories ALTER COLUMN id SET DEFAULT nextval('public.machine_categories_id_seq'::regclass);


--
-- TOC entry 5249 (class 2604 OID 262360)
-- Name: machine_models id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_models ALTER COLUMN id SET DEFAULT nextval('public.machine_models_id_seq'::regclass);


--
-- TOC entry 5340 (class 2604 OID 314291)
-- Name: machine_pricing id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_pricing ALTER COLUMN id SET DEFAULT nextval('public.machine_pricing_id_seq'::regclass);


--
-- TOC entry 5263 (class 2604 OID 286251)
-- Name: machine_rentals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals ALTER COLUMN id SET DEFAULT nextval('public.machine_rentals_id_seq'::regclass);


--
-- TOC entry 5253 (class 2604 OID 262378)
-- Name: machine_serials id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_serials ALTER COLUMN id SET DEFAULT nextval('public.machine_serials_id_seq'::regclass);


--
-- TOC entry 5142 (class 2604 OID 16419)
-- Name: machines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines ALTER COLUMN id SET DEFAULT nextval('public.machines_id_seq'::regclass);


--
-- TOC entry 5331 (class 2604 OID 314253)
-- Name: notification_categories id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_categories ALTER COLUMN id SET DEFAULT nextval('public.notification_categories_id_seq'::regclass);


--
-- TOC entry 5326 (class 2604 OID 314226)
-- Name: notification_deliveries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_deliveries ALTER COLUMN id SET DEFAULT nextval('public.notification_deliveries_id_seq'::regclass);


--
-- TOC entry 5322 (class 2604 OID 314209)
-- Name: notification_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates ALTER COLUMN id SET DEFAULT nextval('public.notification_templates_id_seq'::regclass);


--
-- TOC entry 5199 (class 2604 OID 169419)
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- TOC entry 5346 (class 2604 OID 314312)
-- Name: pricing_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_history ALTER COLUMN id SET DEFAULT nextval('public.pricing_history_id_seq'::regclass);


--
-- TOC entry 5335 (class 2604 OID 314270)
-- Name: pricing_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules ALTER COLUMN id SET DEFAULT nextval('public.pricing_rules_id_seq'::regclass);


--
-- TOC entry 5279 (class 2604 OID 287819)
-- Name: quote_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items ALTER COLUMN id SET DEFAULT nextval('public.quote_items_id_seq'::regclass);


--
-- TOC entry 5382 (class 2604 OID 338675)
-- Name: quote_template_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_template_items ALTER COLUMN id SET DEFAULT nextval('public.quote_template_items_id_seq'::regclass);


--
-- TOC entry 5376 (class 2604 OID 338656)
-- Name: quote_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_templates ALTER COLUMN id SET DEFAULT nextval('public.quote_templates_id_seq'::regclass);


--
-- TOC entry 5267 (class 2604 OID 287789)
-- Name: quotes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes ALTER COLUMN id SET DEFAULT nextval('public.quotes_id_seq'::regclass);


--
-- TOC entry 5308 (class 2604 OID 314146)
-- Name: rental_machine_status_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machine_status_history ALTER COLUMN id SET DEFAULT nextval('public.rental_machine_status_history_id_seq'::regclass);


--
-- TOC entry 5303 (class 2604 OID 314110)
-- Name: rental_machines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machines ALTER COLUMN id SET DEFAULT nextval('public.rental_machines_id_seq'::regclass);


--
-- TOC entry 5310 (class 2604 OID 314169)
-- Name: rental_status_transition_rules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_status_transition_rules ALTER COLUMN id SET DEFAULT nextval('public.rental_status_transition_rules_id_seq'::regclass);


--
-- TOC entry 5205 (class 2604 OID 228955)
-- Name: repair_tickets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets ALTER COLUMN id SET DEFAULT nextval('public.repair_tickets_id_seq'::regclass);


--
-- TOC entry 5362 (class 2604 OID 322269)
-- Name: sales_targets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets ALTER COLUMN id SET DEFAULT nextval('public.sales_targets_id_seq'::regclass);


--
-- TOC entry 5197 (class 2604 OID 85218)
-- Name: stock_movements id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements ALTER COLUMN id SET DEFAULT nextval('public.stock_movements_id_seq'::regclass);


--
-- TOC entry 5193 (class 2604 OID 85203)
-- Name: suppliers id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.suppliers ALTER COLUMN id SET DEFAULT nextval('public.suppliers_id_seq'::regclass);


--
-- TOC entry 5374 (class 2604 OID 330461)
-- Name: user_action_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_action_logs ALTER COLUMN id SET DEFAULT nextval('public.user_action_logs_id_seq'::regclass);


--
-- TOC entry 5313 (class 2604 OID 314184)
-- Name: user_notification_preferences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_notification_preferences_id_seq'::regclass);


--
-- TOC entry 5366 (class 2604 OID 322305)
-- Name: user_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_id_seq'::regclass);


--
-- TOC entry 5369 (class 2604 OID 322333)
-- Name: user_permissions_audit id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions_audit ALTER COLUMN id SET DEFAULT nextval('public.user_permissions_audit_id_seq'::regclass);


--
-- TOC entry 5371 (class 2604 OID 322355)
-- Name: user_table_preferences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_table_preferences ALTER COLUMN id SET DEFAULT nextval('public.user_table_preferences_id_seq'::regclass);


--
-- TOC entry 5129 (class 2604 OID 16394)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5233 (class 2604 OID 246198)
-- Name: warranty_periods id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_periods ALTER COLUMN id SET DEFAULT nextval('public.warranty_periods_id_seq'::regclass);


--
-- TOC entry 5237 (class 2604 OID 246212)
-- Name: warranty_repair_tickets id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets ALTER COLUMN id SET DEFAULT nextval('public.warranty_repair_tickets_id_seq'::regclass);


--
-- TOC entry 5224 (class 2604 OID 229036)
-- Name: warranty_work_order_inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_inventory ALTER COLUMN id SET DEFAULT nextval('public.warranty_work_order_inventory_id_seq'::regclass);


--
-- TOC entry 5227 (class 2604 OID 229056)
-- Name: warranty_work_order_notes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_notes ALTER COLUMN id SET DEFAULT nextval('public.warranty_work_order_notes_id_seq'::regclass);


--
-- TOC entry 5213 (class 2604 OID 228999)
-- Name: warranty_work_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders ALTER COLUMN id SET DEFAULT nextval('public.warranty_work_orders_id_seq'::regclass);


--
-- TOC entry 5171 (class 2604 OID 43874)
-- Name: work_order_attachments id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_attachments ALTER COLUMN id SET DEFAULT nextval('public.work_order_attachments_id_seq'::regclass);


--
-- TOC entry 5165 (class 2604 OID 16474)
-- Name: work_order_inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_inventory ALTER COLUMN id SET DEFAULT nextval('public.work_order_inventory_id_seq'::regclass);


--
-- TOC entry 5168 (class 2604 OID 24767)
-- Name: work_order_notes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_notes ALTER COLUMN id SET DEFAULT nextval('public.work_order_notes_id_seq'::regclass);


--
-- TOC entry 5179 (class 2604 OID 43918)
-- Name: work_order_templates id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_templates ALTER COLUMN id SET DEFAULT nextval('public.work_order_templates_id_seq'::regclass);


--
-- TOC entry 5175 (class 2604 OID 43896)
-- Name: work_order_time_entries id; Type: DEFAULT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_time_entries ALTER COLUMN id SET DEFAULT nextval('public.work_order_time_entries_id_seq'::regclass);


--
-- TOC entry 5146 (class 2604 OID 16436)
-- Name: work_orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders ALTER COLUMN id SET DEFAULT nextval('public.work_orders_id_seq'::regclass);


--
-- TOC entry 5245 (class 2604 OID 253749)
-- Name: yearly_sequences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_sequences ALTER COLUMN id SET DEFAULT nextval('public.yearly_sequences_id_seq'::regclass);


--
-- TOC entry 6167 (class 0 OID 262392)
-- Dependencies: 273
-- Data for Name: assigned_machines; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (2, 2, 1, '2025-09-06', '2026-09-06', true, 'Kupljena na otoci', '2025-09-06 20:02:01.044394', '2025-09-07 01:33:26.915805', '165165', 6, 6, 'new', '2025-09-06', 1480.50, true, 'Kamer.ba');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (4, 9, 6, '2020-01-01', '2021-06-30', false, NULL, '2025-09-07 02:12:23.860314', '2025-09-07 02:12:23.860314', '5654654', NULL, NULL, 'used', '2020-01-01', NULL, false, 'Greenline d.o.o.');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (1, 1, 3, '2025-09-06', '2026-09-06', true, 'Kupljena u salonu', '2025-09-06 19:55:24.349124', '2025-09-07 02:44:36.984281', '21569', 6, 6, 'new', '2025-09-06', 1480.50, true, 'AMS');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (6, 11, 9, '2024-01-20', '2025-01-20', false, 'usrana', '2025-09-09 19:34:59.52792', '2025-09-09 19:34:59.52792', NULL, NULL, NULL, 'used', '2024-01-20', NULL, false, 'ZEKA doo');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (7, 12, 9, NULL, NULL, false, 'dosla na servis', '2025-09-11 14:29:16.420744', '2025-09-11 14:29:16.420744', NULL, NULL, NULL, 'used', NULL, NULL, false, 'ZEKA doo');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (8, 13, 9, NULL, NULL, false, 'zuzuj', '2025-09-11 14:30:27.201333', '2025-09-11 14:30:27.201333', NULL, NULL, NULL, 'used', NULL, NULL, false, 'Greenline d.o.o.');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (11, 16, 10, '2025-09-12', '2026-09-12', true, 'sadasdas', '2025-09-12 11:48:00.52884', '2025-09-12 11:48:00.52884', '651561561', NULL, NULL, 'new', '2025-09-12', 15000.00, false, 'Kamer.ba');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (12, 17, 10, '2025-09-12', '2026-09-12', true, 'fgrt', '2025-09-12 11:50:04.921504', '2025-09-12 11:50:04.921504', '11955265', 6, 6, 'new', '2025-09-12', 15000.00, true, 'Kamer.ba');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (13, 18, 10, '2025-09-11', '2027-03-11', true, 'iklkjl', '2025-09-12 12:36:47.72051', '2025-09-12 12:36:47.72051', '261651', 1, 1, 'new', '2025-09-11', 12000.00, true, 'Kamer.ba');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (14, 19, 9, '2025-10-08', '2027-04-08', true, 'Test', '2025-10-08 22:15:28.360148', '2025-10-08 22:15:28.360148', '55889', 7, 7, 'new', '2025-10-08', 1500.00, true, 'Kamer.ba');
INSERT INTO public.assigned_machines (id, serial_id, customer_id, purchase_date, warranty_expiry_date, warranty_active, description, assigned_at, updated_at, receipt_number, sold_by_user_id, added_by_user_id, machine_condition, sale_date, sale_price, is_sale, purchased_at) VALUES (15, 20, 18, NULL, NULL, false, 'U lošem stanju', '2025-10-11 09:58:07.846145', '2025-10-11 09:58:07.846145', NULL, NULL, NULL, 'used', NULL, NULL, false, 'Penny');


--
-- TOC entry 6135 (class 0 OID 62787)
-- Dependencies: 241
-- Data for Name: customer_communications; Type: TABLE DATA; Schema: public; Owner: repairadmin
--



--
-- TOC entry 6225 (class 0 OID 338740)
-- Dependencies: 340
-- Data for Name: customer_portal_activity; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (1, NULL, NULL, 'guest_track', 'repair_ticket', 13, 'TK-70/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 11:29:51.376663');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (2, NULL, NULL, 'guest_track', 'work_order', 26, 'WO-70/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 11:30:30.646432');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (3, NULL, NULL, 'guest_track', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 11:47:48.856047');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (4, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 11:48:00.745154');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (5, NULL, NULL, 'guest_track', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 11:49:19.107298');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (6, NULL, NULL, 'guest_track', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 11:53:47.842724');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (7, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 11:53:57.439876');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (8, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 11:53:57.491044');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (9, NULL, NULL, 'guest_track', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 11:54:13.83422');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (10, NULL, NULL, 'guest_track', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 11:54:13.834887');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (11, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 11:54:29.926151');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (12, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 11:54:29.927293');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (13, NULL, NULL, 'guest_track', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:03:48.836477');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (14, NULL, NULL, 'guest_track', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:05:19.924065');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (15, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:05:49.504094');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (16, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:05:49.559061');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (17, NULL, NULL, 'guest_track', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:10:33.853515');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (18, 9, 1, 'register', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:21:41.766581');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (19, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:21:56.368417');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (20, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:21:56.423305');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (21, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:21:56.435133');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (22, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:22:43.705318');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (23, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:22:43.720078');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (24, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:22:58.427148');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (25, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:22:58.438965');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (26, NULL, NULL, 'guest_track', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:25:20.59084');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (27, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:25:26.234055');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (28, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:25:26.290003');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (29, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:25:34.849142');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (30, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:25:34.884749');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (31, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:25:34.892867');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (32, NULL, NULL, 'guest_track', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:33:13.687943');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (33, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:36:11.829648');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (34, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:36:11.890912');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (35, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:36:11.902993');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (36, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:36:29.733011');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (37, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:36:29.748397');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (38, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:37:06.202823');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (39, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:37:06.22295');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (40, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:37:57.238353');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (41, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:37:57.266757');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (42, NULL, NULL, 'guest_track', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:41:57.273605');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (43, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:51:56.783802');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (44, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:51:56.862588');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (45, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 12:51:56.87597');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (46, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 13:44:49.318444');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (47, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 13:44:49.359155');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (48, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 13:46:12.035793');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (49, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 13:46:12.09822');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (50, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 13:46:12.11164');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (51, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 14:14:58.727612');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (52, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 14:14:58.793621');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (53, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 14:14:58.805626');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (54, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 14:15:08.961794');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (55, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 14:15:08.975451');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (56, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 14:15:12.326273');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (57, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 14:15:12.341972');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (58, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:06:27.485636');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (59, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:06:27.541514');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (60, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:06:27.601307');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (61, NULL, NULL, 'guest_track', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:06:53.239648');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (62, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:07:02.458142');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (63, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:07:02.515693');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (64, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:07:16.720596');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (65, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:07:16.763342');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (66, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:07:16.776356');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (67, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:10:40.131591');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (68, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:10:40.154032');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (69, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:15:00.882208');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (70, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:15:00.896128');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (71, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:15:02.465376');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (72, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:15:02.481637');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (73, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:19:46.730944');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (74, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:19:46.759506');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (75, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:19:48.788007');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (76, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:19:48.846486');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (77, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:19:55.381773');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (78, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:19:55.420745');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (79, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:22:04.718524');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (80, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:22:04.759614');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (81, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:28:47.34263');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (82, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:28:47.39917');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (83, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:31:51.740219');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (84, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:31:51.804645');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (85, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:21.447542');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (86, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:21.472946');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (87, 9, 1, 'view_item', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:23.832762');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (88, 9, 1, 'view_item', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:23.854598');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (89, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:33.899216');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (90, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:33.907578');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (91, 9, 1, 'view_item', 'warranty_ticket', 5, 'WT-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:35.578277');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (92, 9, 1, 'view_item', 'warranty_ticket', 5, 'WT-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:35.586368');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (93, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:50.373355');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (94, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:50.38174');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (95, 9, 1, 'view_item', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:51.964644');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (96, 9, 1, 'view_item', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:51.971597');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (97, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:54.919224');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (98, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:33:54.926942');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (99, NULL, NULL, 'guest_track', 'repair_ticket', 11, 'TK-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:35:49.299901');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (100, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:35:53.579298');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (101, NULL, NULL, 'guest_track', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:35:53.641642');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (102, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:36:04.574636');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (103, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:36:04.619575');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (104, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:36:04.630778');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (105, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:36:11.289691');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (106, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:36:11.314574');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (107, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:36:20.53339');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (108, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:36:20.545723');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (109, 9, 1, 'view_item', 'warranty_ticket', 5, 'WT-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:36:22.04968');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (110, 9, 1, 'view_item', 'warranty_ticket', 5, 'WT-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:36:22.060518');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (111, 9, 1, 'view_item', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:36:24.773219');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (112, 9, 1, 'view_item', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:36:24.786374');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (113, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:16.665037');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (114, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:16.687618');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (115, 9, 1, 'view_item', 'warranty_ticket', 5, 'WT-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:18.010797');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (116, 9, 1, 'view_item', 'warranty_ticket', 5, 'WT-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:18.035481');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (117, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:19.127222');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (118, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:19.139176');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (119, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:19.914852');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (120, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:19.934237');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (121, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:21.283297');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (122, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:21.293213');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (123, 9, 1, 'view_item', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:22.573756');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (124, 9, 1, 'view_item', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:22.588024');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (125, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:23.662389');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (126, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:23.673864');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (127, 9, 1, 'view_item', 'warranty_ticket', 5, 'WT-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:24.374001');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (128, 9, 1, 'view_item', 'warranty_ticket', 5, 'WT-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:24.386122');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (129, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:29.628745');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (130, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:29.640438');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (131, 9, 1, 'view_item', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:31.2254');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (132, 9, 1, 'view_item', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:31.236319');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (133, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:33.973475');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (134, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:39:33.985812');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (135, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:43:55.591161');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (136, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:43:55.614794');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (137, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:44:05.092554');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (138, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:44:05.172009');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (139, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:44:05.187495');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (140, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:44:09.646684');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (141, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:44:09.669674');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (142, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:26.721382');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (143, 9, 1, 'view_machine_detail', 'machine', 14, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:31.392079');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (144, 9, 1, 'view_machine_detail', 'machine', 14, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:31.403527');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (145, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:38.670899');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (146, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:38.683584');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (147, 9, 1, 'view_machine_detail', 'machine', 14, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:41.734714');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (148, 9, 1, 'view_machine_detail', 'machine', 14, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:41.748632');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (149, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:44.667499');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (150, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:44.673697');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (151, 9, 1, 'view_machine_detail', 'machine', 8, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:46.110796');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (152, 9, 1, 'view_machine_detail', 'machine', 8, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:46.120204');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (153, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:57.457802');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (154, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:57.467851');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (155, 9, 1, 'view_machine_detail', 'machine', 7, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:58.637561');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (156, 9, 1, 'view_machine_detail', 'machine', 7, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:52:58.653085');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (157, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:53:02.829191');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (158, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:53:02.835894');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (159, 9, 1, 'view_machine_detail', 'machine', 14, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:53:03.48789');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (160, 9, 1, 'view_machine_detail', 'machine', 14, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:53:03.502023');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (161, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:53:10.246343');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (162, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:53:10.255462');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (163, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:53:16.610648');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (164, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:53:16.632747');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (165, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:53:17.939763');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (166, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:53:17.950796');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (167, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:53:19.434328');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (168, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:53:19.444901');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (169, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:55:57.353454');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (170, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:55:57.37096');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (171, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:56:00.046786');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (172, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-10 15:56:00.059402');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (173, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 09:20:03.641443');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (174, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 09:20:03.724658');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (175, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 09:20:03.737867');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (176, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 09:20:12.440545');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (177, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 09:20:12.46557');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (178, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 09:20:18.489618');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (179, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 09:20:18.502572');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (180, NULL, NULL, 'guest_track', 'repair_ticket', 15, 'TK-73/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 09:59:57.634713');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (181, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:19.560538');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (182, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:19.613665');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (183, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:19.624949');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (184, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:24.469868');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (185, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:24.476207');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (186, 9, 1, 'view_machine_detail', 'machine', 14, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:34.243696');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (187, 9, 1, 'view_machine_detail', 'machine', 14, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:34.253082');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (188, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:47.892356');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (189, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:47.900721');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (190, 9, 1, 'view_machine_detail', 'machine', 8, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:50.676341');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (191, 9, 1, 'view_machine_detail', 'machine', 8, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:50.684707');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (192, 9, 1, 'view_item', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:55.729485');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (193, 9, 1, 'view_item', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:00:55.742905');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (194, 9, 1, 'view_item', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:01:35.203019');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (195, 9, 1, 'view_item', 'warranty_work_order', 6, 'WW-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:01:35.22898');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (196, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:04:58.821304');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (197, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:04:58.903843');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (198, NULL, NULL, 'guest_track', 'repair_ticket', 15, 'TK-73/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:07:26.168932');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (199, NULL, NULL, 'guest_track', 'repair_ticket', 15, 'TK-73/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:07:47.14496');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (200, NULL, NULL, 'guest_track', 'repair_ticket', 15, 'TK-73/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:07:47.203124');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (201, NULL, NULL, 'guest_track', 'repair_ticket', 15, 'TK-73/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:07:51.889766');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (202, NULL, NULL, 'guest_track', 'repair_ticket', 15, 'TK-73/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 10:07:51.890236');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (203, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:47:36.183767');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (204, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:47:36.235375');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (205, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:47:36.252893');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (206, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:47:41.114995');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (207, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:47:41.129806');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (208, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:48:15.725618');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (209, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:48:15.758575');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (210, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:48:15.775112');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (211, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:48:29.455299');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (212, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:48:29.476683');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (213, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:48:49.792641');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (214, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:48:49.805275');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (215, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:52:10.21989');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (216, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:52:10.299534');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (217, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:52:10.312954');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (218, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:52:22.347485');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (219, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:52:22.357181');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (220, 9, 1, 'view_machine_detail', 'machine', 14, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:52:29.620003');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (221, 9, 1, 'view_machine_detail', 'machine', 14, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:52:29.635569');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (222, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:52:31.170468');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (223, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:52:31.182627');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (224, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:53:00.001495');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (225, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:53:00.035943');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (226, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:53:00.052494');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (227, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:54:02.775492');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (228, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:54:02.886614');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (229, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:54:02.92296');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (230, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:59:09.650852');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (231, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:59:09.728122');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (232, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 12:59:09.741953');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (233, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:04:36.412469');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (234, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:04:36.509459');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (235, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:04:36.52381');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (236, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:14:38.14926');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (237, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:14:38.222483');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (238, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:14:38.235579');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (239, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:14:40.415958');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (240, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:14:40.422262');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (241, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:14:41.202742');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (242, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:14:41.21886');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (243, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:14:47.534721');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (244, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:14:47.548482');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (245, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:14:50.277521');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (246, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:14:50.302658');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (247, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:14:50.316474');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (248, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:16:08.631922');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (249, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:16:08.715199');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (250, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:16:08.725801');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (251, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:16:12.448504');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (252, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:16:12.461023');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (253, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:22:11.136632');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (254, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:22:11.235427');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (255, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:22:11.247934');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (256, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:22:13.055956');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (257, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:22:13.067406');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (258, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:22:27.973397');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (259, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:22:28.024299');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (260, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:22:28.040249');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (261, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:22:30.465111');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (262, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:22:30.475306');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (263, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:53.564913');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (264, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:53.591829');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (265, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:56.506506');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (266, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:56.552275');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (267, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:56.561');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (268, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:57.149315');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (269, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:57.160628');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (270, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:57.734805');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (271, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:57.745636');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (272, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:58.402933');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (273, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:58.412413');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (274, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:59.005472');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (275, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:59.063927');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (276, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:59.50233');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (277, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:26:59.512032');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (278, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:27:00.120541');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (279, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:27:00.128661');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (280, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:44:04.969503');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (281, 9, 1, 'view_item', 'work_order', 16, 'WO-67/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:44:05.009167');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (282, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:44:07.68895');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (283, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:44:07.698092');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (284, 9, 1, 'view_item', 'warranty_ticket', 5, 'WT-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:44:09.890145');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (285, 9, 1, 'view_item', 'warranty_ticket', 5, 'WT-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:44:09.899057');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (286, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:44:10.897413');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (287, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:44:10.908077');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (288, 9, 1, 'view_item', 'warranty_ticket', 5, 'WT-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:44:12.873304');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (289, 9, 1, 'view_item', 'warranty_ticket', 5, 'WT-68/25', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:44:12.882985');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (290, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:44:13.750664');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (291, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:44:13.760587');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (292, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:58:56.196413');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (293, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:58:56.271252');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (294, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:58:56.28189');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (295, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:58:57.482569');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (296, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:58:57.495884');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (297, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:59:00.635916');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (298, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:59:00.647106');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (299, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:59:01.419259');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (300, 9, 1, 'view_machines', 'machines', NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:59:01.429306');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (301, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:59:03.575157');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (302, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 13:59:03.59076');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (303, 9, 1, 'login', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 14:16:01.022517');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (304, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 14:16:01.071501');
INSERT INTO public.customer_portal_activity (id, customer_id, portal_user_id, action, entity_type, entity_id, tracking_number, ip_address, user_agent, details, created_at) VALUES (305, 9, 1, 'view_dashboard', NULL, NULL, NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', NULL, '2025-10-11 14:16:01.080711');


--
-- TOC entry 6223 (class 0 OID 338718)
-- Dependencies: 338
-- Data for Name: customer_portal_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.customer_portal_users (id, customer_id, email, password_hash, is_verified, verification_token, verification_token_expires, reset_token, reset_token_expires, is_active, last_login, created_at, updated_at) VALUES (1, 9, 'zakir@gmail.com', '$2b$10$2mPDKIy08YO3oIYl.MFvK.UlozxhCJL0.jL7RyWbC0j56KiKG0zaO', true, '06624923f6db29ffbeb15f915232e05152ffc96efa826892300c3500334b82c6', '2025-10-11 12:21:41.761', NULL, NULL, true, '2025-10-11 14:16:01.018945', '2025-10-10 12:21:41.762237', '2025-10-11 14:16:01.018945');


--
-- TOC entry 6137 (class 0 OID 72156)
-- Dependencies: 243
-- Data for Name: customer_preferences; Type: TABLE DATA; Schema: public; Owner: repairadmin
--



--
-- TOC entry 6205 (class 0 OID 314352)
-- Dependencies: 320
-- Data for Name: customer_pricing_tiers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.customer_pricing_tiers (id, name, description, discount_percentage, minimum_rentals, minimum_total_spent, is_active, created_at) VALUES (1, 'Standard', 'Standard pricing for all customers', 0.00, 0, 0.00, true, '2025-09-19 15:01:21.12143');
INSERT INTO public.customer_pricing_tiers (id, name, description, discount_percentage, minimum_rentals, minimum_total_spent, is_active, created_at) VALUES (2, 'Frequent', 'Frequent customers with 5+ rentals', 5.00, 5, 0.00, true, '2025-09-19 15:01:21.12143');
INSERT INTO public.customer_pricing_tiers (id, name, description, discount_percentage, minimum_rentals, minimum_total_spent, is_active, created_at) VALUES (3, 'VIP', 'VIP customers with 20+ rentals or €10,000+ spent', 10.00, 20, 10000.00, true, '2025-09-19 15:01:21.12143');
INSERT INTO public.customer_pricing_tiers (id, name, description, discount_percentage, minimum_rentals, minimum_total_spent, is_active, created_at) VALUES (4, 'Enterprise', 'Enterprise customers with 50+ rentals or €25,000+ spent', 15.00, 50, 25000.00, true, '2025-09-19 15:01:21.12143');


--
-- TOC entry 6207 (class 0 OID 314368)
-- Dependencies: 322
-- Data for Name: customer_tier_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 6117 (class 0 OID 16404)
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
INSERT INTO public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) VALUES (17, 'test', '21651561', 'test@test.com', '2025-09-11 15:29:53.02287', '2025-09-12 02:09:52.714218', '', '', 'sdgsdsdg', '6265561', 'sdfsdfsdf', '651651651', '15651561', 6, '2025-09-11 15:29:53.02287', 'asdsadfasf', 'active', 'private', '');
INSERT INTO public.customers (id, name, phone, email, created_at, updated_at, company_name, vat_number, city, postal_code, street_address, phone2, fax, owner_id, assigned_at, ownership_notes, status, customer_type, contact_person) VALUES (18, 'Adnan Rovčanin', '061 061 061', 'adnan@gmail.com', '2025-10-11 09:57:07.506239', '2025-10-11 09:57:07.506239', '', '', 'Vogošća', '71320', 'AHmeda Rizve br 2', '062 062 062', '', 5, '2025-10-11 09:57:07.506239', 'Dobarlik VIP', 'active', 'private', '');


--
-- TOC entry 6203 (class 0 OID 314331)
-- Dependencies: 318
-- Data for Name: demand_tracking; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 6181 (class 0 OID 305882)
-- Dependencies: 296
-- Data for Name: feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.feedback (id, user_id, message, type, priority, status, page_url, user_agent, admin_notes, created_at, updated_at, resolved_at) VALUES (1, 7, 'provjeriti update kartica i statistike', 'improvement', 'high', 'closed', '/dashboard/overview', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0', '', '2025-09-13 02:32:50.234+02', '2025-09-13 04:01:29.378011+02', NULL);
INSERT INTO public.feedback (id, user_id, message, type, priority, status, page_url, user_agent, admin_notes, created_at, updated_at, resolved_at) VALUES (8, 5, 'test', 'bug', 'medium', 'closed', '/dashboard/my-work', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0', '', '2025-09-13 03:06:25.599+02', '2025-09-13 04:01:39.629173+02', NULL);
INSERT INTO public.feedback (id, user_id, message, type, priority, status, page_url, user_agent, admin_notes, created_at, updated_at, resolved_at) VALUES (7, 5, 'test 4', 'bug', 'medium', 'closed', '/dashboard/my-work', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0', '', '2025-09-13 03:01:57.514+02', '2025-09-13 04:01:46.461829+02', NULL);
INSERT INTO public.feedback (id, user_id, message, type, priority, status, page_url, user_agent, admin_notes, created_at, updated_at, resolved_at) VALUES (6, 5, 'test', 'bug', 'medium', 'closed', '/dashboard/my-work', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0', '', '2025-09-13 02:58:58.456+02', '2025-09-13 04:01:53.826736+02', NULL);
INSERT INTO public.feedback (id, user_id, message, type, priority, status, page_url, user_agent, admin_notes, created_at, updated_at, resolved_at) VALUES (5, 5, 'test', 'complaint', 'medium', 'closed', '/dashboard/my-work', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0', '', '2025-09-13 02:55:18.593+02', '2025-09-13 04:01:57.491209+02', NULL);
INSERT INTO public.feedback (id, user_id, message, type, priority, status, page_url, user_agent, admin_notes, created_at, updated_at, resolved_at) VALUES (4, 4, 'test', 'bug', 'medium', 'closed', '/dashboard/my-work', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0', '', '2025-09-13 02:53:42.161+02', '2025-09-13 04:02:00.827575+02', NULL);
INSERT INTO public.feedback (id, user_id, message, type, priority, status, page_url, user_agent, admin_notes, created_at, updated_at, resolved_at) VALUES (3, 8, 'Test', 'other', 'medium', 'closed', '/dashboard/my-work', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0', '', '2025-09-13 02:49:39.874+02', '2025-09-13 04:02:04.190681+02', NULL);
INSERT INTO public.feedback (id, user_id, message, type, priority, status, page_url, user_agent, admin_notes, created_at, updated_at, resolved_at) VALUES (2, 5, 'Preružan dizajn printa', 'complaint', 'medium', 'closed', '/repair-tickets', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0', '', '2025-09-13 02:40:18.084+02', '2025-09-13 04:02:08.157358+02', NULL);
INSERT INTO public.feedback (id, user_id, message, type, priority, status, page_url, user_agent, admin_notes, created_at, updated_at, resolved_at) VALUES (9, 5, 'terst', 'complaint', 'high', 'resolved', '/customers', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0', '', '2025-09-17 14:28:37.111+02', '2025-09-17 14:29:21.339021+02', '2025-09-17 14:29:21.337+02');
INSERT INTO public.feedback (id, user_id, message, type, priority, status, page_url, user_agent, admin_notes, created_at, updated_at, resolved_at) VALUES (10, 6, 'kojkonkjnij', 'other', 'medium', 'open', '/customers', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0', NULL, '2025-09-17 22:12:41.376+02', '2025-09-17 22:12:41.376+02', NULL);


--
-- TOC entry 6123 (class 0 OID 16455)
-- Dependencies: 229
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.inventory (id, name, description, quantity, created_at, unit_price, updated_at, part_number, barcode, category, reorder_level, supplier_id, location, min_order_quantity, lead_time_days, min_stock_level, supplier, sku) VALUES (1, 'Set gumica TR', 'Gumice za crijevo i pištolj.', 84, '2025-09-07 23:16:23.181442', 25.00, '2025-10-11 12:39:50.659448', NULL, NULL, 'Visoki pritisak', 5, NULL, 'Veleprodaja, K1 polica', 1, 7, 5, 'Karcher', '2.880-001.0');


--
-- TOC entry 6179 (class 0 OID 289251)
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
-- TOC entry 6177 (class 0 OID 287871)
-- Dependencies: 285
-- Data for Name: lead_follow_ups; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.lead_follow_ups (id, lead_id, notes, action_taken, outcome, created_by, created_at, follow_up_date, follow_up_type, completed, completed_at, updated_at) VALUES (4, 2, 'test', NULL, NULL, 6, '2025-09-09 23:13:30.118806', '2025-09-10 00:00:00', 'meeting', true, '2025-09-09 23:35:02.426016', '2025-09-09 23:35:02.426016');
INSERT INTO public.lead_follow_ups (id, lead_id, notes, action_taken, outcome, created_by, created_at, follow_up_date, follow_up_type, completed, completed_at, updated_at) VALUES (5, 3, 'klinac', NULL, NULL, 5, '2025-09-10 11:44:27.960694', '2025-09-12 00:00:00', 'proposal', false, NULL, '2025-09-10 11:44:27.960694');


--
-- TOC entry 6175 (class 0 OID 287845)
-- Dependencies: 283
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.leads (id, customer_name, company_name, email, phone, source, lead_quality, sales_stage, potential_value, sales_notes, next_follow_up, assigned_to, created_by, pipeline_position, created_at, updated_at) VALUES (2, 'huso husic', 'huso doo', 'huso@gmail.com', '061 061 061', 'Cold Call', 'medium', 'new', 1000.00, 'test', '2025-09-10 00:00:00', 7, 6, 0, '2025-09-09 22:47:59.094613', '2025-09-09 23:03:28.528405');
INSERT INTO public.leads (id, customer_name, company_name, email, phone, source, lead_quality, sales_stage, potential_value, sales_notes, next_follow_up, assigned_to, created_by, pipeline_position, created_at, updated_at) VALUES (3, 'test test', 'test', 'test@test.com', '061061061', 'Referral', 'high', 'won', 500.00, 'test', NULL, 6, 6, 0, '2025-09-09 23:53:56.100543', '2025-10-09 09:26:38.372144');


--
-- TOC entry 6155 (class 0 OID 246182)
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
-- TOC entry 6163 (class 0 OID 262357)
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
-- TOC entry 6199 (class 0 OID 314288)
-- Dependencies: 314
-- Data for Name: machine_pricing; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.machine_pricing (id, rental_machine_id, base_price_daily, base_price_weekly, base_price_monthly, minimum_rental_days, maximum_rental_days, currency, is_active, created_at, updated_at) VALUES (1, 5, 50.00, 500.00, 5000.00, 1, NULL, 'KM', true, '2025-09-19 15:40:21.607071', '2025-09-19 15:40:21.607071');
INSERT INTO public.machine_pricing (id, rental_machine_id, base_price_daily, base_price_weekly, base_price_monthly, minimum_rental_days, maximum_rental_days, currency, is_active, created_at, updated_at) VALUES (2, 4, 30.00, 300.00, 3000.00, 1, NULL, 'KM', true, '2025-09-19 15:40:42.793561', '2025-09-19 15:40:42.793561');


--
-- TOC entry 6169 (class 0 OID 286248)
-- Dependencies: 276
-- Data for Name: machine_rentals; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.machine_rentals (id, customer_id, rental_start_date, rental_end_date, planned_return_date, actual_return_date, rental_status, price_per_day, price_per_week, price_per_month, billing_period, total_amount, maintenance_reminder_date, rental_notes, created_by, created_at, updated_at, rental_machine_id) VALUES (10, 9, '2025-09-20', '2025-09-24', '2025-09-27', NULL, 'returned', 30.00, 300.00, 3000.00, 'weekly', 150.00, NULL, 'test', 1, '2025-09-19 16:07:43.932285', '2025-10-01 14:51:06.040169', 4);
INSERT INTO public.machine_rentals (id, customer_id, rental_start_date, rental_end_date, planned_return_date, actual_return_date, rental_status, price_per_day, price_per_week, price_per_month, billing_period, total_amount, maintenance_reminder_date, rental_notes, created_by, created_at, updated_at, rental_machine_id) VALUES (8, 8, '2025-09-20', '2025-09-21', '2025-09-22', NULL, 'returned', NULL, NULL, NULL, 'daily', 10.00, NULL, 'test', 1, '2025-09-19 12:51:43.245625', '2025-10-07 12:09:18.966705', 5);


--
-- TOC entry 6165 (class 0 OID 262375)
-- Dependencies: 271
-- Data for Name: machine_serials; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (1, 1, '061 061', 'available', '2025-09-06 19:55:24.349124', '2025-09-06 19:55:24.349124');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (2, 1, '789 456', 'available', '2025-09-06 20:02:01.044394', '2025-09-06 20:02:01.044394');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (9, 3, '555 222', 'available', '2025-09-07 02:12:23.860314', '2025-09-07 02:12:23.860314');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (11, 6, '456 235', 'available', '2025-09-09 19:34:59.52792', '2025-09-09 19:34:59.52792');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (12, 2, '165 515', 'available', '2025-09-11 14:29:16.420744', '2025-09-11 14:29:16.420744');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (13, 3, '458777', 'available', '2025-09-11 14:30:27.201333', '2025-09-11 14:30:27.201333');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (16, 5, '999 999', 'available', '2025-09-12 11:48:00.52884', '2025-09-12 11:48:00.52884');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (17, 5, '555 666', 'available', '2025-09-12 11:50:04.921504', '2025-09-12 11:50:04.921504');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (18, 3, '62551', 'available', '2025-09-12 12:36:47.72051', '2025-09-12 12:36:47.72051');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (19, 3, '58958658', 'available', '2025-10-08 22:15:28.360148', '2025-10-08 22:15:28.360148');
INSERT INTO public.machine_serials (id, model_id, serial_number, status, created_at, updated_at) VALUES (20, 6, '582145662', 'available', '2025-10-11 09:58:07.846145', '2025-10-11 09:58:07.846145');


--
-- TOC entry 6119 (class 0 OID 16416)
-- Dependencies: 225
-- Data for Name: machines; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 6195 (class 0 OID 314250)
-- Dependencies: 310
-- Data for Name: notification_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.notification_categories (id, name, description, icon, color, priority, is_active, created_at) VALUES (1, 'rental', 'Rental-related notifications', 'calendar', 'blue', 2, true, '2025-09-19 14:49:57.303317');
INSERT INTO public.notification_categories (id, name, description, icon, color, priority, is_active, created_at) VALUES (2, 'maintenance', 'Maintenance and repair notifications', 'wrench', 'orange', 3, true, '2025-09-19 14:49:57.303317');
INSERT INTO public.notification_categories (id, name, description, icon, color, priority, is_active, created_at) VALUES (3, 'system', 'System and security notifications', 'shield', 'red', 4, true, '2025-09-19 14:49:57.303317');
INSERT INTO public.notification_categories (id, name, description, icon, color, priority, is_active, created_at) VALUES (4, 'marketing', 'Marketing and promotional notifications', 'megaphone', 'green', 1, true, '2025-09-19 14:49:57.303317');
INSERT INTO public.notification_categories (id, name, description, icon, color, priority, is_active, created_at) VALUES (5, 'customer', 'Customer service notifications', 'users', 'purple', 2, true, '2025-09-19 14:49:57.303317');
INSERT INTO public.notification_categories (id, name, description, icon, color, priority, is_active, created_at) VALUES (6, 'financial', 'Financial and billing notifications', 'dollar-sign', 'yellow', 3, true, '2025-09-19 14:49:57.303317');


--
-- TOC entry 6193 (class 0 OID 314223)
-- Dependencies: 308
-- Data for Name: notification_deliveries; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 6191 (class 0 OID 314206)
-- Dependencies: 306
-- Data for Name: notification_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.notification_templates (id, template_key, name, description, notification_type, subject_template, body_template, variables, is_active, created_at, updated_at) VALUES (1, 'rental_created', 'New Rental Created', 'Notification when a new rental is created', 'rental', 'New Rental: {{machine_name}} for {{customer_name}}', 'A new rental has been created for {{customer_name}}.\n\nMachine: {{machine_name}}\nStart Date: {{start_date}}\nEnd Date: {{end_date}}\nTotal Amount: {{total_amount}}', '{"end_date": "Rental end date", "start_date": "Rental start date", "machine_name": "Name of the rented machine", "total_amount": "Total rental amount", "customer_name": "Customer name"}', true, '2025-09-19 14:49:57.305868', '2025-09-19 14:49:57.305868');
INSERT INTO public.notification_templates (id, template_key, name, description, notification_type, subject_template, body_template, variables, is_active, created_at, updated_at) VALUES (2, 'rental_activated', 'Rental Activated', 'Notification when a reserved rental becomes active', 'rental', 'Rental Activated: {{machine_name}}', 'Your reserved rental for {{machine_name}} has been activated.\n\nStart Date: {{start_date}}\nEnd Date: {{end_date}}\nPlease ensure the machine is ready for pickup.', '{"end_date": "Rental end date", "start_date": "Rental start date", "machine_name": "Name of the rented machine"}', true, '2025-09-19 14:49:57.305868', '2025-09-19 14:49:57.305868');
INSERT INTO public.notification_templates (id, template_key, name, description, notification_type, subject_template, body_template, variables, is_active, created_at, updated_at) VALUES (3, 'rental_ending_soon', 'Rental Ending Soon', 'Notification when rental is ending soon', 'rental', 'Rental Ending Soon: {{machine_name}}', 'Your rental for {{machine_name}} is ending soon.\n\nEnd Date: {{end_date}}\nPlease prepare for return or contact us to extend.', '{"end_date": "Rental end date", "machine_name": "Name of the rented machine"}', true, '2025-09-19 14:49:57.305868', '2025-09-19 14:49:57.305868');
INSERT INTO public.notification_templates (id, template_key, name, description, notification_type, subject_template, body_template, variables, is_active, created_at, updated_at) VALUES (4, 'maintenance_due', 'Maintenance Due', 'Notification when maintenance is due', 'maintenance', 'Maintenance Due: {{machine_name}}', 'Maintenance is due for {{machine_name}}.\n\nDue Date: {{due_date}}\nType: {{maintenance_type}}\nPlease schedule maintenance.', '{"due_date": "Maintenance due date", "machine_name": "Name of the machine", "maintenance_type": "Type of maintenance"}', true, '2025-09-19 14:49:57.305868', '2025-09-19 14:49:57.305868');
INSERT INTO public.notification_templates (id, template_key, name, description, notification_type, subject_template, body_template, variables, is_active, created_at, updated_at) VALUES (5, 'status_change', 'Machine Status Changed', 'Notification when machine status changes', 'system', 'Status Update: {{machine_name}}', 'The status of {{machine_name}} has changed from {{old_status}} to {{new_status}}.\n\nReason: {{reason}}\nChanged by: {{changed_by}}', '{"reason": "Reason for change", "changed_by": "User who made the change", "new_status": "New status", "old_status": "Previous status", "machine_name": "Name of the machine"}', true, '2025-09-19 14:49:57.305868', '2025-09-19 14:49:57.305868');
INSERT INTO public.notification_templates (id, template_key, name, description, notification_type, subject_template, body_template, variables, is_active, created_at, updated_at) VALUES (6, 'overdue_rental', 'Overdue Rental', 'Notification for overdue rentals', 'rental', 'Overdue Rental: {{machine_name}}', 'The rental for {{machine_name}} is overdue.\n\nCustomer: {{customer_name}}\nDue Date: {{due_date}}\nDays Overdue: {{days_overdue}}\nPlease follow up.', '{"due_date": "Original due date", "days_overdue": "Number of days overdue", "machine_name": "Name of the rented machine", "customer_name": "Customer name"}', true, '2025-09-19 14:49:57.305868', '2025-09-19 14:49:57.305868');


--
-- TOC entry 6143 (class 0 OID 169416)
-- Dependencies: 249
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (518, 9, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Muhamed Kašić for $12000.00', 'machine', false, 'assigned_machine', 13, '2025-09-12 12:36:47.755427', '2025-09-12 12:36:47.755427', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (520, 7, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Muhamed Kašić for $12000.00', 'machine', false, 'assigned_machine', 13, '2025-09-12 12:36:47.758862', '2025-09-12 12:36:47.758862', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (521, 8, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Muhamed Kašić for $12000.00', 'machine', false, 'assigned_machine', 13, '2025-09-12 12:36:47.760848', '2025-09-12 12:36:47.760848', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (522, 4, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Muhamed Kašić for $12000.00', 'machine', false, 'assigned_machine', 13, '2025-09-12 12:36:47.762442', '2025-09-12 12:36:47.762442', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (523, 3, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Muhamed Kašić for $12000.00', 'machine', false, 'assigned_machine', 13, '2025-09-12 12:36:47.763834', '2025-09-12 12:36:47.763834', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (527, 9, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-12 23:32:46.957379', '2025-09-12 23:32:46.957379', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (528, 7, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-12 23:32:46.963213', '2025-09-12 23:32:46.963213', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (529, 8, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-12 23:32:46.968233', '2025-09-12 23:32:46.968233', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (530, 4, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-12 23:32:46.972567', '2025-09-12 23:32:46.972567', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (531, 3, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-12 23:32:46.976435', '2025-09-12 23:32:46.976435', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (519, 6, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Muhamed Kašić for $12000.00', 'machine', true, 'assigned_machine', 13, '2025-09-12 12:36:47.756865', '2025-09-12 23:51:15.412115', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (524, 6, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-12 23:32:46.938387', '2025-09-12 23:51:18.449552', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (516, 5, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Muhamed Kašić for $12000.00', 'machine', true, 'assigned_machine', 13, '2025-09-12 12:36:47.749604', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (525, 5, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-12 23:32:46.948682', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (532, 5, 'Work Order Assigned', 'You have been assigned to work order 69/25', 'work_order', true, 'work_order', 12, '2025-09-12 23:32:46.981787', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (726, 8, 'Repair Ticket Converted', 'Repair ticket 70/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 13, '2025-10-08 13:25:33.991378', '2025-10-08 13:25:33.991378', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (727, 5, 'Repair Ticket Converted', 'Repair ticket 70/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 13, '2025-10-08 13:25:33.996839', '2025-10-08 13:25:33.996839', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (729, 9, 'Repair Ticket Converted', 'Repair ticket 70/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 13, '2025-10-08 13:25:34.000281', '2025-10-08 13:25:34.000281', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (730, 4, 'Repair Ticket Converted', 'Repair ticket 70/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 13, '2025-10-08 13:25:34.001842', '2025-10-08 13:25:34.001842', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (731, 6, 'Repair Ticket Converted', 'Repair ticket 70/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 13, '2025-10-08 13:25:34.003351', '2025-10-08 13:25:34.003351', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (732, 7, 'Repair Ticket Converted', 'Repair ticket 70/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 13, '2025-10-08 13:25:34.004773', '2025-10-08 13:25:34.004773', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (733, 3, 'Repair Ticket Converted', 'Repair ticket 70/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 13, '2025-10-08 13:25:34.006268', '2025-10-08 13:25:34.006268', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (734, 5, 'Work Order Assigned', 'You have been assigned to work order 70/25', 'work_order', false, 'work_order', 26, '2025-10-08 13:25:34.009082', '2025-10-08 13:25:34.009082', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (744, 5, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Zakir Činjarević for $1500.00', 'machine', false, 'assigned_machine', 14, '2025-10-08 22:15:28.638074', '2025-10-08 22:15:28.638074', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (745, 8, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Zakir Činjarević for $1500.00', 'machine', false, 'assigned_machine', 14, '2025-10-08 22:15:28.64166', '2025-10-08 22:15:28.64166', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (746, 9, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Zakir Činjarević for $1500.00', 'machine', false, 'assigned_machine', 14, '2025-10-08 22:15:28.644592', '2025-10-08 22:15:28.644592', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (747, 4, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Zakir Činjarević for $1500.00', 'machine', false, 'assigned_machine', 14, '2025-10-08 22:15:28.649374', '2025-10-08 22:15:28.649374', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (748, 6, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Zakir Činjarević for $1500.00', 'machine', false, 'assigned_machine', 14, '2025-10-08 22:15:28.65265', '2025-10-08 22:15:28.65265', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (749, 3, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Zakir Činjarević for $1500.00', 'machine', false, 'assigned_machine', 14, '2025-10-08 22:15:28.655888', '2025-10-08 22:15:28.655888', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (750, 1, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Zakir Činjarević for $1500.00', 'machine', true, 'assigned_machine', 14, '2025-10-08 22:15:28.658696', '2025-10-08 22:55:46.295434', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (743, 2, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Zakir Činjarević for $1500.00', 'machine', true, 'assigned_machine', 14, '2025-10-08 22:15:28.625405', '2025-10-09 09:50:36.615576', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (728, 2, 'Repair Ticket Converted', 'Repair ticket 70/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 13, '2025-10-08 13:25:33.998727', '2025-10-09 09:50:36.621395', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (526, 2, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-12 23:32:46.953594', '2025-10-09 09:50:49.119241', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (517, 2, 'Machine Sold', 'BR 40/10 C Adv (Karcher) has been sold to Muhamed Kašić for $12000.00', 'machine', true, 'assigned_machine', 13, '2025-09-12 12:36:47.753632', '2025-10-09 09:50:49.120725', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (767, 8, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from pending to in_progress', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-10 12:36:58.893273', '2025-10-10 12:36:58.893273', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (768, 5, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from pending to in_progress', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-10 12:36:58.901835', '2025-10-10 12:36:58.901835', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (769, 7, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from pending to in_progress', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-10 12:36:58.904606', '2025-10-10 12:36:58.904606', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (770, 9, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from pending to in_progress', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-10 12:36:58.907171', '2025-10-10 12:36:58.907171', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (771, 4, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from pending to in_progress', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-10 12:36:58.909783', '2025-10-10 12:36:58.909783', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (772, 6, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from pending to in_progress', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-10 12:36:58.912929', '2025-10-10 12:36:58.912929', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (773, 2, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from pending to in_progress', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-10 12:36:58.915549', '2025-10-10 12:36:58.915549', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (536, 9, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket 68/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 5, '2025-09-12 23:32:58.349596', '2025-09-12 23:32:58.349596', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (537, 7, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket 68/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 5, '2025-09-12 23:32:58.354223', '2025-09-12 23:32:58.354223', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (538, 8, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket 68/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 5, '2025-09-12 23:32:58.356776', '2025-09-12 23:32:58.356776', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (539, 4, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket 68/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 5, '2025-09-12 23:32:58.359956', '2025-09-12 23:32:58.359956', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (540, 3, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket 68/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 5, '2025-09-12 23:32:58.363303', '2025-09-12 23:32:58.363303', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (533, 6, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket 68/25 has been converted to a work order', 'warranty_repair_ticket', true, 'warranty_repair_ticket', 5, '2025-09-12 23:32:58.332658', '2025-09-12 23:51:20.101626', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (534, 5, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket 68/25 has been converted to a work order', 'warranty_repair_ticket', true, 'warranty_repair_ticket', 5, '2025-09-12 23:32:58.339302', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (541, 5, 'Warranty Work Order Assigned', 'You have been assigned to warranty work order 68/25', 'warranty_work_order', true, 'warranty_work_order', 6, '2025-09-12 23:32:58.366292', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (735, 8, 'Warranty Repair Ticket Created', 'New warranty repair ticket 72/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-08 13:30:02.768023', '2025-10-08 13:30:02.768023', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (736, 5, 'Warranty Repair Ticket Created', 'New warranty repair ticket 72/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-08 13:30:02.771897', '2025-10-08 13:30:02.771897', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (738, 9, 'Warranty Repair Ticket Created', 'New warranty repair ticket 72/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-08 13:30:02.774802', '2025-10-08 13:30:02.774802', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (739, 4, 'Warranty Repair Ticket Created', 'New warranty repair ticket 72/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-08 13:30:02.776085', '2025-10-08 13:30:02.776085', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (740, 6, 'Warranty Repair Ticket Created', 'New warranty repair ticket 72/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-08 13:30:02.777475', '2025-10-08 13:30:02.777475', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (741, 7, 'Warranty Repair Ticket Created', 'New warranty repair ticket 72/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-08 13:30:02.778768', '2025-10-08 13:30:02.778768', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (742, 3, 'Warranty Repair Ticket Created', 'New warranty repair ticket 72/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-08 13:30:02.780159', '2025-10-08 13:30:02.780159', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (751, 5, 'Work Order Status Changed', 'Work order 67/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 16, '2025-10-09 00:02:50.686894', '2025-10-09 00:02:50.686894', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (752, 8, 'Work Order Status Changed', 'Work order 67/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 16, '2025-10-09 00:02:50.693268', '2025-10-09 00:02:50.693268', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (753, 7, 'Work Order Status Changed', 'Work order 67/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 16, '2025-10-09 00:02:50.695633', '2025-10-09 00:02:50.695633', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (754, 9, 'Work Order Status Changed', 'Work order 67/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 16, '2025-10-09 00:02:50.69774', '2025-10-09 00:02:50.69774', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (755, 4, 'Work Order Status Changed', 'Work order 67/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 16, '2025-10-09 00:02:50.699809', '2025-10-09 00:02:50.699809', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (756, 6, 'Work Order Status Changed', 'Work order 67/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 16, '2025-10-09 00:02:50.701955', '2025-10-09 00:02:50.701955', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (757, 3, 'Work Order Status Changed', 'Work order 67/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 16, '2025-10-09 00:02:50.703616', '2025-10-09 00:02:50.703616', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (737, 2, 'Warranty Repair Ticket Created', 'New warranty repair ticket 72/25 has been created', 'warranty_repair_ticket', true, 'warranty_repair_ticket', 6, '2025-10-08 13:30:02.773542', '2025-10-09 09:50:36.619056', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (535, 2, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket 68/25 has been converted to a work order', 'warranty_repair_ticket', true, 'warranty_repair_ticket', 5, '2025-09-12 23:32:58.344227', '2025-10-09 09:50:36.675869', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (758, 1, 'Work Order Status Changed', 'Work order 67/25 status changed from in_progress to completed', 'work_order', true, 'work_order', 16, '2025-10-09 00:02:50.7053', '2025-10-10 09:28:54.281028', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (774, 3, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from pending to in_progress', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-10 12:36:58.917944', '2025-10-10 12:36:58.917944', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (544, 9, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-12 23:53:34.720289', '2025-09-12 23:53:34.720289', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (546, 7, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-12 23:53:34.729383', '2025-09-12 23:53:34.729383', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (547, 8, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-12 23:53:34.733566', '2025-09-12 23:53:34.733566', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (548, 4, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-12 23:53:34.736147', '2025-09-12 23:53:34.736147', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (549, 3, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-12 23:53:34.739625', '2025-09-12 23:53:34.739625', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (542, 5, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-12 23:53:34.710361', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (550, 5, 'Work Order Assigned', 'You have been assigned to work order 69/25', 'work_order', true, 'work_order', 13, '2025-09-12 23:53:34.743057', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (545, 6, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-12 23:53:34.724214', '2025-10-07 11:19:31.18125', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (759, 5, 'Work Order Status Changed', 'Work order 66/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 6, '2025-10-09 00:18:09.714989', '2025-10-09 00:18:09.714989', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (760, 8, 'Work Order Status Changed', 'Work order 66/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 6, '2025-10-09 00:18:09.718731', '2025-10-09 00:18:09.718731', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (761, 7, 'Work Order Status Changed', 'Work order 66/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 6, '2025-10-09 00:18:09.720524', '2025-10-09 00:18:09.720524', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (762, 9, 'Work Order Status Changed', 'Work order 66/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 6, '2025-10-09 00:18:09.722328', '2025-10-09 00:18:09.722328', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (763, 4, 'Work Order Status Changed', 'Work order 66/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 6, '2025-10-09 00:18:09.724056', '2025-10-09 00:18:09.724056', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (764, 6, 'Work Order Status Changed', 'Work order 66/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 6, '2025-10-09 00:18:09.725836', '2025-10-09 00:18:09.725836', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (765, 3, 'Work Order Status Changed', 'Work order 66/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 6, '2025-10-09 00:18:09.727731', '2025-10-09 00:18:09.727731', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (543, 2, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-12 23:53:34.716839', '2025-10-09 09:50:36.674345', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (766, 1, 'Work Order Status Changed', 'Work order 66/25 status changed from in_progress to completed', 'work_order', true, 'work_order', 6, '2025-10-09 00:18:09.729927', '2025-10-10 09:28:53.213487', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (775, 8, 'Machine Assigned', 'HDS 8/18 4C (Milwaukee Tool) has been assigned to Adnan Rovčanin for repair', 'machine', false, 'assigned_machine', 15, '2025-10-11 09:58:07.927401', '2025-10-11 09:58:07.927401', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (776, 7, 'Machine Assigned', 'HDS 8/18 4C (Milwaukee Tool) has been assigned to Adnan Rovčanin for repair', 'machine', false, 'assigned_machine', 15, '2025-10-11 09:58:07.933065', '2025-10-11 09:58:07.933065', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (777, 9, 'Machine Assigned', 'HDS 8/18 4C (Milwaukee Tool) has been assigned to Adnan Rovčanin for repair', 'machine', false, 'assigned_machine', 15, '2025-10-11 09:58:07.935296', '2025-10-11 09:58:07.935296', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (778, 4, 'Machine Assigned', 'HDS 8/18 4C (Milwaukee Tool) has been assigned to Adnan Rovčanin for repair', 'machine', false, 'assigned_machine', 15, '2025-10-11 09:58:07.937133', '2025-10-11 09:58:07.937133', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (779, 6, 'Machine Assigned', 'HDS 8/18 4C (Milwaukee Tool) has been assigned to Adnan Rovčanin for repair', 'machine', false, 'assigned_machine', 15, '2025-10-11 09:58:07.938818', '2025-10-11 09:58:07.938818', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (780, 2, 'Machine Assigned', 'HDS 8/18 4C (Milwaukee Tool) has been assigned to Adnan Rovčanin for repair', 'machine', false, 'assigned_machine', 15, '2025-10-11 09:58:07.940207', '2025-10-11 09:58:07.940207', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (781, 3, 'Machine Assigned', 'HDS 8/18 4C (Milwaukee Tool) has been assigned to Adnan Rovčanin for repair', 'machine', false, 'assigned_machine', 15, '2025-10-11 09:58:07.941535', '2025-10-11 09:58:07.941535', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (782, 1, 'Machine Assigned', 'HDS 8/18 4C (Milwaukee Tool) has been assigned to Adnan Rovčanin for repair', 'machine', false, 'assigned_machine', 15, '2025-10-11 09:58:07.943095', '2025-10-11 09:58:07.943095', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (553, 9, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 11, '2025-09-12 23:54:15.986905', '2025-09-12 23:54:15.986905', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (555, 7, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 11, '2025-09-12 23:54:15.994041', '2025-09-12 23:54:15.994041', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (556, 8, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 11, '2025-09-12 23:54:15.99782', '2025-09-12 23:54:15.99782', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (557, 4, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 11, '2025-09-12 23:54:16.001289', '2025-09-12 23:54:16.001289', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (558, 3, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 11, '2025-09-12 23:54:16.004168', '2025-09-12 23:54:16.004168', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (551, 5, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 11, '2025-09-12 23:54:15.977749', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (559, 5, 'Work Order Assigned', 'You have been assigned to work order 67/25', 'work_order', true, 'work_order', 14, '2025-09-12 23:54:16.007987', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (554, 6, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 11, '2025-09-12 23:54:15.990204', '2025-10-07 11:19:31.176404', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (552, 2, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 11, '2025-09-12 23:54:15.982916', '2025-10-09 09:50:36.672156', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (783, 8, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from in_progress to completed', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-11 10:01:32.660268', '2025-10-11 10:01:32.660268', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (784, 7, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from in_progress to completed', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-11 10:01:32.664486', '2025-10-11 10:01:32.664486', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (785, 9, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from in_progress to completed', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-11 10:01:32.667445', '2025-10-11 10:01:32.667445', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (786, 4, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from in_progress to completed', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-11 10:01:32.671142', '2025-10-11 10:01:32.671142', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (787, 6, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from in_progress to completed', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-11 10:01:32.675684', '2025-10-11 10:01:32.675684', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (788, 2, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from in_progress to completed', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-11 10:01:32.679451', '2025-10-11 10:01:32.679451', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (789, 3, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from in_progress to completed', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-11 10:01:32.681539', '2025-10-11 10:01:32.681539', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (790, 1, 'Warranty Work Order Status Changed', 'Warranty Work order WW-68/25 status changed from in_progress to completed', 'warranty_work_order', false, 'warranty_work_order', 6, '2025-10-11 10:01:32.683439', '2025-10-11 10:01:32.683439', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (562, 9, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:01:40.646764', '2025-09-13 00:01:40.646764', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (564, 7, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:01:40.655714', '2025-09-13 00:01:40.655714', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (565, 8, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:01:40.658906', '2025-09-13 00:01:40.658906', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (566, 4, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:01:40.661847', '2025-09-13 00:01:40.661847', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (567, 3, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:01:40.666628', '2025-09-13 00:01:40.666628', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (560, 5, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:01:40.633866', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (568, 5, 'Work Order Assigned', 'You have been assigned to work order 69/25', 'work_order', true, 'work_order', 15, '2025-09-13 00:01:40.670575', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (563, 6, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:01:40.651382', '2025-10-07 11:19:31.173504', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (561, 2, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:01:40.641911', '2025-10-09 09:50:36.670694', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (791, 5, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 10:03:39.833207', '2025-10-11 10:03:39.833207', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (792, 8, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 10:03:39.836681', '2025-10-11 10:03:39.836681', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (793, 7, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 10:03:39.8389', '2025-10-11 10:03:39.8389', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (794, 9, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 10:03:39.840338', '2025-10-11 10:03:39.840338', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (795, 6, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 10:03:39.841588', '2025-10-11 10:03:39.841588', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (796, 2, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 10:03:39.843051', '2025-10-11 10:03:39.843051', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (797, 3, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 10:03:39.844693', '2025-10-11 10:03:39.844693', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (798, 1, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 10:03:39.846619', '2025-10-11 10:03:39.846619', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (799, 9, 'Work Order Created', 'New work order TK-73/25 has been created', 'work_order', false, 'work_order', 27, '2025-10-11 10:03:39.848918', '2025-10-11 10:03:39.848918', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (800, 2, 'Work Order Created', 'New work order TK-73/25 has been created', 'work_order', false, 'work_order', 27, '2025-10-11 10:03:39.850292', '2025-10-11 10:03:39.850292', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (801, 1, 'Work Order Created', 'New work order TK-73/25 has been created', 'work_order', false, 'work_order', 27, '2025-10-11 10:03:39.85173', '2025-10-11 10:03:39.85173', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (571, 9, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 11, '2025-09-13 00:13:49.880593', '2025-09-13 00:13:49.880593', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (573, 7, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 11, '2025-09-13 00:13:49.890997', '2025-09-13 00:13:49.890997', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (574, 8, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 11, '2025-09-13 00:13:49.899506', '2025-09-13 00:13:49.899506', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (575, 4, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 11, '2025-09-13 00:13:49.903382', '2025-09-13 00:13:49.903382', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (576, 3, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 11, '2025-09-13 00:13:49.907157', '2025-09-13 00:13:49.907157', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (569, 5, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 11, '2025-09-13 00:13:49.863687', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (577, 5, 'Work Order Assigned', 'You have been assigned to work order 67/25', 'work_order', true, 'work_order', 16, '2025-09-13 00:13:49.911222', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (572, 6, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 11, '2025-09-13 00:13:49.883843', '2025-10-07 11:19:31.13446', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (570, 2, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 11, '2025-09-13 00:13:49.875576', '2025-10-09 09:50:36.665592', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (802, 5, 'Work Order Status Changed', 'Work order TK-73/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 27, '2025-10-11 10:03:58.702982', '2025-10-11 10:03:58.702982', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (803, 8, 'Work Order Status Changed', 'Work order TK-73/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 27, '2025-10-11 10:03:58.706142', '2025-10-11 10:03:58.706142', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (804, 7, 'Work Order Status Changed', 'Work order TK-73/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 27, '2025-10-11 10:03:58.708256', '2025-10-11 10:03:58.708256', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (805, 9, 'Work Order Status Changed', 'Work order TK-73/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 27, '2025-10-11 10:03:58.710842', '2025-10-11 10:03:58.710842', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (806, 6, 'Work Order Status Changed', 'Work order TK-73/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 27, '2025-10-11 10:03:58.713449', '2025-10-11 10:03:58.713449', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (807, 2, 'Work Order Status Changed', 'Work order TK-73/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 27, '2025-10-11 10:03:58.715978', '2025-10-11 10:03:58.715978', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (808, 3, 'Work Order Status Changed', 'Work order TK-73/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 27, '2025-10-11 10:03:58.717677', '2025-10-11 10:03:58.717677', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (809, 1, 'Work Order Status Changed', 'Work order TK-73/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 27, '2025-10-11 10:03:58.719355', '2025-10-11 10:03:58.719355', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (580, 9, 'Work Order Status Changed', 'Work order 67/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 16, '2025-09-13 00:14:27.651493', '2025-09-13 00:14:27.651493', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (582, 7, 'Work Order Status Changed', 'Work order 67/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 16, '2025-09-13 00:14:27.661111', '2025-09-13 00:14:27.661111', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (583, 8, 'Work Order Status Changed', 'Work order 67/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 16, '2025-09-13 00:14:27.667297', '2025-09-13 00:14:27.667297', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (584, 4, 'Work Order Status Changed', 'Work order 67/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 16, '2025-09-13 00:14:27.670881', '2025-09-13 00:14:27.670881', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (585, 3, 'Work Order Status Changed', 'Work order 67/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 16, '2025-09-13 00:14:27.674982', '2025-09-13 00:14:27.674982', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (578, 5, 'Work Order Status Changed', 'Work order 67/25 status changed from pending to in_progress', 'work_order', true, 'work_order', 16, '2025-09-13 00:14:27.642504', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (581, 6, 'Work Order Status Changed', 'Work order 67/25 status changed from pending to in_progress', 'work_order', true, 'work_order', 16, '2025-09-13 00:14:27.655802', '2025-10-07 11:19:31.119154', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (579, 2, 'Work Order Status Changed', 'Work order 67/25 status changed from pending to in_progress', 'work_order', true, 'work_order', 16, '2025-09-13 00:14:27.647554', '2025-10-09 09:50:36.661436', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (810, 5, 'Work Order Status Changed', 'Work order TK-73/25 status changed from in_progress to waiting_approval', 'work_order', false, 'work_order', 27, '2025-10-11 10:04:54.628083', '2025-10-11 10:04:54.628083', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (811, 8, 'Work Order Status Changed', 'Work order TK-73/25 status changed from in_progress to waiting_approval', 'work_order', false, 'work_order', 27, '2025-10-11 10:04:54.634499', '2025-10-11 10:04:54.634499', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (812, 7, 'Work Order Status Changed', 'Work order TK-73/25 status changed from in_progress to waiting_approval', 'work_order', false, 'work_order', 27, '2025-10-11 10:04:54.636591', '2025-10-11 10:04:54.636591', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (813, 9, 'Work Order Status Changed', 'Work order TK-73/25 status changed from in_progress to waiting_approval', 'work_order', false, 'work_order', 27, '2025-10-11 10:04:54.638502', '2025-10-11 10:04:54.638502', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (814, 6, 'Work Order Status Changed', 'Work order TK-73/25 status changed from in_progress to waiting_approval', 'work_order', false, 'work_order', 27, '2025-10-11 10:04:54.640376', '2025-10-11 10:04:54.640376', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (815, 2, 'Work Order Status Changed', 'Work order TK-73/25 status changed from in_progress to waiting_approval', 'work_order', false, 'work_order', 27, '2025-10-11 10:04:54.64301', '2025-10-11 10:04:54.64301', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (816, 3, 'Work Order Status Changed', 'Work order TK-73/25 status changed from in_progress to waiting_approval', 'work_order', false, 'work_order', 27, '2025-10-11 10:04:54.645994', '2025-10-11 10:04:54.645994', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (817, 1, 'Work Order Status Changed', 'Work order TK-73/25 status changed from in_progress to waiting_approval', 'work_order', false, 'work_order', 27, '2025-10-11 10:04:54.649', '2025-10-11 10:04:54.649', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (588, 9, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:18:31.737403', '2025-09-13 00:18:31.737403', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (590, 7, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:18:31.745262', '2025-09-13 00:18:31.745262', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (591, 8, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:18:31.749272', '2025-09-13 00:18:31.749272', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (592, 4, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:18:31.751811', '2025-09-13 00:18:31.751811', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (593, 3, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:18:31.754448', '2025-09-13 00:18:31.754448', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (586, 5, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-13 00:18:31.72686', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (594, 5, 'Work Order Assigned', 'You have been assigned to work order 65/25', 'work_order', true, 'work_order', 17, '2025-09-13 00:18:31.757442', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (589, 6, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-13 00:18:31.740584', '2025-10-07 11:19:31.109306', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (587, 2, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-13 00:18:31.733354', '2025-10-09 09:50:36.659985', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (818, 5, 'Work Order Status Changed', 'Work order TK-73/25 status changed from waiting_approval to completed', 'work_order', false, 'work_order', 27, '2025-10-11 10:06:36.933944', '2025-10-11 10:06:36.933944', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (819, 8, 'Work Order Status Changed', 'Work order TK-73/25 status changed from waiting_approval to completed', 'work_order', false, 'work_order', 27, '2025-10-11 10:06:36.938404', '2025-10-11 10:06:36.938404', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (820, 7, 'Work Order Status Changed', 'Work order TK-73/25 status changed from waiting_approval to completed', 'work_order', false, 'work_order', 27, '2025-10-11 10:06:36.94138', '2025-10-11 10:06:36.94138', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (821, 9, 'Work Order Status Changed', 'Work order TK-73/25 status changed from waiting_approval to completed', 'work_order', false, 'work_order', 27, '2025-10-11 10:06:36.943938', '2025-10-11 10:06:36.943938', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (822, 6, 'Work Order Status Changed', 'Work order TK-73/25 status changed from waiting_approval to completed', 'work_order', false, 'work_order', 27, '2025-10-11 10:06:36.946311', '2025-10-11 10:06:36.946311', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (823, 2, 'Work Order Status Changed', 'Work order TK-73/25 status changed from waiting_approval to completed', 'work_order', false, 'work_order', 27, '2025-10-11 10:06:36.948245', '2025-10-11 10:06:36.948245', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (824, 3, 'Work Order Status Changed', 'Work order TK-73/25 status changed from waiting_approval to completed', 'work_order', false, 'work_order', 27, '2025-10-11 10:06:36.951125', '2025-10-11 10:06:36.951125', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (825, 1, 'Work Order Status Changed', 'Work order TK-73/25 status changed from waiting_approval to completed', 'work_order', false, 'work_order', 27, '2025-10-11 10:06:36.95386', '2025-10-11 10:06:36.95386', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (597, 9, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:24:01.844086', '2025-09-13 00:24:01.844086', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (599, 7, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:24:01.854044', '2025-09-13 00:24:01.854044', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (600, 8, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:24:01.870478', '2025-09-13 00:24:01.870478', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (601, 4, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:24:01.874607', '2025-09-13 00:24:01.874607', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (602, 3, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:24:01.878524', '2025-09-13 00:24:01.878524', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (595, 5, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:24:01.832056', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (603, 5, 'Work Order Assigned', 'You have been assigned to work order 69/25', 'work_order', true, 'work_order', 18, '2025-09-13 00:24:01.883473', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (598, 6, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:24:01.848283', '2025-10-07 11:19:31.098149', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (596, 2, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:24:01.839844', '2025-10-09 09:50:36.658739', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (826, 5, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-74/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:10.662097', '2025-10-11 10:14:10.662097', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (827, 4, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-74/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:10.66497', '2025-10-11 10:14:10.66497', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (828, 7, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-74/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:10.666532', '2025-10-11 10:14:10.666532', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (829, 8, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-74/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:10.668559', '2025-10-11 10:14:10.668559', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (830, 9, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-74/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:10.670845', '2025-10-11 10:14:10.670845', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (831, 6, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-74/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:10.673165', '2025-10-11 10:14:10.673165', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (832, 2, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-74/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:10.67502', '2025-10-11 10:14:10.67502', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (833, 3, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-74/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:10.676619', '2025-10-11 10:14:10.676619', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (606, 9, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:28:09.971144', '2025-09-13 00:28:09.971144', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (608, 7, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:28:09.980014', '2025-09-13 00:28:09.980014', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (609, 8, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:28:09.985562', '2025-09-13 00:28:09.985562', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (610, 4, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:28:09.990041', '2025-09-13 00:28:09.990041', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (611, 3, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:28:09.993317', '2025-09-13 00:28:09.993317', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (604, 5, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-13 00:28:09.95399', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (612, 5, 'Work Order Assigned', 'You have been assigned to work order 65/25', 'work_order', true, 'work_order', 19, '2025-09-13 00:28:09.997211', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (607, 6, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-13 00:28:09.975617', '2025-10-07 11:19:31.157089', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (692, 1, 'New Machine Rental Created', 'Machine rental created for Zakir Činjarević', 'rental', true, 'machine_rental', 9, '2025-09-19 16:02:26.919789', '2025-10-07 13:00:10.074695', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (605, 2, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-13 00:28:09.965151', '2025-10-09 09:50:36.656403', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (834, 5, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-74/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:47.223903', '2025-10-11 10:14:47.223903', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (835, 4, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-74/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:47.227475', '2025-10-11 10:14:47.227475', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (836, 7, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-74/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:47.229907', '2025-10-11 10:14:47.229907', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (837, 8, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-74/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:47.232072', '2025-10-11 10:14:47.232072', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (838, 9, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-74/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:47.233979', '2025-10-11 10:14:47.233979', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (839, 6, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-74/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:47.236469', '2025-10-11 10:14:47.236469', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (840, 2, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-74/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:47.238551', '2025-10-11 10:14:47.238551', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (841, 3, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-74/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 7, '2025-10-11 10:14:47.240251', '2025-10-11 10:14:47.240251', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (842, 4, 'Warranty Work Order Assigned', 'You have been assigned to warranty work order WT-74/25', 'warranty_work_order', false, 'warranty_work_order', 7, '2025-10-11 10:14:47.241869', '2025-10-11 10:14:47.241869', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (615, 9, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:30:43.379046', '2025-09-13 00:30:43.379046', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (617, 7, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:30:43.387823', '2025-09-13 00:30:43.387823', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (618, 8, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:30:43.392256', '2025-09-13 00:30:43.392256', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (619, 4, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:30:43.395194', '2025-09-13 00:30:43.395194', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (620, 3, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:30:43.398387', '2025-09-13 00:30:43.398387', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (613, 5, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:30:43.368441', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (621, 5, 'Work Order Assigned', 'You have been assigned to work order 69/25', 'work_order', true, 'work_order', 20, '2025-09-13 00:30:43.402124', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (616, 6, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:30:43.383392', '2025-10-07 11:19:31.103435', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (693, 1, 'New Machine Rental Created', 'Machine rental created for Zakir Činjarević', 'rental', true, 'machine_rental', 10, '2025-09-19 16:07:43.969038', '2025-10-07 13:00:09.320657', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (614, 2, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:30:43.374731', '2025-10-09 09:50:36.653929', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (843, 5, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-75/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:22:44.25889', '2025-10-11 10:22:44.25889', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (844, 4, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-75/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:22:44.261908', '2025-10-11 10:22:44.261908', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (845, 7, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-75/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:22:44.26364', '2025-10-11 10:22:44.26364', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (846, 8, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-75/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:22:44.265122', '2025-10-11 10:22:44.265122', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (847, 9, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-75/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:22:44.266497', '2025-10-11 10:22:44.266497', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (848, 6, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-75/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:22:44.268332', '2025-10-11 10:22:44.268332', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (849, 2, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-75/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:22:44.269853', '2025-10-11 10:22:44.269853', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (850, 3, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-75/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:22:44.271986', '2025-10-11 10:22:44.271986', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (624, 9, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:33:36.566489', '2025-09-13 00:33:36.566489', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (626, 7, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:33:36.576326', '2025-09-13 00:33:36.576326', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (627, 8, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:33:36.580035', '2025-09-13 00:33:36.580035', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (628, 4, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:33:36.585126', '2025-09-13 00:33:36.585126', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (629, 3, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:33:36.589797', '2025-09-13 00:33:36.589797', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (622, 5, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-13 00:33:36.549452', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (630, 5, 'Work Order Assigned', 'You have been assigned to work order 65/25', 'work_order', true, 'work_order', 21, '2025-09-13 00:33:36.593656', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (625, 6, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-13 00:33:36.572231', '2025-10-07 11:19:31.128984', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (623, 2, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-13 00:33:36.561062', '2025-10-09 09:50:36.646016', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (851, 5, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-75/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:24:12.084864', '2025-10-11 10:24:12.084864', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (852, 4, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-75/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:24:12.090513', '2025-10-11 10:24:12.090513', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (853, 7, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-75/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:24:12.094008', '2025-10-11 10:24:12.094008', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (854, 8, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-75/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:24:12.096542', '2025-10-11 10:24:12.096542', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (855, 9, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-75/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:24:12.098805', '2025-10-11 10:24:12.098805', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (856, 6, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-75/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:24:12.100879', '2025-10-11 10:24:12.100879', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (857, 2, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-75/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:24:12.10298', '2025-10-11 10:24:12.10298', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (858, 3, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-75/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 8, '2025-10-11 10:24:12.105033', '2025-10-11 10:24:12.105033', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (859, 4, 'Warranty Work Order Assigned', 'You have been assigned to warranty work order WW-75/25', 'warranty_work_order', false, 'warranty_work_order', 8, '2025-10-11 10:24:12.106834', '2025-10-11 10:24:12.106834', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (633, 9, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:37:49.172048', '2025-09-13 00:37:49.172048', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (635, 7, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:37:49.182831', '2025-09-13 00:37:49.182831', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (636, 8, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:37:49.188478', '2025-09-13 00:37:49.188478', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (637, 4, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:37:49.193029', '2025-09-13 00:37:49.193029', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (638, 3, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:37:49.196683', '2025-09-13 00:37:49.196683', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (631, 5, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:37:49.158221', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (639, 5, 'Work Order Assigned', 'You have been assigned to work order 69/25', 'work_order', true, 'work_order', 22, '2025-09-13 00:37:49.201208', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (634, 6, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:37:49.175949', '2025-10-07 11:19:31.14322', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (632, 2, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:37:49.166641', '2025-10-09 09:50:36.64428', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (860, 5, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-76/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:28:01.694779', '2025-10-11 10:28:01.694779', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (861, 4, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-76/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:28:01.701535', '2025-10-11 10:28:01.701535', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (862, 7, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-76/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:28:01.704348', '2025-10-11 10:28:01.704348', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (863, 8, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-76/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:28:01.70726', '2025-10-11 10:28:01.70726', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (864, 9, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-76/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:28:01.709768', '2025-10-11 10:28:01.709768', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (865, 6, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-76/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:28:01.712908', '2025-10-11 10:28:01.712908', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (866, 2, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-76/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:28:01.716111', '2025-10-11 10:28:01.716111', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (867, 3, 'Warranty Repair Ticket Created', 'New warranty repair ticket WT-76/25 has been created', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:28:01.719684', '2025-10-11 10:28:01.719684', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (515, 5, 'Work Order Assigned', 'You have been assigned to work order 67/25', 'work_order', true, 'work_order', 11, '2025-09-12 11:36:50.812183', '2025-09-12 11:37:38.677156', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (642, 9, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:39:36.630036', '2025-09-13 00:39:36.630036', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (644, 7, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:39:36.639196', '2025-09-13 00:39:36.639196', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (645, 8, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:39:36.643858', '2025-09-13 00:39:36.643858', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (646, 4, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:39:36.648648', '2025-09-13 00:39:36.648648', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (647, 3, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-13 00:39:36.651811', '2025-09-13 00:39:36.651811', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (640, 5, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-13 00:39:36.613628', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (648, 5, 'Work Order Assigned', 'You have been assigned to work order 65/25', 'work_order', true, 'work_order', 23, '2025-09-13 00:39:36.655634', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (643, 6, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-13 00:39:36.63393', '2025-10-07 11:19:31.08462', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (641, 2, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-13 00:39:36.624193', '2025-10-09 09:50:36.642518', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (868, 5, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:40:08.727361', '2025-10-11 10:40:08.727361', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (869, 4, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:40:08.732823', '2025-10-11 10:40:08.732823', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (870, 7, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:40:08.735792', '2025-10-11 10:40:08.735792', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (871, 8, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:40:08.73768', '2025-10-11 10:40:08.73768', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (872, 9, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:40:08.739394', '2025-10-11 10:40:08.739394', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (873, 6, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:40:08.741029', '2025-10-11 10:40:08.741029', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (874, 2, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:40:08.742662', '2025-10-11 10:40:08.742662', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (875, 3, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 10:40:08.74563', '2025-10-11 10:40:08.74563', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (876, 4, 'Warranty Work Order Assigned', 'You have been assigned to warranty work order WW-76/25', 'warranty_work_order', false, 'warranty_work_order', 9, '2025-10-11 10:40:08.747672', '2025-10-11 10:40:08.747672', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (651, 9, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:45:37.793409', '2025-09-13 00:45:37.793409', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (653, 7, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:45:37.804461', '2025-09-13 00:45:37.804461', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (654, 8, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:45:37.807842', '2025-09-13 00:45:37.807842', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (655, 4, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:45:37.810622', '2025-09-13 00:45:37.810622', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (656, 3, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 12, '2025-09-13 00:45:37.813631', '2025-09-13 00:45:37.813631', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (649, 5, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:45:37.781947', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (657, 5, 'Work Order Assigned', 'You have been assigned to work order 69/25', 'work_order', true, 'work_order', 24, '2025-09-13 00:45:37.816769', '2025-09-13 01:27:00.607749', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (652, 6, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:45:37.798024', '2025-10-07 11:19:31.193025', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (650, 2, 'Repair Ticket Converted', 'Repair ticket 69/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 12, '2025-09-13 00:45:37.790175', '2025-10-09 09:50:36.641044', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (877, 5, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 11:47:45.921123', '2025-10-11 11:47:45.921123', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (878, 4, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 11:47:45.926406', '2025-10-11 11:47:45.926406', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (879, 7, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 11:47:45.927869', '2025-10-11 11:47:45.927869', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (880, 8, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 11:47:45.929266', '2025-10-11 11:47:45.929266', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (881, 9, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 11:47:45.930818', '2025-10-11 11:47:45.930818', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (882, 6, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 11:47:45.932282', '2025-10-11 11:47:45.932282', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (883, 2, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 11:47:45.933824', '2025-10-11 11:47:45.933824', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (884, 3, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-76/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 9, '2025-10-11 11:47:45.935533', '2025-10-11 11:47:45.935533', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (885, 4, 'Warranty Work Order Assigned', 'You have been assigned to warranty work order WW-76/25', 'warranty_work_order', false, 'warranty_work_order', 10, '2025-10-11 11:47:45.937332', '2025-10-11 11:47:45.937332', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (658, 8, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-17 21:50:17.097599', '2025-09-17 21:50:17.097599', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (660, 4, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-17 21:50:17.111368', '2025-09-17 21:50:17.111368', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (661, 9, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-17 21:50:17.116917', '2025-09-17 21:50:17.116917', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (663, 5, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-17 21:50:17.126101', '2025-09-17 21:50:17.126101', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (664, 3, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-17 21:50:17.129265', '2025-09-17 21:50:17.129265', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (665, 7, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 9, '2025-09-17 21:50:17.133569', '2025-09-17 21:50:17.133569', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (666, 5, 'Work Order Assigned', 'You have been assigned to work order 65/25', 'work_order', false, 'work_order', 25, '2025-09-17 21:50:17.136828', '2025-09-17 21:50:17.136828', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (667, 8, 'Work Order Status Changed', 'Work order 65/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 25, '2025-09-17 21:51:25.674225', '2025-09-17 21:51:25.674225', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (669, 4, 'Work Order Status Changed', 'Work order 65/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 25, '2025-09-17 21:51:25.682436', '2025-09-17 21:51:25.682436', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (670, 9, 'Work Order Status Changed', 'Work order 65/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 25, '2025-09-17 21:51:25.685989', '2025-09-17 21:51:25.685989', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (672, 5, 'Work Order Status Changed', 'Work order 65/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 25, '2025-09-17 21:51:25.708502', '2025-09-17 21:51:25.708502', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (673, 3, 'Work Order Status Changed', 'Work order 65/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 25, '2025-09-17 21:51:25.712422', '2025-09-17 21:51:25.712422', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (674, 7, 'Work Order Status Changed', 'Work order 65/25 status changed from pending to in_progress', 'work_order', false, 'work_order', 25, '2025-09-17 21:51:25.719285', '2025-09-17 21:51:25.719285', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (662, 6, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-17 21:50:17.121415', '2025-10-07 11:19:31.081859', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (671, 6, 'Work Order Status Changed', 'Work order 65/25 status changed from pending to in_progress', 'work_order', true, 'work_order', 25, '2025-09-17 21:51:25.692389', '2025-10-07 11:19:31.087522', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (668, 2, 'Work Order Status Changed', 'Work order 65/25 status changed from pending to in_progress', 'work_order', true, 'work_order', 25, '2025-09-17 21:51:25.678006', '2025-10-09 09:50:36.6377', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (659, 2, 'Repair Ticket Converted', 'Repair ticket 65/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 9, '2025-09-17 21:50:17.10856', '2025-10-09 09:50:36.639552', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (886, 5, 'Work Order Status Changed', 'Work order TK-73/25 status changed from completed to intake', 'work_order', false, 'work_order', 27, '2025-10-11 11:50:34.305011', '2025-10-11 11:50:34.305011', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (887, 4, 'Work Order Status Changed', 'Work order TK-73/25 status changed from completed to intake', 'work_order', false, 'work_order', 27, '2025-10-11 11:50:34.309122', '2025-10-11 11:50:34.309122', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (888, 7, 'Work Order Status Changed', 'Work order TK-73/25 status changed from completed to intake', 'work_order', false, 'work_order', 27, '2025-10-11 11:50:34.312165', '2025-10-11 11:50:34.312165', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (889, 8, 'Work Order Status Changed', 'Work order TK-73/25 status changed from completed to intake', 'work_order', false, 'work_order', 27, '2025-10-11 11:50:34.314547', '2025-10-11 11:50:34.314547', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (890, 9, 'Work Order Status Changed', 'Work order TK-73/25 status changed from completed to intake', 'work_order', false, 'work_order', 27, '2025-10-11 11:50:34.317387', '2025-10-11 11:50:34.317387', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (891, 6, 'Work Order Status Changed', 'Work order TK-73/25 status changed from completed to intake', 'work_order', false, 'work_order', 27, '2025-10-11 11:50:34.320816', '2025-10-11 11:50:34.320816', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (892, 2, 'Work Order Status Changed', 'Work order TK-73/25 status changed from completed to intake', 'work_order', false, 'work_order', 27, '2025-10-11 11:50:34.323075', '2025-10-11 11:50:34.323075', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (893, 3, 'Work Order Status Changed', 'Work order TK-73/25 status changed from completed to intake', 'work_order', false, 'work_order', 27, '2025-10-11 11:50:34.325711', '2025-10-11 11:50:34.325711', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (675, 8, 'Work Order Status Changed', 'Work order 65/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 25, '2025-09-17 21:53:04.474302', '2025-09-17 21:53:04.474302', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (677, 4, 'Work Order Status Changed', 'Work order 65/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 25, '2025-09-17 21:53:04.484618', '2025-09-17 21:53:04.484618', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (678, 9, 'Work Order Status Changed', 'Work order 65/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 25, '2025-09-17 21:53:04.487406', '2025-09-17 21:53:04.487406', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (680, 5, 'Work Order Status Changed', 'Work order 65/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 25, '2025-09-17 21:53:04.492913', '2025-09-17 21:53:04.492913', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (681, 3, 'Work Order Status Changed', 'Work order 65/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 25, '2025-09-17 21:53:04.495092', '2025-09-17 21:53:04.495092', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (682, 7, 'Work Order Status Changed', 'Work order 65/25 status changed from in_progress to completed', 'work_order', false, 'work_order', 25, '2025-09-17 21:53:04.4976', '2025-09-17 21:53:04.4976', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (679, 6, 'Work Order Status Changed', 'Work order 65/25 status changed from in_progress to completed', 'work_order', true, 'work_order', 25, '2025-09-17 21:53:04.490227', '2025-10-07 11:19:31.077473', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (676, 2, 'Work Order Status Changed', 'Work order 65/25 status changed from in_progress to completed', 'work_order', true, 'work_order', 25, '2025-09-17 21:53:04.481638', '2025-10-09 09:50:36.623476', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (894, 5, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 11:50:48.620235', '2025-10-11 11:50:48.620235', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (895, 4, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 11:50:48.623364', '2025-10-11 11:50:48.623364', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (896, 7, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 11:50:48.625318', '2025-10-11 11:50:48.625318', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (897, 8, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 11:50:48.627114', '2025-10-11 11:50:48.627114', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (898, 9, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 11:50:48.629015', '2025-10-11 11:50:48.629015', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (899, 6, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 11:50:48.631003', '2025-10-11 11:50:48.631003', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (900, 2, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 11:50:48.632774', '2025-10-11 11:50:48.632774', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (901, 3, 'Repair Ticket Converted', 'Repair ticket TK-73/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 15, '2025-10-11 11:50:48.634494', '2025-10-11 11:50:48.634494', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (902, 4, 'Work Order Assigned', 'You have been assigned to work order WO-73/25', 'work_order', false, 'work_order', 28, '2025-10-11 11:50:48.635965', '2025-10-11 11:50:48.635965', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (903, 5, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-72/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-11 11:55:01.846289', '2025-10-11 11:55:01.846289', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (904, 4, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-72/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-11 11:55:01.850142', '2025-10-11 11:55:01.850142', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (905, 7, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-72/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-11 11:55:01.851661', '2025-10-11 11:55:01.851661', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (906, 8, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-72/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-11 11:55:01.853144', '2025-10-11 11:55:01.853144', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (907, 9, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-72/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-11 11:55:01.855102', '2025-10-11 11:55:01.855102', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (908, 6, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-72/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-11 11:55:01.857528', '2025-10-11 11:55:01.857528', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (909, 2, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-72/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-11 11:55:01.859874', '2025-10-11 11:55:01.859874', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (910, 3, 'Warranty Repair Ticket Converted', 'Warranty Repair ticket WT-72/25 has been converted to a work order', 'warranty_repair_ticket', false, 'warranty_repair_ticket', 6, '2025-10-11 11:55:01.861681', '2025-10-11 11:55:01.861681', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (911, 4, 'Warranty Work Order Assigned', 'You have been assigned to warranty work order WW-72/25', 'warranty_work_order', false, 'warranty_work_order', 11, '2025-10-11 11:55:01.863623', '2025-10-11 11:55:01.863623', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (912, 4, 'Repair Ticket Converted', 'Repair ticket TK-71/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 14, '2025-10-11 12:12:12.368438', '2025-10-11 12:12:12.368438', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (913, 7, 'Repair Ticket Converted', 'Repair ticket TK-71/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 14, '2025-10-11 12:12:12.375151', '2025-10-11 12:12:12.375151', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (914, 8, 'Repair Ticket Converted', 'Repair ticket TK-71/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 14, '2025-10-11 12:12:12.377664', '2025-10-11 12:12:12.377664', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (915, 9, 'Repair Ticket Converted', 'Repair ticket TK-71/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 14, '2025-10-11 12:12:12.380521', '2025-10-11 12:12:12.380521', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (916, 6, 'Repair Ticket Converted', 'Repair ticket TK-71/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 14, '2025-10-11 12:12:12.383011', '2025-10-11 12:12:12.383011', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (917, 2, 'Repair Ticket Converted', 'Repair ticket TK-71/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 14, '2025-10-11 12:12:12.385241', '2025-10-11 12:12:12.385241', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (918, 3, 'Repair Ticket Converted', 'Repair ticket TK-71/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 14, '2025-10-11 12:12:12.387218', '2025-10-11 12:12:12.387218', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (919, 1, 'Repair Ticket Converted', 'Repair ticket TK-71/25 has been converted to a work order', 'repair_ticket', false, 'repair_ticket', 14, '2025-10-11 12:12:12.389181', '2025-10-11 12:12:12.389181', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (920, 9, 'Work Order Created', 'New work order WO-71/25 has been created', 'work_order', false, 'work_order', 29, '2025-10-11 12:12:12.392144', '2025-10-11 12:12:12.392144', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (921, 2, 'Work Order Created', 'New work order WO-71/25 has been created', 'work_order', false, 'work_order', 29, '2025-10-11 12:12:12.394123', '2025-10-11 12:12:12.394123', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (922, 1, 'Work Order Created', 'New work order WO-71/25 has been created', 'work_order', false, 'work_order', 29, '2025-10-11 12:12:12.396211', '2025-10-11 12:12:12.396211', '', '', '{}');
INSERT INTO public.notifications (id, user_id, title, message, type, is_read, related_entity_type, related_entity_id, created_at, updated_at, title_key, message_key, message_params) VALUES (508, 5, 'Repair Ticket Converted', 'Repair ticket 67/25 has been converted to a work order', 'repair_ticket', true, 'repair_ticket', 11, '2025-09-12 11:36:50.796774', '2025-09-12 11:37:08.770083', '', '', '{}');


--
-- TOC entry 6201 (class 0 OID 314309)
-- Dependencies: 316
-- Data for Name: pricing_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 6197 (class 0 OID 314267)
-- Dependencies: 312
-- Data for Name: pricing_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.pricing_rules (id, name, description, rule_type, is_active, priority, conditions, adjustments, created_by, created_at, updated_at) VALUES (1, 'High Demand Multiplier', 'Increase prices during high demand periods', 'demand', true, 3, '{"demand_level": "high"}', '{"daily_multiplier": 1.3, "weekly_multiplier": 1.2, "monthly_multiplier": 1.1}', NULL, '2025-09-19 15:01:21.124133', '2025-09-19 15:01:21.124133');
INSERT INTO public.pricing_rules (id, name, description, rule_type, is_active, priority, conditions, adjustments, created_by, created_at, updated_at) VALUES (2, 'Peak Demand Multiplier', 'Significant price increase during peak demand', 'demand', true, 4, '{"demand_level": "peak"}', '{"daily_multiplier": 1.5, "weekly_multiplier": 1.3, "monthly_multiplier": 1.2}', NULL, '2025-09-19 15:01:21.124133', '2025-09-19 15:01:21.124133');
INSERT INTO public.pricing_rules (id, name, description, rule_type, is_active, priority, conditions, adjustments, created_by, created_at, updated_at) VALUES (3, 'Low Demand Discount', 'Reduce prices during low demand periods', 'demand', true, 2, '{"demand_level": "low"}', '{"daily_multiplier": 0.8, "weekly_multiplier": 0.85, "monthly_multiplier": 0.9}', NULL, '2025-09-19 15:01:21.124133', '2025-09-19 15:01:21.124133');
INSERT INTO public.pricing_rules (id, name, description, rule_type, is_active, priority, conditions, adjustments, created_by, created_at, updated_at) VALUES (4, 'Summer Premium', 'Higher prices during summer months', 'seasonal', true, 2, '{"season": "summer"}', '{"daily_multiplier": 1.2, "weekly_multiplier": 1.15, "monthly_multiplier": 1.1}', NULL, '2025-09-19 15:01:21.124133', '2025-09-19 15:01:21.124133');
INSERT INTO public.pricing_rules (id, name, description, rule_type, is_active, priority, conditions, adjustments, created_by, created_at, updated_at) VALUES (5, 'Winter Discount', 'Lower prices during winter months', 'seasonal', true, 2, '{"season": "winter"}', '{"daily_multiplier": 0.9, "weekly_multiplier": 0.85, "monthly_multiplier": 0.8}', NULL, '2025-09-19 15:01:21.124133', '2025-09-19 15:01:21.124133');
INSERT INTO public.pricing_rules (id, name, description, rule_type, is_active, priority, conditions, adjustments, created_by, created_at, updated_at) VALUES (6, 'Low Availability Premium', 'Higher prices when availability is low', 'availability', true, 3, '{"availability_percentage": {"lt": 20}}', '{"daily_multiplier": 1.4, "weekly_multiplier": 1.3, "monthly_multiplier": 1.2}', NULL, '2025-09-19 15:01:21.124133', '2025-09-19 15:01:21.124133');
INSERT INTO public.pricing_rules (id, name, description, rule_type, is_active, priority, conditions, adjustments, created_by, created_at, updated_at) VALUES (7, 'Long Term Discount', 'Discount for longer rental periods', 'duration', true, 1, '{"rental_days": {"gte": 30}}', '{"daily_multiplier": 0.7, "weekly_multiplier": 0.75, "monthly_multiplier": 0.8}', NULL, '2025-09-19 15:01:21.124133', '2025-09-19 15:01:21.124133');
INSERT INTO public.pricing_rules (id, name, description, rule_type, is_active, priority, conditions, adjustments, created_by, created_at, updated_at) VALUES (8, 'Short Term Premium', 'Premium for very short rentals', 'duration', true, 1, '{"rental_days": {"lte": 3}}', '{"daily_multiplier": 1.2, "weekly_multiplier": 1.1, "monthly_multiplier": 1.05}', NULL, '2025-09-19 15:01:21.124133', '2025-09-19 15:01:21.124133');


--
-- TOC entry 6173 (class 0 OID 287816)
-- Dependencies: 281
-- Data for Name: quote_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.quote_items (id, quote_id, description, quantity, unit_price, total, "position", created_at, item_type, item_reference_id, item_name, total_price, category) VALUES (11, 12, 'Karcher - BR 40/10 C Adv (1.783-310.0)', 1.00, 6750.00, 0.00, 0, '2025-10-09 14:10:52.076706', 'machine', 3, 'BR 40/10 C Adv', 6750.00, 'Floor Scrubbers');
INSERT INTO public.quote_items (id, quote_id, description, quantity, unit_price, total, "position", created_at, item_type, item_reference_id, item_name, total_price, category) VALUES (13, 13, 'Karcher - BR 40/10 C Adv (1.783-310.0)', 1.00, 6750.00, 6750.00, 0, '2025-10-09 14:23:52.351579', 'custom', NULL, NULL, NULL, NULL);


--
-- TOC entry 6221 (class 0 OID 338672)
-- Dependencies: 336
-- Data for Name: quote_template_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.quote_template_items (id, template_id, item_type, item_reference_id, item_name, description, quantity, unit_price, category, "position", created_at) VALUES (1, 1, 'service', NULL, 'Delivery & Installation', 'Professional delivery and on-site installation', 1, NULL, 'Installation Services', 0, '2025-10-09 09:56:20.732175');
INSERT INTO public.quote_template_items (id, template_id, item_type, item_reference_id, item_name, description, quantity, unit_price, category, "position", created_at) VALUES (2, 1, 'service', NULL, 'Training Session', 'Basic operation and maintenance training (2 hours)', 1, NULL, 'Training Services', 1, '2025-10-09 09:56:20.737109');
INSERT INTO public.quote_template_items (id, template_id, item_type, item_reference_id, item_name, description, quantity, unit_price, category, "position", created_at) VALUES (3, 3, 'service', NULL, 'Annual Maintenance', 'Comprehensive annual maintenance service', 1, NULL, 'Maintenance Services', 0, '2025-10-09 09:56:20.738221');
INSERT INTO public.quote_template_items (id, template_id, item_type, item_reference_id, item_name, description, quantity, unit_price, category, "position", created_at) VALUES (4, 1, 'service', NULL, 'Delivery & Installation', 'Professional delivery and on-site installation', 1, NULL, 'Installation Services', 0, '2025-10-09 09:59:27.192594');
INSERT INTO public.quote_template_items (id, template_id, item_type, item_reference_id, item_name, description, quantity, unit_price, category, "position", created_at) VALUES (5, 5, 'service', NULL, 'Delivery & Installation', 'Professional delivery and on-site installation', 1, NULL, 'Installation Services', 0, '2025-10-09 09:59:27.192594');
INSERT INTO public.quote_template_items (id, template_id, item_type, item_reference_id, item_name, description, quantity, unit_price, category, "position", created_at) VALUES (6, 1, 'service', NULL, 'Training Session', 'Basic operation and maintenance training (2 hours)', 1, NULL, 'Training Services', 1, '2025-10-09 09:59:27.195796');
INSERT INTO public.quote_template_items (id, template_id, item_type, item_reference_id, item_name, description, quantity, unit_price, category, "position", created_at) VALUES (7, 5, 'service', NULL, 'Training Session', 'Basic operation and maintenance training (2 hours)', 1, NULL, 'Training Services', 1, '2025-10-09 09:59:27.195796');
INSERT INTO public.quote_template_items (id, template_id, item_type, item_reference_id, item_name, description, quantity, unit_price, category, "position", created_at) VALUES (8, 3, 'service', NULL, 'Annual Maintenance', 'Comprehensive annual maintenance service', 1, NULL, 'Maintenance Services', 0, '2025-10-09 09:59:27.197151');
INSERT INTO public.quote_template_items (id, template_id, item_type, item_reference_id, item_name, description, quantity, unit_price, category, "position", created_at) VALUES (9, 7, 'service', NULL, 'Annual Maintenance', 'Comprehensive annual maintenance service', 1, NULL, 'Maintenance Services', 0, '2025-10-09 09:59:27.197151');


--
-- TOC entry 6219 (class 0 OID 338653)
-- Dependencies: 334
-- Data for Name: quote_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.quote_templates (id, template_name, template_type, description, default_valid_days, default_terms_conditions, default_payment_terms, default_delivery_terms, default_discount_percentage, is_active, created_by, created_at, updated_at) VALUES (1, 'New Machine Sale', 'machine_sale', 'Standard template for selling new machines to customers', 30, '1. Prices are valid for 30 days from quote date
2. Delivery time: 2-4 weeks from order confirmation
3. Installation and training included
4. 12-month manufacturer warranty included
5. Payment required before delivery', 'Payment terms: 50% deposit, 50% on delivery', NULL, 0.00, true, 1, '2025-10-09 09:56:20.721409', '2025-10-09 09:56:20.721409');
INSERT INTO public.quote_templates (id, template_name, template_type, description, default_valid_days, default_terms_conditions, default_payment_terms, default_delivery_terms, default_discount_percentage, is_active, created_by, created_at, updated_at) VALUES (2, 'Parts Package', 'parts_package', 'Template for selling spare parts and accessories', 14, '1. Prices are valid for 14 days from quote date
2. Parts availability subject to stock
3. Delivery time: 3-5 business days
4. All parts come with 90-day warranty
5. Returns accepted within 14 days if unused', 'Payment terms: Full payment on order or Net 30 for established customers', NULL, 0.00, true, 1, '2025-10-09 09:56:20.721409', '2025-10-09 09:56:20.721409');
INSERT INTO public.quote_templates (id, template_name, template_type, description, default_valid_days, default_terms_conditions, default_payment_terms, default_delivery_terms, default_discount_percentage, is_active, created_by, created_at, updated_at) VALUES (3, 'Service & Maintenance', 'service', 'Template for service and maintenance contracts', 30, '1. Quote valid for 30 days
2. Service to be scheduled within 2 weeks of acceptance
3. All labor and parts included as specified
4. Additional repairs require separate approval
5. 90-day warranty on all work performed', 'Payment terms: Payment due upon completion of service', NULL, 0.00, true, 1, '2025-10-09 09:56:20.721409', '2025-10-09 09:56:20.721409');
INSERT INTO public.quote_templates (id, template_name, template_type, description, default_valid_days, default_terms_conditions, default_payment_terms, default_delivery_terms, default_discount_percentage, is_active, created_by, created_at, updated_at) VALUES (4, 'Custom Quote', 'custom', 'Blank template for custom quotes', 30, 'Standard terms and conditions apply. Please contact us for any questions.', 'Payment terms to be discussed', NULL, 0.00, true, 1, '2025-10-09 09:56:20.721409', '2025-10-09 09:56:20.721409');
INSERT INTO public.quote_templates (id, template_name, template_type, description, default_valid_days, default_terms_conditions, default_payment_terms, default_delivery_terms, default_discount_percentage, is_active, created_by, created_at, updated_at) VALUES (5, 'New Machine Sale', 'machine_sale', 'Standard template for selling new machines to customers', 30, '1. Prices are valid for 30 days from quote date
2. Delivery time: 2-4 weeks from order confirmation
3. Installation and training included
4. 12-month manufacturer warranty included
5. Payment required before delivery', 'Payment terms: 50% deposit, 50% on delivery', NULL, 0.00, true, 1, '2025-10-09 09:59:27.186153', '2025-10-09 09:59:27.186153');
INSERT INTO public.quote_templates (id, template_name, template_type, description, default_valid_days, default_terms_conditions, default_payment_terms, default_delivery_terms, default_discount_percentage, is_active, created_by, created_at, updated_at) VALUES (6, 'Parts Package', 'parts_package', 'Template for selling spare parts and accessories', 14, '1. Prices are valid for 14 days from quote date
2. Parts availability subject to stock
3. Delivery time: 3-5 business days
4. All parts come with 90-day warranty
5. Returns accepted within 14 days if unused', 'Payment terms: Full payment on order or Net 30 for established customers', NULL, 0.00, true, 1, '2025-10-09 09:59:27.186153', '2025-10-09 09:59:27.186153');
INSERT INTO public.quote_templates (id, template_name, template_type, description, default_valid_days, default_terms_conditions, default_payment_terms, default_delivery_terms, default_discount_percentage, is_active, created_by, created_at, updated_at) VALUES (7, 'Service & Maintenance', 'service', 'Template for service and maintenance contracts', 30, '1. Quote valid for 30 days
2. Service to be scheduled within 2 weeks of acceptance
3. All labor and parts included as specified
4. Additional repairs require separate approval
5. 90-day warranty on all work performed', 'Payment terms: Payment due upon completion of service', NULL, 0.00, true, 1, '2025-10-09 09:59:27.186153', '2025-10-09 09:59:27.186153');
INSERT INTO public.quote_templates (id, template_name, template_type, description, default_valid_days, default_terms_conditions, default_payment_terms, default_delivery_terms, default_discount_percentage, is_active, created_by, created_at, updated_at) VALUES (8, 'Custom Quote', 'custom', 'Blank template for custom quotes', 30, 'Standard terms and conditions apply. Please contact us for any questions.', 'Payment terms to be discussed', NULL, 0.00, true, 1, '2025-10-09 09:59:27.186153', '2025-10-09 09:59:27.186153');


--
-- TOC entry 6171 (class 0 OID 287786)
-- Dependencies: 279
-- Data for Name: quotes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.quotes (id, quote_number, customer_id, customer_name, customer_email, customer_phone, title, description, subtotal, tax_rate, tax_amount, discount_amount, total_amount, status, valid_until, notes, terms_conditions, sent_at, viewed_at, accepted_at, rejected_at, converted_at, created_by, created_at, updated_at, declined_at, follow_up_reminder_date, discount_percentage, payment_terms, delivery_terms, quote_type, template_id, version, parent_quote_id, year_created, formatted_number) VALUES (12, 1, 6, 'Hamza Merdžanić', 'hamza@kamer.ba', '061 174 610', 'test', 'test', 6750.00, 17.00, 1032.75, 675.00, 7107.75, 'draft', '2025-10-31', 'test', 'test', NULL, NULL, NULL, NULL, NULL, 2, '2025-10-09 14:10:52.061306', '2025-10-10 10:17:36.173769', NULL, NULL, 10.00, 'test', 'test', 'custom', NULL, 1, NULL, 2025, 'QT-1/25');
INSERT INTO public.quotes (id, quote_number, customer_id, customer_name, customer_email, customer_phone, title, description, subtotal, tax_rate, tax_amount, discount_amount, total_amount, status, valid_until, notes, terms_conditions, sent_at, viewed_at, accepted_at, rejected_at, converted_at, created_by, created_at, updated_at, declined_at, follow_up_reminder_date, discount_percentage, payment_terms, delivery_terms, quote_type, template_id, version, parent_quote_id, year_created, formatted_number) VALUES (13, 2, 2, 'Maria Garcia', 'maria.garcia@example.com', '38761234567', 'test (Copy)', 'test', 6750.00, 17.00, NULL, NULL, NULL, 'draft', '2025-11-07', 'test', 'test', NULL, NULL, NULL, NULL, NULL, 2, '2025-10-09 14:12:18.465551', '2025-10-10 10:17:36.173769', NULL, NULL, 10.00, 'test', 'test', 'custom', NULL, 1, 12, 2025, 'QT-2/25');


--
-- TOC entry 6185 (class 0 OID 314143)
-- Dependencies: 300
-- Data for Name: rental_machine_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.rental_machine_status_history (id, rental_machine_id, old_status, new_status, reason, changed_by, changed_at, notes) VALUES (1, 4, 'available', 'rented', NULL, NULL, '2025-09-19 16:02:26.778787', NULL);
INSERT INTO public.rental_machine_status_history (id, rental_machine_id, old_status, new_status, reason, changed_by, changed_at, notes) VALUES (2, 4, 'rented', 'available', NULL, NULL, '2025-09-19 16:06:18.885577', NULL);
INSERT INTO public.rental_machine_status_history (id, rental_machine_id, old_status, new_status, reason, changed_by, changed_at, notes) VALUES (3, 4, 'available', 'rented', NULL, NULL, '2025-09-19 16:07:43.932285', NULL);
INSERT INTO public.rental_machine_status_history (id, rental_machine_id, old_status, new_status, reason, changed_by, changed_at, notes) VALUES (36, 4, 'rented', 'available', NULL, NULL, '2025-10-01 14:51:06.040169', NULL);


--
-- TOC entry 6183 (class 0 OID 314107)
-- Dependencies: 298
-- Data for Name: rental_machines; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.rental_machines (id, model_id, serial_number, rental_status, condition, location, notes, created_by, created_at, updated_at) VALUES (4, 4, '4578 525', 'available', 'excellent', 'Skladište', 'Dobra', 1, '2025-09-19 11:04:05.635737', '2025-10-01 14:51:06.040169');
INSERT INTO public.rental_machines (id, model_id, serial_number, rental_status, condition, location, notes, created_by, created_at, updated_at) VALUES (5, 1, '12321321', 'available', 'fair', 'Skladište', 'test', 1, '2025-09-19 11:57:05.161801', '2025-10-07 12:09:18.966705');


--
-- TOC entry 6187 (class 0 OID 314166)
-- Dependencies: 302
-- Data for Name: rental_status_transition_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (1, 'available', 'rented', false, NULL, 'Machine rented to customer', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (2, 'rented', 'cleaning', false, NULL, 'Machine returned and needs cleaning', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (3, 'cleaning', 'inspection', false, 2, 'Auto-transition to inspection after 2 hours', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (4, 'inspection', 'available', false, 1, 'Auto-transition to available after 1 hour', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (5, 'inspection', 'repair', true, NULL, 'Issues found during inspection', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (6, 'inspection', 'quarantine', true, NULL, 'Safety issues found during inspection', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (7, 'available', 'maintenance', true, NULL, 'Scheduled maintenance', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (8, 'maintenance', 'inspection', false, NULL, 'Maintenance completed, needs inspection', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (9, 'maintenance', 'repair', true, NULL, 'Maintenance revealed repair needs', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (10, 'repair', 'inspection', false, NULL, 'Repair completed, needs inspection', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (11, 'repair', 'quarantine', true, NULL, 'Repair failed or safety concerns', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (12, 'quarantine', 'repair', true, NULL, 'Issues resolved, needs repair', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (13, 'quarantine', 'inspection', true, NULL, 'Issues resolved, needs inspection', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (14, 'quarantine', 'retired', true, NULL, 'Machine deemed unsafe for service', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (15, 'available', 'reserved', false, NULL, 'Machine reserved for future rental', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (16, 'reserved', 'rented', false, NULL, 'Reserved rental becomes active', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (17, 'available', 'retired', true, NULL, 'Machine retired from service', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (18, 'maintenance', 'retired', true, NULL, 'Machine retired during maintenance', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (19, 'repair', 'retired', true, NULL, 'Machine retired during repair', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (20, 'quarantine', 'retired', true, NULL, 'Machine retired from quarantine', '2025-09-19 13:46:13.093605');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (21, 'available', 'rented', false, NULL, 'Machine rented to customer', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (22, 'rented', 'cleaning', false, NULL, 'Machine returned and needs cleaning', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (23, 'cleaning', 'inspection', false, 2, 'Auto-transition to inspection after 2 hours', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (24, 'inspection', 'available', false, 1, 'Auto-transition to available after 1 hour', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (25, 'inspection', 'repair', true, NULL, 'Issues found during inspection', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (26, 'inspection', 'quarantine', true, NULL, 'Safety issues found during inspection', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (27, 'available', 'maintenance', true, NULL, 'Scheduled maintenance', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (28, 'maintenance', 'inspection', false, NULL, 'Maintenance completed, needs inspection', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (29, 'maintenance', 'repair', true, NULL, 'Maintenance revealed repair needs', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (30, 'repair', 'inspection', false, NULL, 'Repair completed, needs inspection', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (31, 'repair', 'quarantine', true, NULL, 'Repair failed or safety concerns', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (32, 'quarantine', 'repair', true, NULL, 'Issues resolved, needs repair', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (33, 'quarantine', 'inspection', true, NULL, 'Issues resolved, needs inspection', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (34, 'quarantine', 'retired', true, NULL, 'Machine deemed unsafe for service', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (35, 'available', 'reserved', false, NULL, 'Machine reserved for future rental', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (36, 'reserved', 'rented', false, NULL, 'Reserved rental becomes active', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (37, 'available', 'retired', true, NULL, 'Machine retired from service', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (38, 'maintenance', 'retired', true, NULL, 'Machine retired during maintenance', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (39, 'repair', 'retired', true, NULL, 'Machine retired during repair', '2025-09-19 13:46:29.146107');
INSERT INTO public.rental_status_transition_rules (id, from_status, to_status, requires_approval, auto_transition_after_hours, description, created_at) VALUES (40, 'quarantine', 'retired', true, NULL, 'Machine retired from quarantine', '2025-09-19 13:46:29.146107');


--
-- TOC entry 6147 (class 0 OID 228952)
-- Dependencies: 253
-- Data for Name: repair_tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (15, 18, 15, 'Curi na nogu', 'converted', 5, '2025-10-11 09:58:54.494681', '2025-10-11 11:50:48.605671', '2025-10-11 11:50:48.605671', 28, NULL, 10, 'Curi na nogu', 'Mašina haos loša, treba je bacit', 'Crijevom, pistoljem, ...', 'Adnan', 'TK-73/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'high');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (14, 10, 13, 'test', 'intake', 1, '2025-10-08 13:29:24.04239', '2025-10-11 12:12:30.651741', NULL, NULL, NULL, 9, 'test', 'test', 'test', 'test', 'TK-71/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (1, 1, 2, 'Mašina se upali i radi 5 minuta, poslije toga trza i ugasi se.', 'converted', 1, '2025-09-06 20:04:15.68312', '2025-10-10 10:17:36.125791', '2025-09-06 23:14:13.612688', 3, NULL, 1, 'Mašina se upali i radi 5 minuta, poslije toga trza i ugasi se.', 'Pogledati pumpu i ostalo.', 'Crijevo, pištolj, mlazncie', 'John', 'TK-53/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (2, 6, 4, 'Test', 'converted', 1, '2025-09-07 02:28:36.889912', '2025-10-10 10:17:36.125791', '2025-09-07 03:50:10.852363', 4, NULL, 2, 'Test', 'test', 'test', 'test', 'TK-55/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (7, 6, 4, 'Test', 'converted', 1, '2025-09-08 10:48:13.931134', '2025-10-10 10:17:36.125791', '2025-09-08 10:55:10.87366', 5, NULL, 3, 'Test', 'Test', 'Test', 'Test', 'TK-61/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'high');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (10, 9, 6, 'test', 'converted', 5, '2025-09-09 19:35:24.190293', '2025-10-10 10:17:36.125791', '2025-09-09 19:39:18.600571', 6, NULL, 6, 'test', 'test', 'test', 'test', 'TK-66/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'high');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (11, 9, 7, 'ete', 'converted', 5, '2025-09-11 14:29:24.400351', '2025-10-10 10:17:36.125791', '2025-09-13 00:13:49.836746', 16, NULL, 7, 'ete', 'test', 'test', 'test', 'TK-67/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (12, 10, 11, 'asa', 'converted', 5, '2025-09-12 11:48:07.041133', '2025-10-10 10:17:36.125791', '2025-09-13 00:45:37.753025', 24, NULL, 4, 'asa', 'ad', 'asd', 'sad', 'TK-69/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (9, 6, 4, 'test', 'converted', 5, '2025-09-09 09:29:43.68529', '2025-10-10 10:17:36.125791', '2025-09-17 21:50:16.97033', 25, NULL, 5, 'test', 'test', 'tet', 'tet', 'TK-65/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.repair_tickets (id, customer_id, machine_id, description, status, submitted_by, created_at, updated_at, converted_at, converted_to_work_order_id, converted_to_warranty_work_order_id, ticket_number, problem_description, notes, additional_equipment, brought_by, formatted_number, year_created, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (13, 10, 13, 'test', 'converted', 1, '2025-10-08 13:25:12.41124', '2025-10-10 10:17:36.125791', '2025-10-08 13:25:33.973487', 26, NULL, 8, 'test', 'test', 'test', 'test', 'TK-70/25', 2025, false, NULL, 0.00, NULL, 'unknown', 'medium');


--
-- TOC entry 6209 (class 0 OID 322266)
-- Dependencies: 324
-- Data for Name: sales_targets; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.sales_targets (id, user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by, created_at, updated_at, is_active) VALUES (1, 6, 'monthly', 50000.00, '2025-10-01', '2025-10-31', 'Monthly target for Sales Representative', 1, '2025-10-07 13:27:23.889973', '2025-10-07 13:27:23.889973', true);
INSERT INTO public.sales_targets (id, user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by, created_at, updated_at, is_active) VALUES (4, 8, 'monthly', 50000.00, '2025-10-01', '2025-10-31', 'Monthly target for Sarah Martinez', 1, '2025-10-07 13:27:23.903828', '2025-10-07 13:27:23.903828', true);
INSERT INTO public.sales_targets (id, user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by, created_at, updated_at, is_active) VALUES (5, 8, 'quarterly', 150000.00, '2025-10-01', '2025-12-31', 'Quarterly target for Sarah Martinez', 1, '2025-10-07 13:27:23.905734', '2025-10-07 13:27:23.905734', true);
INSERT INTO public.sales_targets (id, user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by, created_at, updated_at, is_active) VALUES (6, 8, 'yearly', 600000.00, '2025-01-01', '2025-12-31', 'Yearly target for Sarah Martinez', 1, '2025-10-07 13:27:23.907514', '2025-10-07 13:27:23.907514', true);
INSERT INTO public.sales_targets (id, user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by, created_at, updated_at, is_active) VALUES (7, 7, 'monthly', 50000.00, '2025-10-01', '2025-10-31', 'Monthly target for John Sales', 1, '2025-10-07 13:27:23.909479', '2025-10-07 13:27:23.909479', true);
INSERT INTO public.sales_targets (id, user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by, created_at, updated_at, is_active) VALUES (8, 7, 'quarterly', 150000.00, '2025-10-01', '2025-12-31', 'Quarterly target for John Sales', 1, '2025-10-07 13:27:23.91138', '2025-10-07 13:27:23.91138', true);
INSERT INTO public.sales_targets (id, user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by, created_at, updated_at, is_active) VALUES (9, 7, 'yearly', 600000.00, '2025-01-01', '2025-12-31', 'Yearly target for John Sales', 1, '2025-10-07 13:27:23.912827', '2025-10-07 13:27:23.912827', true);
INSERT INTO public.sales_targets (id, user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by, created_at, updated_at, is_active) VALUES (3, 6, 'yearly', 100000.00, '2025-01-01', '2025-12-01', 'Yearly target for Sales Representative', 1, '2025-10-07 13:27:23.902388', '2025-10-07 14:36:31.458492', true);
INSERT INTO public.sales_targets (id, user_id, target_type, target_amount, target_period_start, target_period_end, description, created_by, created_at, updated_at, is_active) VALUES (2, 6, 'quarterly', 50000.00, '2025-10-31', '2025-12-31', 'Quarterly target for Sales Representative', 1, '2025-10-07 13:27:23.90077', '2025-10-07 14:37:18.317759', true);


--
-- TOC entry 6144 (class 0 OID 220682)
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
-- TOC entry 6141 (class 0 OID 85215)
-- Dependencies: 247
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: repairadmin
--



--
-- TOC entry 6139 (class 0 OID 85200)
-- Dependencies: 245
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

INSERT INTO public.suppliers (id, name, email, phone, address, category, contact_person, website, payment_terms, status, notes, created_at, updated_at) VALUES (1, 'Bosch Power Tools', 'sales@bosch.com', '+49 711 811-0', 'Robert-Bosch-Platz 1, 70839 Gerlingen, Germany', 'Power Tools', 'Hans Mueller', 'https://www.bosch.com', 'Net 30', 'active', 'Leading manufacturer of power tools and accessories. Premium quality products with excellent warranty coverage.', '2025-09-07 05:58:42.490528', '2025-09-07 05:58:42.490528');
INSERT INTO public.suppliers (id, name, email, phone, address, category, contact_person, website, payment_terms, status, notes, created_at, updated_at) VALUES (2, 'Makita Corporation', 'info@makita.com', '+81 3 3649-5111', '3-11-8 Sumiyoshi-cho, Anjo, Aichi 446-8502, Japan', 'Power Tools', 'Yuki Tanaka', 'https://www.makita.com', 'Net 45', 'active', 'Japanese manufacturer known for reliable cordless tools and professional equipment. Strong dealer network.', '2025-09-07 05:58:42.490528', '2025-09-07 05:58:42.490528');
INSERT INTO public.suppliers (id, name, email, phone, address, category, contact_person, website, payment_terms, status, notes, created_at, updated_at) VALUES (3, 'DeWalt Industrial Tool Co.', 'customer.service@dewalt.com', '+1 800-433-9258', '701 E Joppa Rd, Towson, MD 21286, USA', 'Power Tools', 'Mike Johnson', 'https://www.dewalt.com', 'Net 30', 'active', 'American brand specializing in professional-grade power tools. Popular among contractors and tradespeople.', '2025-09-07 05:58:42.490528', '2025-09-07 05:58:42.490528');
INSERT INTO public.suppliers (id, name, email, phone, address, category, contact_person, website, payment_terms, status, notes, created_at, updated_at) VALUES (4, 'Milwaukee Tool', 'support@milwaukeetool.com', '+1 800-729-3878', '13135 W Lisbon Rd, Brookfield, WI 53005, USA', 'Power Tools', 'Sarah Williams', 'https://www.milwaukeetool.com', 'Net 30', 'active', 'Innovative power tool manufacturer with focus on cordless technology. Strong warranty and service support.', '2025-09-07 05:58:42.490528', '2025-09-07 05:58:42.490528');
INSERT INTO public.suppliers (id, name, email, phone, address, category, contact_person, website, payment_terms, status, notes, created_at, updated_at) VALUES (5, 'Hilti Corporation', 'info@hilti.com', '+41 58 244 22 22', 'Feldkircherstrasse 100, 9494 Schaan, Liechtenstein', 'Construction Tools', 'Andreas Schmidt', 'https://www.hilti.com', 'Net 60', 'active', 'Premium construction and building technology company. Direct sales model with comprehensive service programs.', '2025-09-07 05:58:42.490528', '2025-09-07 05:58:42.490528');


--
-- TOC entry 6217 (class 0 OID 330458)
-- Dependencies: 332
-- Data for Name: user_action_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (1, 7, 'John Sales', 'sales', 'sell', 'machine', 14, 'BR 40/10 C Adv - 58958658', '{"is_sale": true, "model_name": "BR 40/10 C Adv", "sale_price": "1500.00", "customer_id": 9, "manufacturer": "Karcher", "customer_name": "Zakir Činjarević", "machine_condition": "new"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', '2025-10-08 22:15:28.611406');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (2, 2, 'Manager User', 'manager', 'update', 'work_order', 16, '67/25', '{"status_change": {"to": "completed", "from": "in_progress"}, "updated_fields": ["status", "technician_id", "total_cost"], "technician_assigned": false}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', '2025-10-09 00:02:50.670861');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (3, 2, 'Manager User', 'manager', 'update', 'work_order', 16, '67/25', '{"status_change": null, "updated_fields": ["technician_id", "labor_hours", "total_cost"], "technician_assigned": false}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-10-09 00:17:45.610158');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (4, 2, 'Manager User', 'manager', 'update', 'work_order', 6, '66/25', '{"status_change": {"to": "completed", "from": "in_progress"}, "updated_fields": ["status", "technician_id", "total_cost"], "technician_assigned": false}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-10-09 00:18:09.706811');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (5, 2, 'Manager User', 'manager', 'update', 'lead', 3, 'test test', '{"sales_stage": "won", "lead_quality": "high", "updated_fields": ["customer_name", "company_name", "email", "phone", "potential_value", "lead_quality", "sales_stage", "assigned_to", "next_follow_up", "sales_notes", "source"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', '2025-10-09 09:26:38.381635');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (6, 2, 'Manager User', 'manager', 'create', 'quote', 2, 'Quote #2 - Zakir Činjarević', '{"items_count": 1, "total_amount": 1480.4990460000001, "customer_name": "Zakir Činjarević"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', '2025-10-09 10:09:03.535969');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (7, 2, 'Manager User', 'manager', 'delete', 'quote', 1, 'Quote #1 - test', '{"status": "sent", "total_amount": "0.00", "customer_name": "test"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', '2025-10-09 10:21:13.482229');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (8, 2, 'Manager User', 'manager', 'create', 'quote', 3, 'Quote #3 - Hamza Merdžanić', '{"items_count": 1, "total_amount": 8029.079721, "customer_name": "Hamza Merdžanić"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 10:50:03.756343');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (9, 2, 'Manager User', 'manager', 'create', 'quote', 4, 'Quote #4 - Maria Garcia', '{"items_count": 1, "total_amount": 2699.999406, "customer_name": "Maria Garcia"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 10:56:27.683083');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (10, 2, 'Manager User', 'manager', 'create', 'quote', 5, 'Quote #5 - Petra Novak', '{"items_count": 1, "total_amount": 1558.9665, "customer_name": "Petra Novak"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 11:20:28.984959');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (11, 2, 'Manager User', 'manager', 'create', 'quote', 6, 'Quote #6 - Lejla Merdžanić', '{"items_count": 1, "total_amount": 7107.75, "customer_name": "Lejla Merdžanić"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 11:24:02.927508');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (12, 2, 'Manager User', 'manager', 'create', 'quote', 7, 'Quote #7 - Petra Novak', '{"items_count": 1, "total_amount": 1558.9665, "customer_name": "Petra Novak"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 11:27:45.939111');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (13, 1, 'Admin User', 'admin', 'create', 'quote', 8, 'Quote #8 - Hamza Merdžanić', '{"items_count": 1, "total_amount": 1558.9665, "customer_name": "Hamza Merdžanić"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 11:46:25.429663');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (14, 1, 'Admin User', 'admin', 'create', 'quote', 11, 'Quote #9 - Petra Novak', '{"items_count": 1, "total_amount": 1558.9665, "customer_name": "Petra Novak"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 11:57:47.62985');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (15, 1, 'Admin User', 'admin', 'delete', 'quote', 2, 'Quote #2 - Zakir Činjarević', '{"status": "draft", "total_amount": "1480.50", "customer_name": "Zakir Činjarević"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 12:43:20.853382');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (16, 1, 'Admin User', 'admin', 'delete', 'quote', 3, 'Quote #3 - Hamza Merdžanić', '{"status": "draft", "total_amount": "8029.08", "customer_name": "Hamza Merdžanić"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 12:43:22.785269');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (17, 1, 'Admin User', 'admin', 'delete', 'quote', 4, 'Quote #4 - Maria Garcia', '{"status": "draft", "total_amount": "2700.00", "customer_name": "Maria Garcia"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 12:43:24.06202');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (18, 1, 'Admin User', 'admin', 'delete', 'quote', 5, 'Quote #5 - Petra Novak', '{"status": "draft", "total_amount": "1558.97", "customer_name": "Petra Novak"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 12:43:25.398283');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (19, 1, 'Admin User', 'admin', 'delete', 'quote', 6, 'Quote #6 - Lejla Merdžanić', '{"status": "draft", "total_amount": "7107.75", "customer_name": "Lejla Merdžanić"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 12:43:26.99368');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (20, 1, 'Admin User', 'admin', 'delete', 'quote', 7, 'Quote #7 - Petra Novak', '{"status": "draft", "total_amount": "1558.97", "customer_name": "Petra Novak"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 12:43:28.233389');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (21, 1, 'Admin User', 'admin', 'delete', 'quote', 8, 'Quote #8 - Hamza Merdžanić', '{"status": "draft", "total_amount": "1558.97", "customer_name": "Hamza Merdžanić"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 12:43:29.625712');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (22, 1, 'Admin User', 'admin', 'delete', 'quote', 11, 'Quote #9 - Petra Novak', '{"status": "draft", "total_amount": "1558.97", "customer_name": "Petra Novak"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 12:43:31.076534');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (23, 2, 'Manager User', 'manager', 'create', 'quote', 12, 'Quote #1 - Hamza Merdžanić', '{"items_count": 1, "total_amount": 7107.75, "customer_name": "Hamza Merdžanić"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 14:10:52.081794');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (24, 2, 'Manager User', 'manager', 'duplicate', 'quote', 13, 'Quote #2 - Hamza Merdžanić', '{"original_quote_id": "12", "original_quote_number": 1}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 14:12:18.479588');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (25, 2, 'Manager User', 'manager', 'update', 'quote', 13, 'Quote #2 - Maria Garcia', '{"status": "draft", "items_updated": true, "updated_fields": ["customer_id", "customer_name", "customer_email", "customer_phone", "title", "description", "subtotal", "discount_percentage", "discount_amount", "tax_rate", "tax_amount", "total_amount", "valid_until", "notes", "terms_conditions", "payment_terms", "delivery_terms", "quote_type", "template_id"]}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-09 14:23:52.352847');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (26, 1, 'Admin User', 'admin', 'update', 'warranty_work_order', 6, 'WW-68/25', '{"status_change": {"to": "in_progress", "from": "pending"}, "updated_fields": ["status", "total_cost"], "technician_assigned": false}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-10 12:36:58.872962');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (27, 5, 'Tech Mike', 'technician', 'assign', 'machine', 15, 'HDS 8/18 4C - 582145662', '{"is_sale": false, "model_name": "HDS 8/18 4C", "sale_price": null, "customer_id": 18, "manufacturer": "Milwaukee Tool", "customer_name": "Adnan Rovčanin", "machine_condition": "used"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 09:58:07.923223');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (28, 5, 'Tech Mike', 'technician', 'create', 'repair_ticket', 15, 'TK-73/25', '{"priority": "high", "customer_name": "Adnan Rovčanin", "machine_serial": "582145662"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 09:58:54.587901');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (29, 5, 'Tech Mike', 'technician', 'update', 'warranty_work_order', 6, 'WW-68/25', '{"status_change": {"to": "completed", "from": "in_progress"}, "updated_fields": ["status", "total_cost"], "technician_assigned": false}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:01:32.64358');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (30, 4, 'Tech Sarah', 'technician', 'convert', 'repair_ticket', 15, 'TK-73/25', '{"converted_to": "work_order", "technician_id": 4, "work_order_id": 27, "work_order_number": "TK-73/25"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:03:39.853158');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (31, 4, 'Tech Sarah', 'technician', 'update', 'work_order', 27, 'TK-73/25', '{"status_change": {"to": "in_progress", "from": "pending"}, "updated_fields": ["status", "technician_id", "labor_rate", "total_cost"], "technician_assigned": false}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:03:58.6861');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (32, 4, 'Tech Sarah', 'technician', 'update', 'work_order', 27, 'TK-73/25', '{"status_change": null, "updated_fields": ["total_cost"], "technician_assigned": false}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:04:30.26153');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (33, 4, 'Tech Sarah', 'technician', 'update', 'work_order', 27, 'TK-73/25', '{"status_change": null, "updated_fields": ["technician_id", "total_cost"], "technician_assigned": false}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:04:36.405911');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (34, 4, 'Tech Sarah', 'technician', 'update', 'work_order', 27, 'TK-73/25', '{"status_change": {"to": "waiting_approval", "from": "in_progress"}, "updated_fields": ["status", "technician_id", "total_cost"], "technician_assigned": false}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:04:54.611753');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (35, 4, 'Tech Sarah', 'technician', 'update', 'work_order', 27, 'TK-73/25', '{"status_change": null, "updated_fields": ["technician_id", "labor_hours", "total_cost"], "technician_assigned": false}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:06:22.409054');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (36, 4, 'Tech Sarah', 'technician', 'update', 'work_order', 27, 'TK-73/25', '{"status_change": {"to": "completed", "from": "waiting_approval"}, "updated_fields": ["status", "technician_id", "total_cost"], "technician_assigned": false}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:06:36.917972');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (37, 1, 'Admin User', 'admin', 'delete', 'warranty_work_order', 7, 'WT-74/25', '{"was_converted_from_ticket": true}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:22:10.805593');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (38, 1, 'Admin User', 'admin', 'delete', 'warranty_repair_ticket', 7, 'WT-74/25', '{"customer_name": "Muhamed Kašić", "machine_serial": "62551"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:22:16.896504');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (39, 1, 'Admin User', 'admin', 'delete', 'warranty_work_order', 8, 'WW-75/25', '{"was_converted_from_ticket": true}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:27:30.676986');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (40, 1, 'Admin User', 'admin', 'delete', 'warranty_repair_ticket', 8, 'WT-75/25', '{"customer_name": "Muhamed Kašić", "machine_serial": "62551"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:27:36.32406');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (41, 1, 'Admin User', 'admin', 'create', 'warranty_repair_ticket', 9, 'WT-76/25', '{"priority": "medium", "customer_name": "Adnan Rovčanin", "machine_serial": "582145662"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:28:01.722522');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (42, 1, 'Admin User', 'admin', 'delete', 'warranty_work_order', 9, 'WW-76/25', '{"was_converted_from_ticket": true}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 10:40:14.21509');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (43, 1, 'Admin User', 'admin', 'update', 'work_order', 27, 'TK-73/25', '{"status_change": null, "updated_fields": ["total_cost"], "technician_assigned": false}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 11:50:18.022503');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (44, 1, 'Admin User', 'admin', 'update', 'work_order', 27, 'TK-73/25', '{"status_change": {"to": "intake", "from": "completed"}, "updated_fields": ["status", "technician_id", "labor_hours", "total_cost"], "technician_assigned": false}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 11:50:34.291316');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (45, 1, 'Admin User', 'admin', 'delete', 'work_order', 27, 'TK-73/25', '{"is_warranty": false, "was_converted_from_ticket": true}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 11:50:39.721951');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (46, 1, 'Admin User', 'admin', 'convert', 'repair_ticket', 15, 'TK-73/25', '{"converted_to": "work_order", "technician_id": 4, "work_order_id": 28, "work_order_number": "WO-73/25"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 11:50:48.637689');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (47, 5, 'Tech Mike', 'technician', 'convert', 'repair_ticket', 14, 'TK-71/25', '{"converted_to": "work_order", "technician_id": 5, "work_order_id": 29, "work_order_number": "WO-71/25"}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 12:12:12.398604');
INSERT INTO public.user_action_logs (id, user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, action_details, ip_address, user_agent, created_at) VALUES (48, 5, 'Tech Mike', 'technician', 'delete', 'work_order', 29, 'WO-71/25', '{"is_warranty": false, "was_converted_from_ticket": true}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0', '2025-10-11 12:12:30.651741');


--
-- TOC entry 6189 (class 0 OID 314181)
-- Dependencies: 304
-- Data for Name: user_notification_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (1, 2, 'rental', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (2, 9, 'rental', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (3, 4, 'rental', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (4, 3, 'rental', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (5, 5, 'rental', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (6, 1, 'rental', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (7, 2, 'maintenance', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (8, 9, 'maintenance', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (9, 4, 'maintenance', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (10, 3, 'maintenance', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (11, 5, 'maintenance', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (12, 1, 'maintenance', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (13, 2, 'system', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (14, 9, 'system', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (15, 4, 'system', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (16, 3, 'system', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (17, 5, 'system', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (18, 1, 'system', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (19, 2, 'marketing', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (20, 9, 'marketing', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (21, 4, 'marketing', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (22, 3, 'marketing', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (23, 5, 'marketing', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (24, 1, 'marketing', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (25, 2, 'customer', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (26, 9, 'customer', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (27, 4, 'customer', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (28, 3, 'customer', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (29, 5, 'customer', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (30, 1, 'customer', 'in_app', true, 'daily', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (31, 2, 'financial', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (32, 9, 'financial', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (33, 4, 'financial', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (34, 3, 'financial', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (35, 5, 'financial', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');
INSERT INTO public.user_notification_preferences (id, user_id, notification_type, channel, enabled, frequency, quiet_hours_start, quiet_hours_end, timezone, language, created_at, updated_at) VALUES (36, 1, 'financial', 'in_app', true, 'immediate', '22:00:00', '08:00:00', 'Europe/Belgrade', 'en', '2025-09-19 14:49:57.310497', '2025-09-19 14:49:57.310497');


--
-- TOC entry 6211 (class 0 OID 322302)
-- Dependencies: 326
-- Data for Name: user_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 6213 (class 0 OID 322330)
-- Dependencies: 328
-- Data for Name: user_permissions_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (1, 6, 'sales_targets:read', 'granted', true, 1, '2025-10-07 15:11:40.302619', 'Test');
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (2, 6, 'sales_targets:read', 'revoked', false, 1, '2025-10-07 15:20:35.754897', 'Test');
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (3, 6, 'sales_targets:read', 'granted', true, 1, '2025-10-07 15:20:47.748316', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (4, 6, 'sales_targets:read', 'revoked', false, 1, '2025-10-07 15:34:23.303571', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (5, 6, 'sales_targets:read', 'granted', true, 1, '2025-10-07 15:34:40.647485', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (6, 6, 'sales_targets:read', 'revoked', false, 1, '2025-10-07 15:37:33.1376', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (7, 7, 'sales_targets:read', 'granted', true, 1, '2025-10-07 15:37:47.803925', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (8, 7, 'sales_targets:write', 'granted', true, 1, '2025-10-07 15:38:49.750991', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (9, 7, 'work_orders:delete', 'granted', true, 1, '2025-10-07 15:39:39.748064', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (10, 7, 'sales_targets:write', 'revoked', false, 1, '2025-10-08 12:18:50.499712', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (11, 7, 'sales_targets:read', 'revoked', false, 1, '2025-10-08 12:18:53.453672', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (12, 7, 'work_orders:delete', 'revoked', false, 1, '2025-10-08 12:18:55.480292', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (13, 7, 'sales_targets:read', 'granted', true, 1, '2025-10-08 12:19:41.901245', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (14, 7, 'sales_targets:write', 'granted', true, 1, '2025-10-08 12:37:13.311884', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (15, 7, 'sales_targets:write', 'revoked', false, 1, '2025-10-08 12:37:32.752201', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (16, 7, 'sales_targets:read', 'revoked', false, 1, '2025-10-08 12:37:35.569774', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (17, 7, 'repair_tickets:read', 'granted', true, 1, '2025-10-08 13:05:24.044912', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (18, 7, 'repair_tickets:write', 'granted', true, 1, '2025-10-08 13:05:29.803299', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (19, 7, 'repair_tickets:write', 'revoked', false, 1, '2025-10-08 13:05:54.736342', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (20, 7, 'repair_tickets:read', 'revoked', false, 1, '2025-10-08 13:05:56.978211', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (21, 7, 'work_orders:read', 'granted', true, 1, '2025-10-08 13:17:43.76104', NULL);
INSERT INTO public.user_permissions_audit (id, user_id, permission_key, action, granted, performed_by, performed_at, reason) VALUES (22, 7, 'work_orders:read', 'revoked', false, 1, '2025-10-08 13:17:51.061271', NULL);


--
-- TOC entry 6215 (class 0 OID 322352)
-- Dependencies: 330
-- Data for Name: user_table_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.user_table_preferences (id, user_id, table_key, visible_columns, created_at, updated_at) VALUES (1, 1, 'inventory', '["description", "quantity", "price", "category", "supplier", "sku", "location", "name"]', '2025-10-08 15:42:31.051271', '2025-10-08 15:42:32.4204');
INSERT INTO public.user_table_preferences (id, user_id, table_key, visible_columns, created_at, updated_at) VALUES (6, 1, 'sales_targets', '["amount", "period", "description", "created_by", "user", "type"]', '2025-10-08 21:22:43.00577', '2025-10-08 21:22:48.939458');
INSERT INTO public.user_table_preferences (id, user_id, table_key, visible_columns, created_at, updated_at) VALUES (7, 1, 'admin_user_management', '["user", "role", "status", "last_login"]', '2025-10-08 22:49:22.017', '2025-10-08 22:49:22.941751');
INSERT INTO public.user_table_preferences (id, user_id, table_key, visible_columns, created_at, updated_at) VALUES (2, 1, 'customers', '["customer", "type", "contact", "status", "machines", "total_spent", "owner"]', '2025-10-08 15:45:45.88514', '2025-10-08 20:50:55.025836');
INSERT INTO public.user_table_preferences (id, user_id, table_key, visible_columns, created_at, updated_at) VALUES (9, 5, 'customers', '["type", "contact", "machines", "owner", "customer", "total_spent", "status"]', '2025-10-11 09:44:12.617641', '2025-10-11 09:44:34.64119');
INSERT INTO public.user_table_preferences (id, user_id, table_key, visible_columns, created_at, updated_at) VALUES (3, 1, 'work_orders', '["customer", "machine", "description", "priority", "technician", "cost", "work_order_number", "status"]', '2025-10-08 20:57:28.212954', '2025-10-08 20:57:32.417978');
INSERT INTO public.user_table_preferences (id, user_id, table_key, visible_columns, created_at, updated_at) VALUES (4, 1, 'warranty_repair_tickets', '["customer", "problem", "status", "priority", "submitted_by", "created_at", "machine", "ticket_number"]', '2025-10-08 21:02:03.240842', '2025-10-08 21:02:06.634181');
INSERT INTO public.user_table_preferences (id, user_id, table_key, visible_columns, created_at, updated_at) VALUES (5, 1, 'warranty_work_orders', '["work_order_number", "customer", "machine", "description", "priority", "technician", "created_at", "status"]', '2025-10-08 21:02:18.627656', '2025-10-08 21:02:19.49303');


--
-- TOC entry 6115 (class 0 OID 16391)
-- Dependencies: 221
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (5, 'Tech Mike', 'mike@repairshop.com', 'technician', '2025-08-25 11:29:45.90184', 'admin', true, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwiaWF0IjoxNzYwMTgwMzYzLCJleHAiOjE3NjA3ODUxNjN9.NK0wLSBiiffMyDqPfISanLIXhVL4Gq3MEsQEQGIMa1Q', '2025-10-11 13:59:26.054718', '+1234567894', 'Repair', 'active', '2025-10-11 12:59:23.48383', '2025-10-11 13:59:26.054718+02', '2025-10-11 12:13:43.286669');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (4, 'Tech Sarah', 'sarah@repairshop.com', 'technician', '2025-08-25 11:29:45.90184', 'admin', true, NULL, '2025-10-11 10:08:53.965553', '+1234567893', 'Repair', 'active', '2025-10-11 10:02:56.280875', '2025-10-11 10:08:53.965553+02', '2025-10-11 10:08:53.945437');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (7, 'John Sales', 'john.sales@repairshop.com', 'sales', '2025-09-03 00:07:41.994549', '$2b$10$1Yg0N6pst/rt4PKsoYuVxeV9VYBznafzOYiPJeXaslZCgwsZ6hL4m', true, NULL, '2025-10-11 10:13:55.768474', '+1-555-0980', 'Sales', 'active', '2025-10-11 10:09:37.485817', '2025-10-11 10:13:55.768474+02', '2025-10-11 10:13:55.746912');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (8, 'Sarah Martinez', 'sarah.martinez@repairshop.com', 'technician', '2025-09-03 00:07:42.095034', '$2b$10$0TUijOh3Av6AVcTxWWogA.XFiI92WvrbJTXoDxbZ4eTPMCLRNeRJe', true, NULL, '2025-10-08 21:41:03.603103', '+1-555-0907', 'Sales', 'active', '2025-10-08 21:40:57.27259', '2025-10-08 21:41:03.603103+02', '2025-10-08 21:41:03.574662');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (9, 'Test User', 'test@repairshop.com', 'admin', '2025-09-05 03:32:18.412765', 'test123', true, NULL, '2025-09-12 12:35:56.824967', NULL, 'IT', 'active', '2025-09-12 12:02:16.184138', '2025-09-12 12:35:56.824967+02', '2025-09-12 12:02:46.233681');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (6, 'Sales Representative', 'sales@repairshop.com', 'sales', '2025-09-03 00:07:41.887862', '$2b$10$zO7CTDHLlZwzXIJMejwTHeS4OyZ69GGB8P67/pz/fns5r7fylrgi2', true, NULL, '2025-10-08 13:09:44.076757', '+1-555-0123', 'Sales', 'active', '2025-10-08 13:09:01.190394', '2025-10-08 13:09:44.076757+02', '2025-10-08 13:09:44.065672');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (2, 'Manager User', 'manager@repairshop.com', 'manager', '2025-08-25 11:29:45.90184', 'admin', true, NULL, '2025-10-10 09:30:44.928187', '+1234567891', 'Management', 'active', '2025-10-10 09:30:36.481054', '2025-10-10 09:30:44.928187+02', '2025-10-10 09:30:44.91041');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (3, 'Tech John', 'john@repairshop.com', 'technician', '2025-08-25 11:29:45.90184', 'admin', true, NULL, '2025-09-12 12:35:56.828432', '+1234567892', 'Repair', 'active', '2025-09-12 12:06:22.590475', '2025-09-12 12:35:56.828432+02', '2025-09-12 12:06:25.130282');
INSERT INTO public.users (id, name, email, role, created_at, password, requires_password_reset, refresh_token, updated_at, phone, department, status, last_login, last_seen, last_logout) VALUES (1, 'Admin User', 'admin@repairshop.com', 'admin', '2025-08-25 11:29:45.90184', 'admin', true, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYwMTg0OTUwLCJleHAiOjE3NjA3ODk3NTB9.i3YnrjFRUhrnQvX7M1iTRDrEvTs6LLrz5UsHDXqH4g8', '2025-10-11 14:15:50.552388', '+1234567890', 'Management', 'active', '2025-10-11 14:15:50.48272', '2025-10-11 14:15:50.552388+02', '2025-10-11 12:59:21.67068');


--
-- TOC entry 6157 (class 0 OID 246195)
-- Dependencies: 263
-- Data for Name: warranty_periods; Type: TABLE DATA; Schema: public; Owner: repairadmin
--



--
-- TOC entry 6159 (class 0 OID 246209)
-- Dependencies: 265
-- Data for Name: warranty_repair_tickets; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

INSERT INTO public.warranty_repair_tickets (id, ticket_number, customer_id, machine_id, problem_description, notes, additional_equipment, brought_by, submitted_by, status, converted_to_warranty_work_order_id, created_at, updated_at, formatted_number, year_created, converted_at, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (1, 1, 3, 1, 'Test garancijske prijemnice', 'Čovjek je pegla, treba pripaziti.', 'Sve što dolazi uz mašinu.', 'Ahmed', 1, 'converted', 4, '2025-09-07 00:31:03.44918', '2025-10-10 10:17:36.143563', 'WT-54/25', 2025, '2025-09-07 23:57:28.049317', false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.warranty_repair_tickets (id, ticket_number, customer_id, machine_id, problem_description, notes, additional_equipment, brought_by, submitted_by, status, converted_to_warranty_work_order_id, created_at, updated_at, formatted_number, year_created, converted_at, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (3, 2, 6, 4, 'Test', 'test', 'test', 'test', 1, 'converted', 5, '2025-09-08 10:54:41.929805', '2025-10-10 10:17:36.143563', 'WT-62/25', 2025, '2025-09-08 10:54:51.011299', false, NULL, 0.00, NULL, 'unknown', 'low');
INSERT INTO public.warranty_repair_tickets (id, ticket_number, customer_id, machine_id, problem_description, notes, additional_equipment, brought_by, submitted_by, status, converted_to_warranty_work_order_id, created_at, updated_at, formatted_number, year_created, converted_at, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (5, 4, 9, 8, 'tet', 'tet', 'tet', 'tet', 5, 'converted', 6, '2025-09-11 14:30:35.118266', '2025-10-10 10:17:36.143563', 'WT-68/25', 2025, '2025-09-12 23:32:58.31007', false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.warranty_repair_tickets (id, ticket_number, customer_id, machine_id, problem_description, notes, additional_equipment, brought_by, submitted_by, status, converted_to_warranty_work_order_id, created_at, updated_at, formatted_number, year_created, converted_at, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (9, 5, 18, 15, 'test', 'test', 'test', 'test', 1, 'converted', 10, '2025-10-11 10:28:01.66551', '2025-10-11 11:47:45.814023', 'WT-76/25', 2025, '2025-10-11 11:47:45.814023', false, NULL, 0.00, NULL, 'unknown', 'medium');
INSERT INTO public.warranty_repair_tickets (id, ticket_number, customer_id, machine_id, problem_description, notes, additional_equipment, brought_by, submitted_by, status, converted_to_warranty_work_order_id, created_at, updated_at, formatted_number, year_created, converted_at, sales_opportunity, sales_notes, potential_value, sales_user_id, lead_quality, priority) VALUES (6, 3, 10, 12, 'test', 'test', 'test', 'test', 1, 'converted', 11, '2025-10-08 13:30:02.730262', '2025-10-11 11:55:01.820125', 'WT-72/25', 2025, '2025-10-11 11:55:01.820125', false, NULL, 0.00, NULL, 'unknown', 'medium');


--
-- TOC entry 6151 (class 0 OID 229033)
-- Dependencies: 257
-- Data for Name: warranty_work_order_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.warranty_work_order_inventory (id, warranty_work_order_id, inventory_id, quantity, created_at, updated_at) VALUES (7, 4, 1, 10, '2025-09-11 17:15:16.177057', '2025-09-11 17:15:16.177057');


--
-- TOC entry 6153 (class 0 OID 229053)
-- Dependencies: 259
-- Data for Name: warranty_work_order_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 6149 (class 0 OID 228996)
-- Dependencies: 255
-- Data for Name: warranty_work_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.warranty_work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, labor_hours, labor_rate, troubleshooting_fee, quote_subtotal_parts, quote_total, converted_from_ticket_id, ticket_number, owner_technician_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, customer_satisfaction_score, upsell_opportunity, recommended_products) VALUES (5, 4, 6, 'Test', 'completed', '2025-09-08 10:54:51.011299', '2025-10-10 10:17:36.164553', 5, 'low', NULL, NULL, '2025-09-11 12:58:45.089059', NULL, NULL, 50.00, 0.00, 0.00, 0.00, 3, 2, 5, 'WW-62/25', 2025, false, NULL, NULL, NULL, NULL, false, NULL);
INSERT INTO public.warranty_work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, labor_hours, labor_rate, troubleshooting_fee, quote_subtotal_parts, quote_total, converted_from_ticket_id, ticket_number, owner_technician_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, customer_satisfaction_score, upsell_opportunity, recommended_products) VALUES (4, 1, 3, 'Test garancijske prijemnice', 'pending', '2025-09-07 23:57:28.049317', '2025-10-10 10:17:36.164553', 5, 'medium', NULL, NULL, NULL, NULL, 2.00, 50.00, 100.00, 0.00, 0.00, 1, 1, 5, 'WW-54/25', 2025, false, NULL, NULL, NULL, NULL, false, NULL);
INSERT INTO public.warranty_work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, labor_hours, labor_rate, troubleshooting_fee, quote_subtotal_parts, quote_total, converted_from_ticket_id, ticket_number, owner_technician_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, customer_satisfaction_score, upsell_opportunity, recommended_products) VALUES (6, 8, 9, 'tet', 'completed', '2025-09-12 23:32:58.31007', '2025-10-11 10:01:32.637571', 5, 'medium', NULL, '2025-10-10 12:36:58.868417', '2025-10-11 10:01:32.637571', NULL, NULL, 50.00, 0.00, 0.00, 0.00, 5, 4, 5, 'WW-68/25', 2025, false, NULL, NULL, NULL, NULL, false, NULL);
INSERT INTO public.warranty_work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, labor_hours, labor_rate, troubleshooting_fee, quote_subtotal_parts, quote_total, converted_from_ticket_id, ticket_number, owner_technician_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, customer_satisfaction_score, upsell_opportunity, recommended_products) VALUES (10, 15, 18, 'test', 'pending', '2025-10-11 11:47:45.814023', '2025-10-11 11:47:45.814023', 4, 'medium', NULL, NULL, NULL, NULL, NULL, 50.00, 0.00, 0.00, 0.00, 9, 5, 4, 'WW-76/25', 2025, false, NULL, NULL, NULL, NULL, false, NULL);
INSERT INTO public.warranty_work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, labor_hours, labor_rate, troubleshooting_fee, quote_subtotal_parts, quote_total, converted_from_ticket_id, ticket_number, owner_technician_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, customer_satisfaction_score, upsell_opportunity, recommended_products) VALUES (11, 12, 10, 'test', 'pending', '2025-10-11 11:55:01.820125', '2025-10-11 11:55:01.820125', 4, 'medium', NULL, NULL, NULL, NULL, NULL, 50.00, 0.00, 0.00, 0.00, 6, 3, 4, 'WW-72/25', 2025, false, NULL, NULL, NULL, NULL, false, NULL);


--
-- TOC entry 6129 (class 0 OID 43871)
-- Dependencies: 235
-- Data for Name: work_order_attachments; Type: TABLE DATA; Schema: public; Owner: repairadmin
--



--
-- TOC entry 6125 (class 0 OID 16471)
-- Dependencies: 231
-- Data for Name: work_order_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.work_order_inventory (id, work_order_id, inventory_id, quantity, created_at, updated_at) VALUES (1, 4, 1, 1, '2025-09-07 23:17:10.400853', '2025-09-07 23:17:10.400853');
INSERT INTO public.work_order_inventory (id, work_order_id, inventory_id, quantity, created_at, updated_at) VALUES (2, 6, 1, 5, '2025-09-09 19:40:17.435234', '2025-09-09 19:40:17.435234');
INSERT INTO public.work_order_inventory (id, work_order_id, inventory_id, quantity, created_at, updated_at) VALUES (4, 5, 1, 6, '2025-09-12 01:47:35.450298', '2025-09-12 01:47:45.32329');
INSERT INTO public.work_order_inventory (id, work_order_id, inventory_id, quantity, created_at, updated_at) VALUES (5, 25, 1, 4, '2025-09-17 21:52:37.369029', '2025-09-17 21:52:47.314878');


--
-- TOC entry 6127 (class 0 OID 24764)
-- Dependencies: 233
-- Data for Name: work_order_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.work_order_notes (id, work_order_id, content, created_at, updated_at) VALUES (3, 3, 'radil', '2025-09-07 03:12:00.950279', '2025-09-07 03:12:00.950279');
INSERT INTO public.work_order_notes (id, work_order_id, content, created_at, updated_at) VALUES (4, 4, 'Test', '2025-09-07 23:17:04.595423', '2025-09-07 23:17:04.595423');
INSERT INTO public.work_order_notes (id, work_order_id, content, created_at, updated_at) VALUES (5, 6, 'test', '2025-09-09 19:40:08.847929', '2025-09-09 19:40:08.847929');
INSERT INTO public.work_order_notes (id, work_order_id, content, created_at, updated_at) VALUES (6, 25, 'test', '2025-09-17 21:52:25.750893', '2025-09-17 21:52:25.750893');


--
-- TOC entry 6133 (class 0 OID 43915)
-- Dependencies: 239
-- Data for Name: work_order_templates; Type: TABLE DATA; Schema: public; Owner: repairadmin
--

INSERT INTO public.work_order_templates (id, name, description, category, estimated_hours, required_parts, steps, created_at, updated_at) VALUES (1, 'CNC Machine Maintenance', 'Standard maintenance procedure for CNC machines', 'Maintenance', 4.50, '{"Oil Filter",Lubricant,"Cleaning Supplies"}', '{"Shut down machine safely","Clean all surfaces","Check oil levels","Replace oil filter","Lubricate moving parts","Test machine operation"}', '2025-08-16 00:03:00.226764', '2025-08-16 00:03:00.226764');
INSERT INTO public.work_order_templates (id, name, description, category, estimated_hours, required_parts, steps, created_at, updated_at) VALUES (2, 'Motor Replacement', 'Procedure for replacing electric motors', 'Repair', 6.00, '{"New Motor","Mounting Brackets","Electrical Connectors"}', '{"Disconnect power supply","Remove old motor","Install new motor","Connect electrical wiring","Test motor operation","Update documentation"}', '2025-08-16 00:03:00.226764', '2025-08-16 00:03:00.226764');
INSERT INTO public.work_order_templates (id, name, description, category, estimated_hours, required_parts, steps, created_at, updated_at) VALUES (3, 'Bearing Replacement', 'Standard bearing replacement procedure', 'Repair', 2.50, '{"New Bearings",Grease,Seals}', '{"Remove bearing housing","Extract old bearing","Clean bearing seat","Install new bearing","Apply grease","Reassemble housing"}', '2025-08-16 00:03:00.226764', '2025-08-16 00:03:00.226764');


--
-- TOC entry 6131 (class 0 OID 43893)
-- Dependencies: 237
-- Data for Name: work_order_time_entries; Type: TABLE DATA; Schema: public; Owner: repairadmin
--



--
-- TOC entry 6121 (class 0 OID 16433)
-- Dependencies: 227
-- Data for Name: work_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (28, 15, 18, 'Curi na nogu', 'pending', '2025-10-11 11:50:48.605671', '2025-10-11 11:50:48.605671', 4, 'high', NULL, NULL, NULL, NULL, 0.00, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 10, 15, 4, 1, 'WO-73/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (5, 4, 6, 'Test', 'completed', '2025-09-08 10:55:10.87366', '2025-10-10 10:17:36.15609', 5, 'high', NULL, '2025-09-10 11:35:43.657705', '2025-09-11 16:52:46.442692', NULL, 387.50, false, 2.75, 50.00, NULL, NULL, NULL, NULL, 100.00, NULL, 3, 7, 5, 1, 'WO-61/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (3, 2, 1, 'Mašina se upali i radi 5 minuta, poslije toga trza i ugasi se.', 'completed', '2025-09-06 23:14:13.612688', '2025-10-10 10:17:36.15609', 5, 'medium', NULL, '2025-09-07 03:25:56.075336', '2025-09-07 03:50:25.405678', NULL, 0.00, false, NULL, 50.00, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, 5, 1, 'WO-53/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (4, 4, 6, 'Test', 'completed', '2025-09-07 03:50:10.852363', '2025-10-10 10:17:36.15609', 5, 'medium', NULL, '2025-09-07 03:50:44.594427', '2025-09-07 23:32:04.304222', NULL, 225.00, false, 2.00, 50.00, NULL, NULL, NULL, NULL, 100.00, NULL, 2, 2, 5, 1, 'WO-55/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (24, 11, 10, 'asa', 'pending', '2025-09-13 00:45:37.753025', '2025-10-10 10:17:36.15609', 5, 'medium', NULL, NULL, NULL, NULL, 0.00, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 4, 12, 5, 1, 'WO-69/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (25, 4, 6, 'test', 'completed', '2025-09-17 21:50:16.97033', '2025-10-10 10:17:36.15609', 5, 'medium', NULL, '2025-09-17 21:51:25.654162', '2025-09-17 21:53:04.462063', NULL, 225.00, false, 2.50, 50.00, NULL, NULL, NULL, NULL, NULL, NULL, 5, 9, 5, 1, 'WO-65/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (26, 13, 10, 'test', 'pending', '2025-10-08 13:25:33.973487', '2025-10-10 10:17:36.15609', 5, 'medium', NULL, NULL, NULL, NULL, 0.00, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 8, 13, 5, 1, 'WO-70/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (16, 7, 9, 'ete', 'completed', '2025-09-13 00:13:49.836746', '2025-10-10 10:17:36.15609', 5, 'medium', NULL, '2025-09-13 00:14:27.621986', '2025-10-09 00:02:50.664534', NULL, 125.00, false, 2.50, 50.00, NULL, NULL, NULL, NULL, NULL, NULL, 7, 11, 5, 1, 'WO-67/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');
INSERT INTO public.work_orders (id, machine_id, customer_id, description, status, created_at, updated_at, technician_id, priority, estimated_hours, started_at, completed_at, due_date, total_cost, is_warranty, labor_hours, labor_rate, quote_subtotal_parts, quote_total, approval_status, approval_at, troubleshooting_fee, paid_at, ticket_number, converted_from_ticket_id, owner_technician_id, converted_by_user_id, formatted_number, year_created, sales_opportunity, sales_notes, follow_up_date, sales_user_id, lead_source, customer_satisfaction_score, upsell_opportunity, recommended_products, sales_stage) VALUES (6, 6, 9, 'test', 'completed', '2025-09-09 19:39:18.600571', '2025-10-10 10:17:36.15609', 5, 'high', NULL, '2025-09-09 19:41:26.954439', '2025-10-09 00:18:09.701175', NULL, 275.00, false, 1.00, 50.00, NULL, NULL, NULL, NULL, 100.00, NULL, 6, 10, 5, 5, 'WO-66/25', 2025, false, NULL, NULL, NULL, NULL, NULL, false, NULL, 'not_applicable');


--
-- TOC entry 6161 (class 0 OID 253746)
-- Dependencies: 267
-- Data for Name: yearly_sequences; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.yearly_sequences (id, year, current_sequence, created_at, updated_at) VALUES (11, 2025, 76, '2025-08-27 22:42:38.30171', '2025-10-11 10:28:01.66551');


--
-- TOC entry 6332 (class 0 OID 0)
-- Dependencies: 272
-- Name: assigned_machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.assigned_machines_id_seq', 15, true);


--
-- TOC entry 6333 (class 0 OID 0)
-- Dependencies: 240
-- Name: customer_communications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.customer_communications_id_seq', 1, false);


--
-- TOC entry 6334 (class 0 OID 0)
-- Dependencies: 339
-- Name: customer_portal_activity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_portal_activity_id_seq', 305, true);


--
-- TOC entry 6335 (class 0 OID 0)
-- Dependencies: 337
-- Name: customer_portal_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_portal_users_id_seq', 1, true);


--
-- TOC entry 6336 (class 0 OID 0)
-- Dependencies: 242
-- Name: customer_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.customer_preferences_id_seq', 1, false);


--
-- TOC entry 6337 (class 0 OID 0)
-- Dependencies: 319
-- Name: customer_pricing_tiers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_pricing_tiers_id_seq', 4, true);


--
-- TOC entry 6338 (class 0 OID 0)
-- Dependencies: 321
-- Name: customer_tier_assignments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customer_tier_assignments_id_seq', 1, false);


--
-- TOC entry 6339 (class 0 OID 0)
-- Dependencies: 222
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.customers_id_seq', 18, true);


--
-- TOC entry 6340 (class 0 OID 0)
-- Dependencies: 317
-- Name: demand_tracking_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.demand_tracking_id_seq', 1, false);


--
-- TOC entry 6341 (class 0 OID 0)
-- Dependencies: 295
-- Name: feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.feedback_id_seq', 42, true);


--
-- TOC entry 6342 (class 0 OID 0)
-- Dependencies: 289
-- Name: inventory_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_categories_id_seq', 18, true);


--
-- TOC entry 6343 (class 0 OID 0)
-- Dependencies: 228
-- Name: inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_id_seq', 2, true);


--
-- TOC entry 6344 (class 0 OID 0)
-- Dependencies: 284
-- Name: lead_follow_ups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lead_follow_ups_id_seq', 5, true);


--
-- TOC entry 6345 (class 0 OID 0)
-- Dependencies: 282
-- Name: leads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leads_id_seq', 3, true);


--
-- TOC entry 6346 (class 0 OID 0)
-- Dependencies: 260
-- Name: machine_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.machine_categories_id_seq', 10, true);


--
-- TOC entry 6347 (class 0 OID 0)
-- Dependencies: 268
-- Name: machine_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machine_models_id_seq', 6, true);


--
-- TOC entry 6348 (class 0 OID 0)
-- Dependencies: 313
-- Name: machine_pricing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machine_pricing_id_seq', 2, true);


--
-- TOC entry 6349 (class 0 OID 0)
-- Dependencies: 275
-- Name: machine_rentals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machine_rentals_id_seq', 42, true);


--
-- TOC entry 6350 (class 0 OID 0)
-- Dependencies: 270
-- Name: machine_serials_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machine_serials_id_seq', 20, true);


--
-- TOC entry 6351 (class 0 OID 0)
-- Dependencies: 224
-- Name: machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.machines_id_seq', 1, false);


--
-- TOC entry 6352 (class 0 OID 0)
-- Dependencies: 309
-- Name: notification_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notification_categories_id_seq', 6, true);


--
-- TOC entry 6353 (class 0 OID 0)
-- Dependencies: 307
-- Name: notification_deliveries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notification_deliveries_id_seq', 1, false);


--
-- TOC entry 6354 (class 0 OID 0)
-- Dependencies: 305
-- Name: notification_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.notification_templates_id_seq', 6, true);


--
-- TOC entry 6355 (class 0 OID 0)
-- Dependencies: 248
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.notifications_id_seq', 922, true);


--
-- TOC entry 6356 (class 0 OID 0)
-- Dependencies: 315
-- Name: pricing_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pricing_history_id_seq', 1, false);


--
-- TOC entry 6357 (class 0 OID 0)
-- Dependencies: 311
-- Name: pricing_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.pricing_rules_id_seq', 8, true);


--
-- TOC entry 6358 (class 0 OID 0)
-- Dependencies: 280
-- Name: quote_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quote_items_id_seq', 13, true);


--
-- TOC entry 6359 (class 0 OID 0)
-- Dependencies: 335
-- Name: quote_template_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quote_template_items_id_seq', 9, true);


--
-- TOC entry 6360 (class 0 OID 0)
-- Dependencies: 333
-- Name: quote_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quote_templates_id_seq', 8, true);


--
-- TOC entry 6361 (class 0 OID 0)
-- Dependencies: 278
-- Name: quotes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.quotes_id_seq', 13, true);


--
-- TOC entry 6362 (class 0 OID 0)
-- Dependencies: 299
-- Name: rental_machine_status_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rental_machine_status_history_id_seq', 36, true);


--
-- TOC entry 6363 (class 0 OID 0)
-- Dependencies: 297
-- Name: rental_machines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rental_machines_id_seq', 5, true);


--
-- TOC entry 6364 (class 0 OID 0)
-- Dependencies: 301
-- Name: rental_status_transition_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rental_status_transition_rules_id_seq', 40, true);


--
-- TOC entry 6365 (class 0 OID 0)
-- Dependencies: 252
-- Name: repair_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repair_tickets_id_seq', 15, true);


--
-- TOC entry 6366 (class 0 OID 0)
-- Dependencies: 323
-- Name: sales_targets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.sales_targets_id_seq', 9, true);


--
-- TOC entry 6367 (class 0 OID 0)
-- Dependencies: 246
-- Name: stock_movements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.stock_movements_id_seq', 1, false);


--
-- TOC entry 6368 (class 0 OID 0)
-- Dependencies: 244
-- Name: suppliers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.suppliers_id_seq', 5, true);


--
-- TOC entry 6369 (class 0 OID 0)
-- Dependencies: 251
-- Name: ticket_number_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.ticket_number_seq', 1009, true);


--
-- TOC entry 6370 (class 0 OID 0)
-- Dependencies: 331
-- Name: user_action_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_action_logs_id_seq', 48, true);


--
-- TOC entry 6371 (class 0 OID 0)
-- Dependencies: 303
-- Name: user_notification_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_notification_preferences_id_seq', 36, true);


--
-- TOC entry 6372 (class 0 OID 0)
-- Dependencies: 327
-- Name: user_permissions_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_permissions_audit_id_seq', 22, true);


--
-- TOC entry 6373 (class 0 OID 0)
-- Dependencies: 325
-- Name: user_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_permissions_id_seq', 11, true);


--
-- TOC entry 6374 (class 0 OID 0)
-- Dependencies: 329
-- Name: user_table_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_table_preferences_id_seq', 9, true);


--
-- TOC entry 6375 (class 0 OID 0)
-- Dependencies: 220
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 9, true);


--
-- TOC entry 6376 (class 0 OID 0)
-- Dependencies: 262
-- Name: warranty_periods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.warranty_periods_id_seq', 1, false);


--
-- TOC entry 6377 (class 0 OID 0)
-- Dependencies: 264
-- Name: warranty_repair_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.warranty_repair_tickets_id_seq', 9, true);


--
-- TOC entry 6378 (class 0 OID 0)
-- Dependencies: 256
-- Name: warranty_work_order_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warranty_work_order_inventory_id_seq', 37, true);


--
-- TOC entry 6379 (class 0 OID 0)
-- Dependencies: 258
-- Name: warranty_work_order_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warranty_work_order_notes_id_seq', 3, true);


--
-- TOC entry 6380 (class 0 OID 0)
-- Dependencies: 254
-- Name: warranty_work_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.warranty_work_orders_id_seq', 11, true);


--
-- TOC entry 6381 (class 0 OID 0)
-- Dependencies: 234
-- Name: work_order_attachments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.work_order_attachments_id_seq', 1, false);


--
-- TOC entry 6382 (class 0 OID 0)
-- Dependencies: 230
-- Name: work_order_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_order_inventory_id_seq', 6, true);


--
-- TOC entry 6383 (class 0 OID 0)
-- Dependencies: 232
-- Name: work_order_notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_order_notes_id_seq', 7, true);


--
-- TOC entry 6384 (class 0 OID 0)
-- Dependencies: 238
-- Name: work_order_templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.work_order_templates_id_seq', 3, true);


--
-- TOC entry 6385 (class 0 OID 0)
-- Dependencies: 236
-- Name: work_order_time_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: repairadmin
--

SELECT pg_catalog.setval('public.work_order_time_entries_id_seq', 1, false);


--
-- TOC entry 6386 (class 0 OID 0)
-- Dependencies: 226
-- Name: work_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.work_orders_id_seq', 29, true);


--
-- TOC entry 6387 (class 0 OID 0)
-- Dependencies: 266
-- Name: yearly_sequences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.yearly_sequences_id_seq', 11, true);


--
-- TOC entry 5626 (class 2606 OID 262402)
-- Name: assigned_machines assigned_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigned_machines
    ADD CONSTRAINT assigned_machines_pkey PRIMARY KEY (id);


--
-- TOC entry 5507 (class 2606 OID 62800)
-- Name: customer_communications customer_communications_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_communications
    ADD CONSTRAINT customer_communications_pkey PRIMARY KEY (id);


--
-- TOC entry 5818 (class 2606 OID 338748)
-- Name: customer_portal_activity customer_portal_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_activity
    ADD CONSTRAINT customer_portal_activity_pkey PRIMARY KEY (id);


--
-- TOC entry 5807 (class 2606 OID 338731)
-- Name: customer_portal_users customer_portal_users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_users
    ADD CONSTRAINT customer_portal_users_email_key UNIQUE (email);


--
-- TOC entry 5809 (class 2606 OID 338729)
-- Name: customer_portal_users customer_portal_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_users
    ADD CONSTRAINT customer_portal_users_pkey PRIMARY KEY (id);


--
-- TOC entry 5509 (class 2606 OID 72172)
-- Name: customer_preferences customer_preferences_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_preferences
    ADD CONSTRAINT customer_preferences_customer_id_key UNIQUE (customer_id);


--
-- TOC entry 5511 (class 2606 OID 72170)
-- Name: customer_preferences customer_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_preferences
    ADD CONSTRAINT customer_preferences_pkey PRIMARY KEY (id);


--
-- TOC entry 5748 (class 2606 OID 314366)
-- Name: customer_pricing_tiers customer_pricing_tiers_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_pricing_tiers
    ADD CONSTRAINT customer_pricing_tiers_name_key UNIQUE (name);


--
-- TOC entry 5750 (class 2606 OID 314364)
-- Name: customer_pricing_tiers customer_pricing_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_pricing_tiers
    ADD CONSTRAINT customer_pricing_tiers_pkey PRIMARY KEY (id);


--
-- TOC entry 5752 (class 2606 OID 314377)
-- Name: customer_tier_assignments customer_tier_assignments_customer_id_tier_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tier_assignments
    ADD CONSTRAINT customer_tier_assignments_customer_id_tier_id_key UNIQUE (customer_id, tier_id);


--
-- TOC entry 5754 (class 2606 OID 314375)
-- Name: customer_tier_assignments customer_tier_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tier_assignments
    ADD CONSTRAINT customer_tier_assignments_pkey PRIMARY KEY (id);


--
-- TOC entry 5443 (class 2606 OID 16414)
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- TOC entry 5445 (class 2606 OID 16412)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 5741 (class 2606 OID 314340)
-- Name: demand_tracking demand_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_tracking
    ADD CONSTRAINT demand_tracking_pkey PRIMARY KEY (id);


--
-- TOC entry 5743 (class 2606 OID 314342)
-- Name: demand_tracking demand_tracking_rental_machine_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_tracking
    ADD CONSTRAINT demand_tracking_rental_machine_id_date_key UNIQUE (rental_machine_id, date);


--
-- TOC entry 5679 (class 2606 OID 305895)
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- TOC entry 5493 (class 2606 OID 85240)
-- Name: inventory inventory_barcode_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_barcode_key UNIQUE (barcode);


--
-- TOC entry 5675 (class 2606 OID 289262)
-- Name: inventory_categories inventory_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_name_key UNIQUE (name);


--
-- TOC entry 5677 (class 2606 OID 289260)
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 5495 (class 2606 OID 16464)
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 5672 (class 2606 OID 287879)
-- Name: lead_follow_ups lead_follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_pkey PRIMARY KEY (id);


--
-- TOC entry 5668 (class 2606 OID 287859)
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- TOC entry 5573 (class 2606 OID 246193)
-- Name: machine_categories machine_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.machine_categories
    ADD CONSTRAINT machine_categories_name_key UNIQUE (name);


--
-- TOC entry 5575 (class 2606 OID 246191)
-- Name: machine_categories machine_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.machine_categories
    ADD CONSTRAINT machine_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 5615 (class 2606 OID 262368)
-- Name: machine_models machine_models_name_catalogue_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_models
    ADD CONSTRAINT machine_models_name_catalogue_number_key UNIQUE (name, catalogue_number);


--
-- TOC entry 5617 (class 2606 OID 262366)
-- Name: machine_models machine_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_models
    ADD CONSTRAINT machine_models_pkey PRIMARY KEY (id);


--
-- TOC entry 5733 (class 2606 OID 314298)
-- Name: machine_pricing machine_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_pricing
    ADD CONSTRAINT machine_pricing_pkey PRIMARY KEY (id);


--
-- TOC entry 5735 (class 2606 OID 314300)
-- Name: machine_pricing machine_pricing_rental_machine_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_pricing
    ADD CONSTRAINT machine_pricing_rental_machine_id_key UNIQUE (rental_machine_id);


--
-- TOC entry 5638 (class 2606 OID 286261)
-- Name: machine_rentals machine_rentals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals
    ADD CONSTRAINT machine_rentals_pkey PRIMARY KEY (id);


--
-- TOC entry 5622 (class 2606 OID 262383)
-- Name: machine_serials machine_serials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_serials
    ADD CONSTRAINT machine_serials_pkey PRIMARY KEY (id);


--
-- TOC entry 5624 (class 2606 OID 262385)
-- Name: machine_serials machine_serials_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_serials
    ADD CONSTRAINT machine_serials_serial_number_key UNIQUE (serial_number);


--
-- TOC entry 5459 (class 2606 OID 16424)
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- TOC entry 5461 (class 2606 OID 16426)
-- Name: machines machines_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_serial_number_key UNIQUE (serial_number);


--
-- TOC entry 5722 (class 2606 OID 314262)
-- Name: notification_categories notification_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_categories
    ADD CONSTRAINT notification_categories_name_key UNIQUE (name);


--
-- TOC entry 5724 (class 2606 OID 314260)
-- Name: notification_categories notification_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_categories
    ADD CONSTRAINT notification_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 5720 (class 2606 OID 314234)
-- Name: notification_deliveries notification_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_pkey PRIMARY KEY (id);


--
-- TOC entry 5712 (class 2606 OID 314216)
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5714 (class 2606 OID 314218)
-- Name: notification_templates notification_templates_template_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_template_key_key UNIQUE (template_key);


--
-- TOC entry 5525 (class 2606 OID 169427)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 5739 (class 2606 OID 314317)
-- Name: pricing_history pricing_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_history
    ADD CONSTRAINT pricing_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5729 (class 2606 OID 314278)
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 5658 (class 2606 OID 287828)
-- Name: quote_items quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5805 (class 2606 OID 338682)
-- Name: quote_template_items quote_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_template_items
    ADD CONSTRAINT quote_template_items_pkey PRIMARY KEY (id);


--
-- TOC entry 5800 (class 2606 OID 338665)
-- Name: quote_templates quote_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_templates
    ADD CONSTRAINT quote_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5653 (class 2606 OID 287802)
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- TOC entry 5655 (class 2606 OID 287804)
-- Name: quotes quotes_quote_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_quote_number_key UNIQUE (quote_number);


--
-- TOC entry 5698 (class 2606 OID 314151)
-- Name: rental_machine_status_history rental_machine_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machine_status_history
    ADD CONSTRAINT rental_machine_status_history_pkey PRIMARY KEY (id);


--
-- TOC entry 5691 (class 2606 OID 314120)
-- Name: rental_machines rental_machines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machines
    ADD CONSTRAINT rental_machines_pkey PRIMARY KEY (id);


--
-- TOC entry 5693 (class 2606 OID 314122)
-- Name: rental_machines rental_machines_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machines
    ADD CONSTRAINT rental_machines_serial_number_key UNIQUE (serial_number);


--
-- TOC entry 5700 (class 2606 OID 314175)
-- Name: rental_status_transition_rules rental_status_transition_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_status_transition_rules
    ADD CONSTRAINT rental_status_transition_rules_pkey PRIMARY KEY (id);


--
-- TOC entry 5547 (class 2606 OID 228964)
-- Name: repair_tickets repair_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_pkey PRIMARY KEY (id);


--
-- TOC entry 5549 (class 2606 OID 246249)
-- Name: repair_tickets repair_tickets_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_ticket_number_key UNIQUE (ticket_number);


--
-- TOC entry 5764 (class 2606 OID 322279)
-- Name: sales_targets sales_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_pkey PRIMARY KEY (id);


--
-- TOC entry 5527 (class 2606 OID 220689)
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- TOC entry 5517 (class 2606 OID 85223)
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- TOC entry 5513 (class 2606 OID 85213)
-- Name: suppliers suppliers_name_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_name_key UNIQUE (name);


--
-- TOC entry 5515 (class 2606 OID 85211)
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- TOC entry 5766 (class 2606 OID 322281)
-- Name: sales_targets unique_active_target; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT unique_active_target EXCLUDE USING btree (user_id WITH =, target_type WITH =, target_period_start WITH =) WHERE ((is_active = true));


--
-- TOC entry 5816 (class 2606 OID 338733)
-- Name: customer_portal_users unique_customer_portal_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_users
    ADD CONSTRAINT unique_customer_portal_user UNIQUE (customer_id);


--
-- TOC entry 5464 (class 2606 OID 220609)
-- Name: machines unique_serial; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT unique_serial UNIQUE (serial_number);


--
-- TOC entry 5795 (class 2606 OID 330466)
-- Name: user_action_logs user_action_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_action_logs
    ADD CONSTRAINT user_action_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 5705 (class 2606 OID 314194)
-- Name: user_notification_preferences user_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (id);


--
-- TOC entry 5707 (class 2606 OID 314196)
-- Name: user_notification_preferences user_notification_preferences_user_id_notification_type_cha_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_notification_type_cha_key UNIQUE (user_id, notification_type, channel);


--
-- TOC entry 5779 (class 2606 OID 322339)
-- Name: user_permissions_audit user_permissions_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions_audit
    ADD CONSTRAINT user_permissions_audit_pkey PRIMARY KEY (id);


--
-- TOC entry 5772 (class 2606 OID 322312)
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- TOC entry 5774 (class 2606 OID 322314)
-- Name: user_permissions user_permissions_user_id_permission_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_permission_key_key UNIQUE (user_id, permission_key);


--
-- TOC entry 5784 (class 2606 OID 322361)
-- Name: user_table_preferences user_table_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_table_preferences
    ADD CONSTRAINT user_table_preferences_pkey PRIMARY KEY (id);


--
-- TOC entry 5786 (class 2606 OID 322363)
-- Name: user_table_preferences user_table_preferences_user_id_table_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_table_preferences
    ADD CONSTRAINT user_table_preferences_user_id_table_key_key UNIQUE (user_id, table_key);


--
-- TOC entry 5439 (class 2606 OID 16402)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5441 (class 2606 OID 16400)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5577 (class 2606 OID 246207)
-- Name: warranty_periods warranty_periods_manufacturer_model_name_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_periods
    ADD CONSTRAINT warranty_periods_manufacturer_model_name_key UNIQUE (manufacturer, model_name);


--
-- TOC entry 5579 (class 2606 OID 246205)
-- Name: warranty_periods warranty_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_periods
    ADD CONSTRAINT warranty_periods_pkey PRIMARY KEY (id);


--
-- TOC entry 5598 (class 2606 OID 246220)
-- Name: warranty_repair_tickets warranty_repair_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_pkey PRIMARY KEY (id);


--
-- TOC entry 5600 (class 2606 OID 246222)
-- Name: warranty_repair_tickets warranty_repair_tickets_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_ticket_number_key UNIQUE (ticket_number);


--
-- TOC entry 5568 (class 2606 OID 229041)
-- Name: warranty_work_order_inventory warranty_work_order_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_inventory
    ADD CONSTRAINT warranty_work_order_inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 5570 (class 2606 OID 229062)
-- Name: warranty_work_order_notes warranty_work_order_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_notes
    ADD CONSTRAINT warranty_work_order_notes_pkey PRIMARY KEY (id);


--
-- TOC entry 5566 (class 2606 OID 229011)
-- Name: warranty_work_orders warranty_work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_pkey PRIMARY KEY (id);


--
-- TOC entry 5501 (class 2606 OID 43881)
-- Name: work_order_attachments work_order_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_attachments
    ADD CONSTRAINT work_order_attachments_pkey PRIMARY KEY (id);


--
-- TOC entry 5497 (class 2606 OID 16478)
-- Name: work_order_inventory work_order_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_inventory
    ADD CONSTRAINT work_order_inventory_pkey PRIMARY KEY (id);


--
-- TOC entry 5499 (class 2606 OID 24772)
-- Name: work_order_notes work_order_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_notes
    ADD CONSTRAINT work_order_notes_pkey PRIMARY KEY (id);


--
-- TOC entry 5505 (class 2606 OID 43926)
-- Name: work_order_templates work_order_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_templates
    ADD CONSTRAINT work_order_templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5503 (class 2606 OID 43903)
-- Name: work_order_time_entries work_order_time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_time_entries
    ADD CONSTRAINT work_order_time_entries_pkey PRIMARY KEY (id);


--
-- TOC entry 5479 (class 2606 OID 16443)
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- TOC entry 5481 (class 2606 OID 220692)
-- Name: work_orders work_orders_ticket_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_ticket_number_key UNIQUE (ticket_number);


--
-- TOC entry 5603 (class 2606 OID 253754)
-- Name: yearly_sequences yearly_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_sequences
    ADD CONSTRAINT yearly_sequences_pkey PRIMARY KEY (id);


--
-- TOC entry 5605 (class 2606 OID 253756)
-- Name: yearly_sequences yearly_sequences_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yearly_sequences
    ADD CONSTRAINT yearly_sequences_year_key UNIQUE (year);


--
-- TOC entry 5627 (class 1259 OID 286245)
-- Name: idx_assigned_machines_added_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_added_by ON public.assigned_machines USING btree (added_by_user_id);


--
-- TOC entry 5628 (class 1259 OID 286246)
-- Name: idx_assigned_machines_condition; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_condition ON public.assigned_machines USING btree (machine_condition);


--
-- TOC entry 5629 (class 1259 OID 262418)
-- Name: idx_assigned_machines_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_customer_id ON public.assigned_machines USING btree (customer_id);


--
-- TOC entry 5630 (class 1259 OID 289484)
-- Name: idx_assigned_machines_customer_serial; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_customer_serial ON public.assigned_machines USING btree (customer_id, serial_id);


--
-- TOC entry 5631 (class 1259 OID 262419)
-- Name: idx_assigned_machines_serial_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_serial_id ON public.assigned_machines USING btree (serial_id);


--
-- TOC entry 5632 (class 1259 OID 289485)
-- Name: idx_assigned_machines_serial_model; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_serial_model ON public.assigned_machines USING btree (serial_id, customer_id);


--
-- TOC entry 5633 (class 1259 OID 286244)
-- Name: idx_assigned_machines_sold_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assigned_machines_sold_by ON public.assigned_machines USING btree (sold_by_user_id);


--
-- TOC entry 5755 (class 1259 OID 314395)
-- Name: idx_customer_tier_assignments_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_tier_assignments_active ON public.customer_tier_assignments USING btree (is_active);


--
-- TOC entry 5756 (class 1259 OID 314393)
-- Name: idx_customer_tier_assignments_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_tier_assignments_customer_id ON public.customer_tier_assignments USING btree (customer_id);


--
-- TOC entry 5757 (class 1259 OID 314394)
-- Name: idx_customer_tier_assignments_tier_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_tier_assignments_tier_id ON public.customer_tier_assignments USING btree (tier_id);


--
-- TOC entry 5446 (class 1259 OID 289462)
-- Name: idx_customers_city_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_city_text ON public.customers USING gin (city public.gin_trgm_ops);


--
-- TOC entry 5447 (class 1259 OID 289439)
-- Name: idx_customers_company_name_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_company_name_text ON public.customers USING gin (company_name public.gin_trgm_ops);


--
-- TOC entry 5448 (class 1259 OID 289501)
-- Name: idx_customers_contact_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_contact_person ON public.customers USING btree (contact_person);


--
-- TOC entry 5449 (class 1259 OID 289472)
-- Name: idx_customers_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_created_at_status ON public.customers USING btree (created_at DESC, status);


--
-- TOC entry 5450 (class 1259 OID 289500)
-- Name: idx_customers_customer_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_customer_type ON public.customers USING btree (customer_type);


--
-- TOC entry 5451 (class 1259 OID 289438)
-- Name: idx_customers_email_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_email_text ON public.customers USING gin (email public.gin_trgm_ops);


--
-- TOC entry 5452 (class 1259 OID 289437)
-- Name: idx_customers_name_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_name_text ON public.customers USING gin (name public.gin_trgm_ops);


--
-- TOC entry 5453 (class 1259 OID 286230)
-- Name: idx_customers_owner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_owner_id ON public.customers USING btree (owner_id);


--
-- TOC entry 5454 (class 1259 OID 289461)
-- Name: idx_customers_phone_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_phone_text ON public.customers USING gin (phone public.gin_trgm_ops);


--
-- TOC entry 5455 (class 1259 OID 289243)
-- Name: idx_customers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_status ON public.customers USING btree (status);


--
-- TOC entry 5456 (class 1259 OID 289447)
-- Name: idx_customers_status_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_status_owner ON public.customers USING btree (status, owner_id);


--
-- TOC entry 5457 (class 1259 OID 289463)
-- Name: idx_customers_vat_number_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_vat_number_text ON public.customers USING gin (vat_number public.gin_trgm_ops);


--
-- TOC entry 5744 (class 1259 OID 314349)
-- Name: idx_demand_tracking_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_demand_tracking_date ON public.demand_tracking USING btree (date);


--
-- TOC entry 5745 (class 1259 OID 314350)
-- Name: idx_demand_tracking_demand_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_demand_tracking_demand_level ON public.demand_tracking USING btree (demand_level);


--
-- TOC entry 5746 (class 1259 OID 314348)
-- Name: idx_demand_tracking_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_demand_tracking_machine_id ON public.demand_tracking USING btree (rental_machine_id);


--
-- TOC entry 5680 (class 1259 OID 305905)
-- Name: idx_feedback_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedback_created_at ON public.feedback USING btree (created_at);


--
-- TOC entry 5681 (class 1259 OID 305904)
-- Name: idx_feedback_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedback_priority ON public.feedback USING btree (priority);


--
-- TOC entry 5682 (class 1259 OID 305902)
-- Name: idx_feedback_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedback_status ON public.feedback USING btree (status);


--
-- TOC entry 5683 (class 1259 OID 305903)
-- Name: idx_feedback_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedback_type ON public.feedback USING btree (type);


--
-- TOC entry 5684 (class 1259 OID 305901)
-- Name: idx_feedback_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_feedback_user_id ON public.feedback USING btree (user_id);


--
-- TOC entry 5673 (class 1259 OID 289264)
-- Name: idx_inventory_categories_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_categories_name ON public.inventory_categories USING btree (name);


--
-- TOC entry 5482 (class 1259 OID 253729)
-- Name: idx_inventory_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_category ON public.inventory USING btree (category);


--
-- TOC entry 5483 (class 1259 OID 289456)
-- Name: idx_inventory_category_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_category_supplier ON public.inventory USING btree (category, supplier);


--
-- TOC entry 5484 (class 1259 OID 289441)
-- Name: idx_inventory_description_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_description_text ON public.inventory USING gin (description public.gin_trgm_ops);


--
-- TOC entry 5485 (class 1259 OID 289440)
-- Name: idx_inventory_name_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_name_text ON public.inventory USING gin (name public.gin_trgm_ops);


--
-- TOC entry 5486 (class 1259 OID 289482)
-- Name: idx_inventory_quantity_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_quantity_category ON public.inventory USING btree (quantity, category);


--
-- TOC entry 5487 (class 1259 OID 253727)
-- Name: idx_inventory_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_sku ON public.inventory USING btree (sku);


--
-- TOC entry 5488 (class 1259 OID 289442)
-- Name: idx_inventory_sku_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_sku_text ON public.inventory USING gin (sku public.gin_trgm_ops);


--
-- TOC entry 5489 (class 1259 OID 253728)
-- Name: idx_inventory_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_supplier ON public.inventory USING btree (supplier);


--
-- TOC entry 5490 (class 1259 OID 289464)
-- Name: idx_inventory_supplier_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_supplier_text ON public.inventory USING gin (supplier public.gin_trgm_ops);


--
-- TOC entry 5491 (class 1259 OID 289481)
-- Name: idx_inventory_updated_at_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_updated_at_category ON public.inventory USING btree (updated_at DESC, category);


--
-- TOC entry 5669 (class 1259 OID 287896)
-- Name: idx_lead_follow_ups_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_follow_ups_created_at ON public.lead_follow_ups USING btree (created_at);


--
-- TOC entry 5670 (class 1259 OID 287895)
-- Name: idx_lead_follow_ups_lead_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_follow_ups_lead_id ON public.lead_follow_ups USING btree (lead_id);


--
-- TOC entry 5659 (class 1259 OID 287892)
-- Name: idx_leads_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_assigned_to ON public.leads USING btree (assigned_to);


--
-- TOC entry 5660 (class 1259 OID 287893)
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at);


--
-- TOC entry 5661 (class 1259 OID 289492)
-- Name: idx_leads_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_created_by ON public.leads USING btree (created_by);


--
-- TOC entry 5662 (class 1259 OID 287908)
-- Name: idx_leads_lead_quality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_lead_quality ON public.leads USING btree (lead_quality);


--
-- TOC entry 5663 (class 1259 OID 287894)
-- Name: idx_leads_next_follow_up; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_next_follow_up ON public.leads USING btree (next_follow_up);


--
-- TOC entry 5664 (class 1259 OID 287890)
-- Name: idx_leads_quality; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_quality ON public.leads USING btree (lead_quality);


--
-- TOC entry 5665 (class 1259 OID 287907)
-- Name: idx_leads_sales_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_sales_stage ON public.leads USING btree (sales_stage);


--
-- TOC entry 5666 (class 1259 OID 287891)
-- Name: idx_leads_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_stage ON public.leads USING btree (sales_stage);


--
-- TOC entry 5571 (class 1259 OID 289460)
-- Name: idx_machine_categories_name; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_machine_categories_name ON public.machine_categories USING btree (name);


--
-- TOC entry 5606 (class 1259 OID 262415)
-- Name: idx_machine_models_catalogue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_catalogue ON public.machine_models USING btree (catalogue_number);


--
-- TOC entry 5607 (class 1259 OID 289465)
-- Name: idx_machine_models_catalogue_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_catalogue_text ON public.machine_models USING gin (catalogue_number public.gin_trgm_ops);


--
-- TOC entry 5608 (class 1259 OID 289457)
-- Name: idx_machine_models_category_manufacturer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_category_manufacturer ON public.machine_models USING btree (category_id, manufacturer);


--
-- TOC entry 5609 (class 1259 OID 262414)
-- Name: idx_machine_models_manufacturer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_manufacturer ON public.machine_models USING btree (manufacturer);


--
-- TOC entry 5610 (class 1259 OID 289483)
-- Name: idx_machine_models_manufacturer_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_manufacturer_name ON public.machine_models USING btree (manufacturer, name);


--
-- TOC entry 5611 (class 1259 OID 289444)
-- Name: idx_machine_models_manufacturer_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_manufacturer_text ON public.machine_models USING gin (manufacturer public.gin_trgm_ops);


--
-- TOC entry 5612 (class 1259 OID 262413)
-- Name: idx_machine_models_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_name ON public.machine_models USING btree (name);


--
-- TOC entry 5613 (class 1259 OID 289443)
-- Name: idx_machine_models_name_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_models_name_text ON public.machine_models USING gin (name public.gin_trgm_ops);


--
-- TOC entry 5730 (class 1259 OID 314307)
-- Name: idx_machine_pricing_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_pricing_active ON public.machine_pricing USING btree (is_active);


--
-- TOC entry 5731 (class 1259 OID 314306)
-- Name: idx_machine_pricing_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_pricing_machine_id ON public.machine_pricing USING btree (rental_machine_id);


--
-- TOC entry 5634 (class 1259 OID 286277)
-- Name: idx_machine_rentals_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_rentals_customer ON public.machine_rentals USING btree (customer_id);


--
-- TOC entry 5635 (class 1259 OID 286279)
-- Name: idx_machine_rentals_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_rentals_dates ON public.machine_rentals USING btree (rental_start_date, rental_end_date);


--
-- TOC entry 5636 (class 1259 OID 286278)
-- Name: idx_machine_rentals_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_rentals_status ON public.machine_rentals USING btree (rental_status);


--
-- TOC entry 5618 (class 1259 OID 262416)
-- Name: idx_machine_serials_model_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_serials_model_id ON public.machine_serials USING btree (model_id);


--
-- TOC entry 5619 (class 1259 OID 289486)
-- Name: idx_machine_serials_model_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_serials_model_status ON public.machine_serials USING btree (model_id, status);


--
-- TOC entry 5620 (class 1259 OID 262417)
-- Name: idx_machine_serials_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_machine_serials_status ON public.machine_serials USING btree (status);


--
-- TOC entry 5715 (class 1259 OID 314248)
-- Name: idx_notification_deliveries_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_deliveries_channel ON public.notification_deliveries USING btree (channel);


--
-- TOC entry 5716 (class 1259 OID 314245)
-- Name: idx_notification_deliveries_notification_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_deliveries_notification_id ON public.notification_deliveries USING btree (notification_id);


--
-- TOC entry 5717 (class 1259 OID 314247)
-- Name: idx_notification_deliveries_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_deliveries_status ON public.notification_deliveries USING btree (status);


--
-- TOC entry 5718 (class 1259 OID 314246)
-- Name: idx_notification_deliveries_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_deliveries_user_id ON public.notification_deliveries USING btree (user_id);


--
-- TOC entry 5708 (class 1259 OID 314221)
-- Name: idx_notification_templates_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_templates_active ON public.notification_templates USING btree (is_active);


--
-- TOC entry 5709 (class 1259 OID 314219)
-- Name: idx_notification_templates_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_templates_key ON public.notification_templates USING btree (template_key);


--
-- TOC entry 5710 (class 1259 OID 314220)
-- Name: idx_notification_templates_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_templates_type ON public.notification_templates USING btree (notification_type);


--
-- TOC entry 5518 (class 1259 OID 228950)
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);


--
-- TOC entry 5519 (class 1259 OID 228948)
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- TOC entry 5520 (class 1259 OID 262271)
-- Name: idx_notifications_message_key; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_message_key ON public.notifications USING btree (message_key);


--
-- TOC entry 5521 (class 1259 OID 262270)
-- Name: idx_notifications_title_key; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_title_key ON public.notifications USING btree (title_key);


--
-- TOC entry 5522 (class 1259 OID 228949)
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);


--
-- TOC entry 5523 (class 1259 OID 228947)
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- TOC entry 5819 (class 1259 OID 338766)
-- Name: idx_portal_activity_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_activity_action ON public.customer_portal_activity USING btree (action);


--
-- TOC entry 5820 (class 1259 OID 338769)
-- Name: idx_portal_activity_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_activity_created ON public.customer_portal_activity USING btree (created_at DESC);


--
-- TOC entry 5821 (class 1259 OID 338764)
-- Name: idx_portal_activity_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_activity_customer ON public.customer_portal_activity USING btree (customer_id);


--
-- TOC entry 5822 (class 1259 OID 338767)
-- Name: idx_portal_activity_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_activity_entity ON public.customer_portal_activity USING btree (entity_type, entity_id);


--
-- TOC entry 5823 (class 1259 OID 338765)
-- Name: idx_portal_activity_portal_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_activity_portal_user ON public.customer_portal_activity USING btree (portal_user_id);


--
-- TOC entry 5824 (class 1259 OID 338768)
-- Name: idx_portal_activity_tracking; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_activity_tracking ON public.customer_portal_activity USING btree (tracking_number);


--
-- TOC entry 5810 (class 1259 OID 338759)
-- Name: idx_portal_users_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_users_customer_id ON public.customer_portal_users USING btree (customer_id);


--
-- TOC entry 5811 (class 1259 OID 338760)
-- Name: idx_portal_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_users_email ON public.customer_portal_users USING btree (email);


--
-- TOC entry 5812 (class 1259 OID 338763)
-- Name: idx_portal_users_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_users_is_active ON public.customer_portal_users USING btree (is_active);


--
-- TOC entry 5813 (class 1259 OID 338762)
-- Name: idx_portal_users_reset_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_users_reset_token ON public.customer_portal_users USING btree (reset_token);


--
-- TOC entry 5814 (class 1259 OID 338761)
-- Name: idx_portal_users_verification_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_users_verification_token ON public.customer_portal_users USING btree (verification_token);


--
-- TOC entry 5736 (class 1259 OID 314329)
-- Name: idx_pricing_history_changed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pricing_history_changed_at ON public.pricing_history USING btree (changed_at);


--
-- TOC entry 5737 (class 1259 OID 314328)
-- Name: idx_pricing_history_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pricing_history_machine_id ON public.pricing_history USING btree (rental_machine_id);


--
-- TOC entry 5725 (class 1259 OID 314285)
-- Name: idx_pricing_rules_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pricing_rules_active ON public.pricing_rules USING btree (is_active);


--
-- TOC entry 5726 (class 1259 OID 314286)
-- Name: idx_pricing_rules_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pricing_rules_priority ON public.pricing_rules USING btree (priority);


--
-- TOC entry 5727 (class 1259 OID 314284)
-- Name: idx_pricing_rules_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pricing_rules_type ON public.pricing_rules USING btree (rule_type);


--
-- TOC entry 5656 (class 1259 OID 287839)
-- Name: idx_quote_items_quote_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_items_quote_id ON public.quote_items USING btree (quote_id);


--
-- TOC entry 5801 (class 1259 OID 338699)
-- Name: idx_quote_template_items_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_template_items_reference ON public.quote_template_items USING btree (item_reference_id);


--
-- TOC entry 5802 (class 1259 OID 338697)
-- Name: idx_quote_template_items_template; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_template_items_template ON public.quote_template_items USING btree (template_id);


--
-- TOC entry 5803 (class 1259 OID 338698)
-- Name: idx_quote_template_items_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_template_items_type ON public.quote_template_items USING btree (item_type);


--
-- TOC entry 5796 (class 1259 OID 338695)
-- Name: idx_quote_templates_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_templates_active ON public.quote_templates USING btree (is_active);


--
-- TOC entry 5797 (class 1259 OID 338696)
-- Name: idx_quote_templates_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_templates_created_by ON public.quote_templates USING btree (created_by);


--
-- TOC entry 5798 (class 1259 OID 338694)
-- Name: idx_quote_templates_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_templates_type ON public.quote_templates USING btree (template_type);


--
-- TOC entry 5639 (class 1259 OID 338689)
-- Name: idx_quotes_accepted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_accepted_at ON public.quotes USING btree (accepted_at);


--
-- TOC entry 5640 (class 1259 OID 287838)
-- Name: idx_quotes_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_created_at ON public.quotes USING btree (created_at);


--
-- TOC entry 5641 (class 1259 OID 287836)
-- Name: idx_quotes_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_created_by ON public.quotes USING btree (created_by);


--
-- TOC entry 5642 (class 1259 OID 287834)
-- Name: idx_quotes_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_customer_id ON public.quotes USING btree (customer_id);


--
-- TOC entry 5643 (class 1259 OID 338690)
-- Name: idx_quotes_follow_up; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_follow_up ON public.quotes USING btree (follow_up_reminder_date);


--
-- TOC entry 5644 (class 1259 OID 338705)
-- Name: idx_quotes_formatted_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_formatted_number ON public.quotes USING btree (formatted_number);


--
-- TOC entry 5645 (class 1259 OID 338692)
-- Name: idx_quotes_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_parent_id ON public.quotes USING btree (parent_quote_id);


--
-- TOC entry 5646 (class 1259 OID 338688)
-- Name: idx_quotes_sent_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_sent_at ON public.quotes USING btree (sent_at);


--
-- TOC entry 5647 (class 1259 OID 287835)
-- Name: idx_quotes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_status ON public.quotes USING btree (status);


--
-- TOC entry 5648 (class 1259 OID 338691)
-- Name: idx_quotes_template_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_template_id ON public.quotes USING btree (template_id);


--
-- TOC entry 5649 (class 1259 OID 338693)
-- Name: idx_quotes_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_type ON public.quotes USING btree (quote_type);


--
-- TOC entry 5650 (class 1259 OID 287837)
-- Name: idx_quotes_valid_until; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_valid_until ON public.quotes USING btree (valid_until);


--
-- TOC entry 5651 (class 1259 OID 338704)
-- Name: idx_quotes_year_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_year_created ON public.quotes USING btree (year_created);


--
-- TOC entry 5694 (class 1259 OID 314163)
-- Name: idx_rental_machine_status_history_changed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machine_status_history_changed_at ON public.rental_machine_status_history USING btree (changed_at);


--
-- TOC entry 5695 (class 1259 OID 314162)
-- Name: idx_rental_machine_status_history_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machine_status_history_machine_id ON public.rental_machine_status_history USING btree (rental_machine_id);


--
-- TOC entry 5696 (class 1259 OID 314164)
-- Name: idx_rental_machine_status_history_new_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machine_status_history_new_status ON public.rental_machine_status_history USING btree (new_status);


--
-- TOC entry 5685 (class 1259 OID 314136)
-- Name: idx_rental_machines_condition; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machines_condition ON public.rental_machines USING btree (condition);


--
-- TOC entry 5686 (class 1259 OID 314137)
-- Name: idx_rental_machines_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machines_created_by ON public.rental_machines USING btree (created_by);


--
-- TOC entry 5687 (class 1259 OID 314133)
-- Name: idx_rental_machines_model_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machines_model_id ON public.rental_machines USING btree (model_id);


--
-- TOC entry 5688 (class 1259 OID 314135)
-- Name: idx_rental_machines_rental_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machines_rental_status ON public.rental_machines USING btree (rental_status);


--
-- TOC entry 5689 (class 1259 OID 314134)
-- Name: idx_rental_machines_serial_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rental_machines_serial_number ON public.rental_machines USING btree (serial_number);


--
-- TOC entry 5528 (class 1259 OID 289467)
-- Name: idx_repair_tickets_additional_equipment_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_additional_equipment_text ON public.repair_tickets USING gin (additional_equipment public.gin_trgm_ops);


--
-- TOC entry 5529 (class 1259 OID 289468)
-- Name: idx_repair_tickets_brought_by_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_brought_by_text ON public.repair_tickets USING gin (brought_by public.gin_trgm_ops);


--
-- TOC entry 5530 (class 1259 OID 229083)
-- Name: idx_repair_tickets_converted_to_warranty_work_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_converted_to_warranty_work_order_id ON public.repair_tickets USING btree (converted_to_warranty_work_order_id);


--
-- TOC entry 5531 (class 1259 OID 289449)
-- Name: idx_repair_tickets_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_created_at_status ON public.repair_tickets USING btree (created_at DESC, status);


--
-- TOC entry 5532 (class 1259 OID 228994)
-- Name: idx_repair_tickets_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_created_by ON public.repair_tickets USING btree (submitted_by);


--
-- TOC entry 5533 (class 1259 OID 228992)
-- Name: idx_repair_tickets_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_customer_id ON public.repair_tickets USING btree (customer_id);


--
-- TOC entry 5534 (class 1259 OID 289473)
-- Name: idx_repair_tickets_customer_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_customer_status ON public.repair_tickets USING btree (customer_id, status);


--
-- TOC entry 5535 (class 1259 OID 253765)
-- Name: idx_repair_tickets_formatted_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_formatted_number ON public.repair_tickets USING btree (formatted_number);


--
-- TOC entry 5536 (class 1259 OID 228993)
-- Name: idx_repair_tickets_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_machine_id ON public.repair_tickets USING btree (machine_id);


--
-- TOC entry 5537 (class 1259 OID 289466)
-- Name: idx_repair_tickets_notes_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_notes_text ON public.repair_tickets USING gin (notes public.gin_trgm_ops);


--
-- TOC entry 5538 (class 1259 OID 289237)
-- Name: idx_repair_tickets_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_priority ON public.repair_tickets USING btree (priority);


--
-- TOC entry 5539 (class 1259 OID 289445)
-- Name: idx_repair_tickets_problem_description_text; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_problem_description_text ON public.repair_tickets USING gin (problem_description public.gin_trgm_ops);


--
-- TOC entry 5540 (class 1259 OID 286351)
-- Name: idx_repair_tickets_sales_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_sales_user_id ON public.repair_tickets USING btree (sales_user_id);


--
-- TOC entry 5541 (class 1259 OID 228991)
-- Name: idx_repair_tickets_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_status ON public.repair_tickets USING btree (status);


--
-- TOC entry 5542 (class 1259 OID 289448)
-- Name: idx_repair_tickets_status_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_status_priority ON public.repair_tickets USING btree (status, priority);


--
-- TOC entry 5543 (class 1259 OID 289474)
-- Name: idx_repair_tickets_technician_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_technician_status ON public.repair_tickets USING btree (submitted_by, status);


--
-- TOC entry 5544 (class 1259 OID 246281)
-- Name: idx_repair_tickets_ticket_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_ticket_number ON public.repair_tickets USING btree (ticket_number);


--
-- TOC entry 5545 (class 1259 OID 253766)
-- Name: idx_repair_tickets_year_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_tickets_year_created ON public.repair_tickets USING btree (year_created);


--
-- TOC entry 5758 (class 1259 OID 322295)
-- Name: idx_sales_targets_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_targets_active ON public.sales_targets USING btree (is_active);


--
-- TOC entry 5759 (class 1259 OID 322296)
-- Name: idx_sales_targets_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_targets_created_by ON public.sales_targets USING btree (created_by);


--
-- TOC entry 5760 (class 1259 OID 322294)
-- Name: idx_sales_targets_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_targets_period ON public.sales_targets USING btree (target_period_start, target_period_end);


--
-- TOC entry 5761 (class 1259 OID 322293)
-- Name: idx_sales_targets_target_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_targets_target_type ON public.sales_targets USING btree (target_type);


--
-- TOC entry 5762 (class 1259 OID 322292)
-- Name: idx_sales_targets_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_targets_user_id ON public.sales_targets USING btree (user_id);


--
-- TOC entry 5787 (class 1259 OID 330475)
-- Name: idx_user_action_logs_action_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_action_type ON public.user_action_logs USING btree (action_type);


--
-- TOC entry 5788 (class 1259 OID 330476)
-- Name: idx_user_action_logs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_created ON public.user_action_logs USING btree (created_at DESC);


--
-- TOC entry 5789 (class 1259 OID 330474)
-- Name: idx_user_action_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_entity ON public.user_action_logs USING btree (entity_type, entity_id);


--
-- TOC entry 5790 (class 1259 OID 330477)
-- Name: idx_user_action_logs_entity_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_entity_created ON public.user_action_logs USING btree (entity_type, created_at DESC);


--
-- TOC entry 5791 (class 1259 OID 330472)
-- Name: idx_user_action_logs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_user ON public.user_action_logs USING btree (user_id);


--
-- TOC entry 5792 (class 1259 OID 330473)
-- Name: idx_user_action_logs_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_user_created ON public.user_action_logs USING btree (user_id, created_at DESC);


--
-- TOC entry 5793 (class 1259 OID 330478)
-- Name: idx_user_action_logs_user_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_action_logs_user_entity ON public.user_action_logs USING btree (user_id, entity_type, created_at DESC);


--
-- TOC entry 5701 (class 1259 OID 314204)
-- Name: idx_user_notification_preferences_channel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_notification_preferences_channel ON public.user_notification_preferences USING btree (channel);


--
-- TOC entry 5702 (class 1259 OID 314203)
-- Name: idx_user_notification_preferences_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_notification_preferences_type ON public.user_notification_preferences USING btree (notification_type);


--
-- TOC entry 5703 (class 1259 OID 314202)
-- Name: idx_user_notification_preferences_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_notification_preferences_user_id ON public.user_notification_preferences USING btree (user_id);


--
-- TOC entry 5775 (class 1259 OID 322347)
-- Name: idx_user_permissions_audit_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_audit_date ON public.user_permissions_audit USING btree (performed_at);


--
-- TOC entry 5776 (class 1259 OID 322346)
-- Name: idx_user_permissions_audit_performed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_audit_performed_by ON public.user_permissions_audit USING btree (performed_by);


--
-- TOC entry 5777 (class 1259 OID 322345)
-- Name: idx_user_permissions_audit_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_audit_user ON public.user_permissions_audit USING btree (user_id);


--
-- TOC entry 5767 (class 1259 OID 322328)
-- Name: idx_user_permissions_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_expires ON public.user_permissions USING btree (expires_at);


--
-- TOC entry 5768 (class 1259 OID 322327)
-- Name: idx_user_permissions_granted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_granted ON public.user_permissions USING btree (granted);


--
-- TOC entry 5769 (class 1259 OID 322326)
-- Name: idx_user_permissions_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_key ON public.user_permissions USING btree (permission_key);


--
-- TOC entry 5770 (class 1259 OID 322325)
-- Name: idx_user_permissions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- TOC entry 5780 (class 1259 OID 322370)
-- Name: idx_user_table_prefs_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_table_prefs_table ON public.user_table_preferences USING btree (table_key);


--
-- TOC entry 5781 (class 1259 OID 322369)
-- Name: idx_user_table_prefs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_table_prefs_user ON public.user_table_preferences USING btree (user_id);


--
-- TOC entry 5782 (class 1259 OID 322371)
-- Name: idx_user_table_prefs_user_table; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_table_prefs_user_table ON public.user_table_preferences USING btree (user_id, table_key);


--
-- TOC entry 5431 (class 1259 OID 253733)
-- Name: idx_users_department; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_department ON public.users USING btree (department);


--
-- TOC entry 5432 (class 1259 OID 34938)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 5433 (class 1259 OID 253734)
-- Name: idx_users_last_login; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_last_login ON public.users USING btree (last_login);


--
-- TOC entry 5434 (class 1259 OID 289497)
-- Name: idx_users_last_logout; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_last_logout ON public.users USING btree (last_logout);


--
-- TOC entry 5435 (class 1259 OID 289459)
-- Name: idx_users_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_name ON public.users USING btree (name);


--
-- TOC entry 5436 (class 1259 OID 289458)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 5437 (class 1259 OID 253732)
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- TOC entry 5580 (class 1259 OID 289470)
-- Name: idx_warranty_repair_tickets_additional_equipment_text; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_additional_equipment_text ON public.warranty_repair_tickets USING gin (additional_equipment public.gin_trgm_ops);


--
-- TOC entry 5581 (class 1259 OID 289471)
-- Name: idx_warranty_repair_tickets_brought_by_text; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_brought_by_text ON public.warranty_repair_tickets USING gin (brought_by public.gin_trgm_ops);


--
-- TOC entry 5582 (class 1259 OID 253794)
-- Name: idx_warranty_repair_tickets_converted_at; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_converted_at ON public.warranty_repair_tickets USING btree (converted_at);


--
-- TOC entry 5583 (class 1259 OID 289451)
-- Name: idx_warranty_repair_tickets_created_at_status; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_created_at_status ON public.warranty_repair_tickets USING btree (created_at DESC, status);


--
-- TOC entry 5584 (class 1259 OID 246284)
-- Name: idx_warranty_repair_tickets_customer_id; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_customer_id ON public.warranty_repair_tickets USING btree (customer_id);


--
-- TOC entry 5585 (class 1259 OID 289475)
-- Name: idx_warranty_repair_tickets_customer_status; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_customer_status ON public.warranty_repair_tickets USING btree (customer_id, status);


--
-- TOC entry 5586 (class 1259 OID 253767)
-- Name: idx_warranty_repair_tickets_formatted_number; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_formatted_number ON public.warranty_repair_tickets USING btree (formatted_number);


--
-- TOC entry 5587 (class 1259 OID 246285)
-- Name: idx_warranty_repair_tickets_machine_id; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_machine_id ON public.warranty_repair_tickets USING btree (machine_id);


--
-- TOC entry 5588 (class 1259 OID 289469)
-- Name: idx_warranty_repair_tickets_notes_text; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_notes_text ON public.warranty_repair_tickets USING gin (notes public.gin_trgm_ops);


--
-- TOC entry 5589 (class 1259 OID 289238)
-- Name: idx_warranty_repair_tickets_priority; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_priority ON public.warranty_repair_tickets USING btree (priority);


--
-- TOC entry 5590 (class 1259 OID 289446)
-- Name: idx_warranty_repair_tickets_problem_description_text; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_problem_description_text ON public.warranty_repair_tickets USING gin (problem_description public.gin_trgm_ops);


--
-- TOC entry 5591 (class 1259 OID 286352)
-- Name: idx_warranty_repair_tickets_sales_user_id; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_sales_user_id ON public.warranty_repair_tickets USING btree (sales_user_id);


--
-- TOC entry 5592 (class 1259 OID 246283)
-- Name: idx_warranty_repair_tickets_status; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_status ON public.warranty_repair_tickets USING btree (status);


--
-- TOC entry 5593 (class 1259 OID 289450)
-- Name: idx_warranty_repair_tickets_status_priority; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_status_priority ON public.warranty_repair_tickets USING btree (status, priority);


--
-- TOC entry 5594 (class 1259 OID 289476)
-- Name: idx_warranty_repair_tickets_technician_status; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_technician_status ON public.warranty_repair_tickets USING btree (submitted_by, status);


--
-- TOC entry 5595 (class 1259 OID 246282)
-- Name: idx_warranty_repair_tickets_ticket_number; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_ticket_number ON public.warranty_repair_tickets USING btree (ticket_number);


--
-- TOC entry 5596 (class 1259 OID 253768)
-- Name: idx_warranty_repair_tickets_year_created; Type: INDEX; Schema: public; Owner: repairadmin
--

CREATE INDEX idx_warranty_repair_tickets_year_created ON public.warranty_repair_tickets USING btree (year_created);


--
-- TOC entry 5550 (class 1259 OID 289455)
-- Name: idx_warranty_work_orders_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_created_at_status ON public.warranty_work_orders USING btree (created_at DESC, status);


--
-- TOC entry 5551 (class 1259 OID 229075)
-- Name: idx_warranty_work_orders_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_customer_id ON public.warranty_work_orders USING btree (customer_id);


--
-- TOC entry 5552 (class 1259 OID 289479)
-- Name: idx_warranty_work_orders_customer_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_customer_status ON public.warranty_work_orders USING btree (customer_id, status);


--
-- TOC entry 5553 (class 1259 OID 229074)
-- Name: idx_warranty_work_orders_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_due_date ON public.warranty_work_orders USING btree (due_date);


--
-- TOC entry 5554 (class 1259 OID 253771)
-- Name: idx_warranty_work_orders_formatted_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_formatted_number ON public.warranty_work_orders USING btree (formatted_number);


--
-- TOC entry 5555 (class 1259 OID 229076)
-- Name: idx_warranty_work_orders_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_machine_id ON public.warranty_work_orders USING btree (machine_id);


--
-- TOC entry 5556 (class 1259 OID 246289)
-- Name: idx_warranty_work_orders_owner_technician_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_owner_technician_id ON public.warranty_work_orders USING btree (owner_technician_id);


--
-- TOC entry 5557 (class 1259 OID 229073)
-- Name: idx_warranty_work_orders_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_priority ON public.warranty_work_orders USING btree (priority);


--
-- TOC entry 5558 (class 1259 OID 286350)
-- Name: idx_warranty_work_orders_sales_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_sales_user_id ON public.warranty_work_orders USING btree (sales_user_id);


--
-- TOC entry 5559 (class 1259 OID 229071)
-- Name: idx_warranty_work_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_status ON public.warranty_work_orders USING btree (status);


--
-- TOC entry 5560 (class 1259 OID 289454)
-- Name: idx_warranty_work_orders_status_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_status_priority ON public.warranty_work_orders USING btree (status, priority);


--
-- TOC entry 5561 (class 1259 OID 229072)
-- Name: idx_warranty_work_orders_technician_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_technician_id ON public.warranty_work_orders USING btree (technician_id);


--
-- TOC entry 5562 (class 1259 OID 289480)
-- Name: idx_warranty_work_orders_technician_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_technician_status ON public.warranty_work_orders USING btree (owner_technician_id, status);


--
-- TOC entry 5563 (class 1259 OID 246287)
-- Name: idx_warranty_work_orders_ticket_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_ticket_number ON public.warranty_work_orders USING btree (ticket_number);


--
-- TOC entry 5564 (class 1259 OID 253772)
-- Name: idx_warranty_work_orders_year_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_warranty_work_orders_year_created ON public.warranty_work_orders USING btree (year_created);


--
-- TOC entry 5465 (class 1259 OID 253459)
-- Name: idx_work_orders_converted_by_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_converted_by_user_id ON public.work_orders USING btree (converted_by_user_id);


--
-- TOC entry 5466 (class 1259 OID 34939)
-- Name: idx_work_orders_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_created_at ON public.work_orders USING btree (created_at);


--
-- TOC entry 5467 (class 1259 OID 289453)
-- Name: idx_work_orders_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_created_at_status ON public.work_orders USING btree (created_at DESC, status);


--
-- TOC entry 5468 (class 1259 OID 289477)
-- Name: idx_work_orders_customer_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_customer_status ON public.work_orders USING btree (customer_id, status);


--
-- TOC entry 5469 (class 1259 OID 253769)
-- Name: idx_work_orders_formatted_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_formatted_number ON public.work_orders USING btree (formatted_number);


--
-- TOC entry 5470 (class 1259 OID 246288)
-- Name: idx_work_orders_owner_technician_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_owner_technician_id ON public.work_orders USING btree (owner_technician_id);


--
-- TOC entry 5471 (class 1259 OID 286353)
-- Name: idx_work_orders_sales_opportunity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_sales_opportunity ON public.work_orders USING btree (sales_opportunity);


--
-- TOC entry 5472 (class 1259 OID 286354)
-- Name: idx_work_orders_sales_stage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_sales_stage ON public.work_orders USING btree (sales_stage);


--
-- TOC entry 5473 (class 1259 OID 286349)
-- Name: idx_work_orders_sales_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_sales_user_id ON public.work_orders USING btree (sales_user_id);


--
-- TOC entry 5474 (class 1259 OID 289452)
-- Name: idx_work_orders_status_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_status_priority ON public.work_orders USING btree (status, priority);


--
-- TOC entry 5475 (class 1259 OID 289478)
-- Name: idx_work_orders_technician_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_technician_status ON public.work_orders USING btree (owner_technician_id, status);


--
-- TOC entry 5476 (class 1259 OID 246286)
-- Name: idx_work_orders_ticket_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_ticket_number ON public.work_orders USING btree (ticket_number);


--
-- TOC entry 5477 (class 1259 OID 253770)
-- Name: idx_work_orders_year_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_orders_year_created ON public.work_orders USING btree (year_created);


--
-- TOC entry 5601 (class 1259 OID 253773)
-- Name: idx_yearly_sequences_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_yearly_sequences_year ON public.yearly_sequences USING btree (year);


--
-- TOC entry 5462 (class 1259 OID 220693)
-- Name: uniq_machine_model_serial; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uniq_machine_model_serial ON public.machines USING btree (COALESCE(name, ''::text), COALESCE(catalogue_number, ''::text), COALESCE(serial_number, ''::text));


--
-- TOC entry 5948 (class 2620 OID 314178)
-- Name: rental_machines rental_machine_status_change_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER rental_machine_status_change_trigger AFTER UPDATE ON public.rental_machines FOR EACH ROW EXECUTE FUNCTION public.track_rental_machine_status_change();


--
-- TOC entry 5925 (class 2620 OID 338711)
-- Name: repair_tickets set_formatted_number_repair_tickets; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_formatted_number_repair_tickets BEFORE INSERT ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();


--
-- TOC entry 5934 (class 2620 OID 338712)
-- Name: warranty_repair_tickets set_formatted_number_warranty_repair_tickets; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_formatted_number_warranty_repair_tickets BEFORE INSERT ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();


--
-- TOC entry 5928 (class 2620 OID 338714)
-- Name: warranty_work_orders set_formatted_number_warranty_work_orders; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_formatted_number_warranty_work_orders BEFORE INSERT ON public.warranty_work_orders FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();


--
-- TOC entry 5919 (class 2620 OID 338713)
-- Name: work_orders set_formatted_number_work_orders; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_formatted_number_work_orders BEFORE INSERT ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.set_formatted_number_and_year();


--
-- TOC entry 5942 (class 2620 OID 338716)
-- Name: quotes set_quote_formatted_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_quote_formatted_number BEFORE INSERT OR UPDATE OF quote_number, year_created ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.generate_quote_formatted_number();


--
-- TOC entry 5926 (class 2620 OID 246264)
-- Name: repair_tickets set_ticket_number_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_ticket_number_trigger BEFORE INSERT ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();


--
-- TOC entry 5915 (class 2620 OID 32896)
-- Name: customers set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5921 (class 2620 OID 32898)
-- Name: inventory set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5916 (class 2620 OID 32897)
-- Name: machines set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5924 (class 2620 OID 228946)
-- Name: notifications set_updated_at; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5927 (class 2620 OID 228990)
-- Name: repair_tickets set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5914 (class 2620 OID 32895)
-- Name: users set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5930 (class 2620 OID 229069)
-- Name: warranty_work_order_inventory set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_order_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5931 (class 2620 OID 229070)
-- Name: warranty_work_order_notes set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_order_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5929 (class 2620 OID 229068)
-- Name: warranty_work_orders set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.warranty_work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5922 (class 2620 OID 32901)
-- Name: work_order_inventory set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5923 (class 2620 OID 32900)
-- Name: work_order_notes set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_order_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5920 (class 2620 OID 32899)
-- Name: work_orders set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5939 (class 2620 OID 262422)
-- Name: assigned_machines set_updated_at_assigned_machines; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_assigned_machines BEFORE UPDATE ON public.assigned_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5946 (class 2620 OID 289263)
-- Name: inventory_categories set_updated_at_inventory_categories; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_inventory_categories BEFORE UPDATE ON public.inventory_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5945 (class 2620 OID 289495)
-- Name: lead_follow_ups set_updated_at_lead_follow_ups; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_lead_follow_ups BEFORE UPDATE ON public.lead_follow_ups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5937 (class 2620 OID 262420)
-- Name: machine_models set_updated_at_machine_models; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_machine_models BEFORE UPDATE ON public.machine_models FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5954 (class 2620 OID 314397)
-- Name: machine_pricing set_updated_at_machine_pricing; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_machine_pricing BEFORE UPDATE ON public.machine_pricing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5941 (class 2620 OID 286290)
-- Name: machine_rentals set_updated_at_machine_rentals; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_machine_rentals BEFORE UPDATE ON public.machine_rentals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5938 (class 2620 OID 262421)
-- Name: machine_serials set_updated_at_machine_serials; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_machine_serials BEFORE UPDATE ON public.machine_serials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5952 (class 2620 OID 314265)
-- Name: notification_deliveries set_updated_at_notification_deliveries; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_notification_deliveries BEFORE UPDATE ON public.notification_deliveries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5951 (class 2620 OID 314264)
-- Name: notification_templates set_updated_at_notification_templates; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_notification_templates BEFORE UPDATE ON public.notification_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5953 (class 2620 OID 314396)
-- Name: pricing_rules set_updated_at_pricing_rules; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_pricing_rules BEFORE UPDATE ON public.pricing_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5949 (class 2620 OID 314138)
-- Name: rental_machines set_updated_at_rental_machines; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_rental_machines BEFORE UPDATE ON public.rental_machines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5932 (class 2620 OID 246268)
-- Name: machine_categories set_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.machine_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5933 (class 2620 OID 246269)
-- Name: warranty_periods set_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.warranty_periods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5935 (class 2620 OID 246270)
-- Name: warranty_repair_tickets set_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_updated_at_trigger BEFORE UPDATE ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- TOC entry 5950 (class 2620 OID 314263)
-- Name: user_notification_preferences set_updated_at_user_notification_preferences; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_user_notification_preferences BEFORE UPDATE ON public.user_notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5917 (class 2620 OID 246266)
-- Name: machines set_warranty_expiry_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_warranty_expiry_trigger BEFORE INSERT OR UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_expiry();


--
-- TOC entry 5936 (class 2620 OID 246265)
-- Name: warranty_repair_tickets set_warranty_ticket_number_trigger; Type: TRIGGER; Schema: public; Owner: repairadmin
--

CREATE TRIGGER set_warranty_ticket_number_trigger BEFORE INSERT ON public.warranty_repair_tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();


--
-- TOC entry 5918 (class 2620 OID 32848)
-- Name: machines trg_set_warranty_active; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_set_warranty_active BEFORE INSERT OR UPDATE OF warranty_expiry_date ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_active();


--
-- TOC entry 5940 (class 2620 OID 262435)
-- Name: assigned_machines trg_set_warranty_active_assigned_machines; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_set_warranty_active_assigned_machines BEFORE INSERT OR UPDATE OF warranty_expiry_date ON public.assigned_machines FOR EACH ROW EXECUTE FUNCTION public.set_warranty_active_assigned_machines();


--
-- TOC entry 5947 (class 2620 OID 305907)
-- Name: feedback trigger_update_feedback_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_feedback_updated_at BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.update_feedback_updated_at();


--
-- TOC entry 5959 (class 2620 OID 338770)
-- Name: customer_portal_users update_customer_portal_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_customer_portal_users_updated_at BEFORE UPDATE ON public.customer_portal_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5943 (class 2620 OID 287843)
-- Name: quotes update_quote_status_timestamp_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_quote_status_timestamp_trigger BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_quote_status_timestamp();


--
-- TOC entry 5958 (class 2620 OID 338703)
-- Name: quote_templates update_quote_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_quote_templates_updated_at BEFORE UPDATE ON public.quote_templates FOR EACH ROW EXECUTE FUNCTION public.update_quote_templates_updated_at();


--
-- TOC entry 5944 (class 2620 OID 287841)
-- Name: quotes update_quotes_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_quotes_timestamp BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- TOC entry 5955 (class 2620 OID 322300)
-- Name: sales_targets update_sales_targets_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_sales_targets_updated_at BEFORE UPDATE ON public.sales_targets FOR EACH ROW EXECUTE FUNCTION public.update_sales_targets_updated_at();


--
-- TOC entry 5957 (class 2620 OID 322373)
-- Name: user_table_preferences update_user_table_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_table_preferences_updated_at BEFORE UPDATE ON public.user_table_preferences FOR EACH ROW EXECUTE FUNCTION public.update_user_table_preferences_updated_at();


--
-- TOC entry 5956 (class 2620 OID 322349)
-- Name: user_permissions user_permissions_audit_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER user_permissions_audit_trigger AFTER INSERT OR DELETE OR UPDATE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.log_permission_change();


--
-- TOC entry 5872 (class 2606 OID 286236)
-- Name: assigned_machines assigned_machines_added_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigned_machines
    ADD CONSTRAINT assigned_machines_added_by_user_id_fkey FOREIGN KEY (added_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5873 (class 2606 OID 262408)
-- Name: assigned_machines assigned_machines_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigned_machines
    ADD CONSTRAINT assigned_machines_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5874 (class 2606 OID 262403)
-- Name: assigned_machines assigned_machines_serial_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigned_machines
    ADD CONSTRAINT assigned_machines_serial_id_fkey FOREIGN KEY (serial_id) REFERENCES public.machine_serials(id) ON DELETE CASCADE;


--
-- TOC entry 5875 (class 2606 OID 286231)
-- Name: assigned_machines assigned_machines_sold_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assigned_machines
    ADD CONSTRAINT assigned_machines_sold_by_user_id_fkey FOREIGN KEY (sold_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5843 (class 2606 OID 62806)
-- Name: customer_communications customer_communications_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_communications
    ADD CONSTRAINT customer_communications_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5844 (class 2606 OID 62801)
-- Name: customer_communications customer_communications_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_communications
    ADD CONSTRAINT customer_communications_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5912 (class 2606 OID 338749)
-- Name: customer_portal_activity customer_portal_activity_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_activity
    ADD CONSTRAINT customer_portal_activity_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- TOC entry 5913 (class 2606 OID 338754)
-- Name: customer_portal_activity customer_portal_activity_portal_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_activity
    ADD CONSTRAINT customer_portal_activity_portal_user_id_fkey FOREIGN KEY (portal_user_id) REFERENCES public.customer_portal_users(id) ON DELETE SET NULL;


--
-- TOC entry 5911 (class 2606 OID 338734)
-- Name: customer_portal_users customer_portal_users_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_portal_users
    ADD CONSTRAINT customer_portal_users_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5845 (class 2606 OID 72173)
-- Name: customer_preferences customer_preferences_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.customer_preferences
    ADD CONSTRAINT customer_preferences_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5899 (class 2606 OID 314388)
-- Name: customer_tier_assignments customer_tier_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tier_assignments
    ADD CONSTRAINT customer_tier_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id);


--
-- TOC entry 5900 (class 2606 OID 314378)
-- Name: customer_tier_assignments customer_tier_assignments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tier_assignments
    ADD CONSTRAINT customer_tier_assignments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5901 (class 2606 OID 314383)
-- Name: customer_tier_assignments customer_tier_assignments_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_tier_assignments
    ADD CONSTRAINT customer_tier_assignments_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.customer_pricing_tiers(id) ON DELETE CASCADE;


--
-- TOC entry 5825 (class 2606 OID 286224)
-- Name: customers customers_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5898 (class 2606 OID 314343)
-- Name: demand_tracking demand_tracking_rental_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.demand_tracking
    ADD CONSTRAINT demand_tracking_rental_machine_id_fkey FOREIGN KEY (rental_machine_id) REFERENCES public.rental_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5886 (class 2606 OID 305896)
-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5881 (class 2606 OID 289487)
-- Name: leads fk_leads_created_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT fk_leads_created_by FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5828 (class 2606 OID 228985)
-- Name: work_orders fk_work_orders_converted_from_ticket; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT fk_work_orders_converted_from_ticket FOREIGN KEY (converted_from_ticket_id) REFERENCES public.repair_tickets(id) ON DELETE SET NULL;


--
-- TOC entry 5835 (class 2606 OID 85242)
-- Name: inventory inventory_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


--
-- TOC entry 5884 (class 2606 OID 287885)
-- Name: lead_follow_ups lead_follow_ups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5885 (class 2606 OID 287880)
-- Name: lead_follow_ups lead_follow_ups_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_ups
    ADD CONSTRAINT lead_follow_ups_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- TOC entry 5882 (class 2606 OID 287860)
-- Name: leads leads_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- TOC entry 5883 (class 2606 OID 287865)
-- Name: leads leads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5870 (class 2606 OID 262369)
-- Name: machine_models machine_models_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_models
    ADD CONSTRAINT machine_models_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.machine_categories(id);


--
-- TOC entry 5895 (class 2606 OID 314301)
-- Name: machine_pricing machine_pricing_rental_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_pricing
    ADD CONSTRAINT machine_pricing_rental_machine_id_fkey FOREIGN KEY (rental_machine_id) REFERENCES public.rental_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5876 (class 2606 OID 286272)
-- Name: machine_rentals machine_rentals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals
    ADD CONSTRAINT machine_rentals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5877 (class 2606 OID 286267)
-- Name: machine_rentals machine_rentals_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_rentals
    ADD CONSTRAINT machine_rentals_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5871 (class 2606 OID 262386)
-- Name: machine_serials machine_serials_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machine_serials
    ADD CONSTRAINT machine_serials_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.machine_models(id) ON DELETE CASCADE;


--
-- TOC entry 5826 (class 2606 OID 246243)
-- Name: machines machines_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.machine_categories(id) ON DELETE SET NULL;


--
-- TOC entry 5827 (class 2606 OID 16427)
-- Name: machines machines_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5892 (class 2606 OID 314235)
-- Name: notification_deliveries notification_deliveries_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- TOC entry 5893 (class 2606 OID 314240)
-- Name: notification_deliveries notification_deliveries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5849 (class 2606 OID 169428)
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5896 (class 2606 OID 314323)
-- Name: pricing_history pricing_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_history
    ADD CONSTRAINT pricing_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 5897 (class 2606 OID 314318)
-- Name: pricing_history pricing_history_rental_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_history
    ADD CONSTRAINT pricing_history_rental_machine_id_fkey FOREIGN KEY (rental_machine_id) REFERENCES public.rental_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5894 (class 2606 OID 314279)
-- Name: pricing_rules pricing_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5880 (class 2606 OID 287829)
-- Name: quote_items quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- TOC entry 5910 (class 2606 OID 338683)
-- Name: quote_template_items quote_template_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_template_items
    ADD CONSTRAINT quote_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.quote_templates(id) ON DELETE CASCADE;


--
-- TOC entry 5909 (class 2606 OID 338666)
-- Name: quote_templates quote_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_templates
    ADD CONSTRAINT quote_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5878 (class 2606 OID 287810)
-- Name: quotes quotes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5879 (class 2606 OID 287805)
-- Name: quotes quotes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- TOC entry 5889 (class 2606 OID 314157)
-- Name: rental_machine_status_history rental_machine_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machine_status_history
    ADD CONSTRAINT rental_machine_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- TOC entry 5890 (class 2606 OID 314152)
-- Name: rental_machine_status_history rental_machine_status_history_rental_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machine_status_history
    ADD CONSTRAINT rental_machine_status_history_rental_machine_id_fkey FOREIGN KEY (rental_machine_id) REFERENCES public.rental_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5887 (class 2606 OID 314128)
-- Name: rental_machines rental_machines_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machines
    ADD CONSTRAINT rental_machines_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5888 (class 2606 OID 314123)
-- Name: rental_machines rental_machines_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rental_machines
    ADD CONSTRAINT rental_machines_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.machine_models(id) ON DELETE CASCADE;


--
-- TOC entry 5850 (class 2606 OID 229078)
-- Name: repair_tickets repair_tickets_converted_to_warranty_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_converted_to_warranty_work_order_id_fkey FOREIGN KEY (converted_to_warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE SET NULL;


--
-- TOC entry 5851 (class 2606 OID 228980)
-- Name: repair_tickets repair_tickets_converted_to_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_converted_to_work_order_id_fkey FOREIGN KEY (converted_to_work_order_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;


--
-- TOC entry 5852 (class 2606 OID 228975)
-- Name: repair_tickets repair_tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_created_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5853 (class 2606 OID 228965)
-- Name: repair_tickets repair_tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5854 (class 2606 OID 262488)
-- Name: repair_tickets repair_tickets_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5855 (class 2606 OID 286334)
-- Name: repair_tickets repair_tickets_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_tickets
    ADD CONSTRAINT repair_tickets_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5902 (class 2606 OID 322287)
-- Name: sales_targets sales_targets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 5903 (class 2606 OID 322282)
-- Name: sales_targets sales_targets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5846 (class 2606 OID 85224)
-- Name: stock_movements stock_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE CASCADE;


--
-- TOC entry 5847 (class 2606 OID 85234)
-- Name: stock_movements stock_movements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5848 (class 2606 OID 85229)
-- Name: stock_movements stock_movements_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;


--
-- TOC entry 5908 (class 2606 OID 330467)
-- Name: user_action_logs user_action_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_action_logs
    ADD CONSTRAINT user_action_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5891 (class 2606 OID 314197)
-- Name: user_notification_preferences user_notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5906 (class 2606 OID 322340)
-- Name: user_permissions_audit user_permissions_audit_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions_audit
    ADD CONSTRAINT user_permissions_audit_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- TOC entry 5904 (class 2606 OID 322320)
-- Name: user_permissions user_permissions_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- TOC entry 5905 (class 2606 OID 322315)
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5907 (class 2606 OID 322364)
-- Name: user_table_preferences user_table_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_table_preferences
    ADD CONSTRAINT user_table_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5865 (class 2606 OID 246238)
-- Name: warranty_repair_tickets warranty_repair_tickets_converted_to_warranty_work_order_i_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_converted_to_warranty_work_order_i_fkey FOREIGN KEY (converted_to_warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE SET NULL;


--
-- TOC entry 5866 (class 2606 OID 246223)
-- Name: warranty_repair_tickets warranty_repair_tickets_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5867 (class 2606 OID 262493)
-- Name: warranty_repair_tickets warranty_repair_tickets_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5868 (class 2606 OID 286343)
-- Name: warranty_repair_tickets warranty_repair_tickets_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5869 (class 2606 OID 246233)
-- Name: warranty_repair_tickets warranty_repair_tickets_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.warranty_repair_tickets
    ADD CONSTRAINT warranty_repair_tickets_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 5862 (class 2606 OID 229047)
-- Name: warranty_work_order_inventory warranty_work_order_inventory_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_inventory
    ADD CONSTRAINT warranty_work_order_inventory_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE RESTRICT;


--
-- TOC entry 5863 (class 2606 OID 229042)
-- Name: warranty_work_order_inventory warranty_work_order_inventory_warranty_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_inventory
    ADD CONSTRAINT warranty_work_order_inventory_warranty_work_order_id_fkey FOREIGN KEY (warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE CASCADE;


--
-- TOC entry 5864 (class 2606 OID 229063)
-- Name: warranty_work_order_notes warranty_work_order_notes_warranty_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_order_notes
    ADD CONSTRAINT warranty_work_order_notes_warranty_work_order_id_fkey FOREIGN KEY (warranty_work_order_id) REFERENCES public.warranty_work_orders(id) ON DELETE CASCADE;


--
-- TOC entry 5856 (class 2606 OID 286217)
-- Name: warranty_work_orders warranty_work_orders_converted_from_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_converted_from_ticket_id_fkey FOREIGN KEY (converted_from_ticket_id) REFERENCES public.warranty_repair_tickets(id) ON DELETE SET NULL;


--
-- TOC entry 5857 (class 2606 OID 229017)
-- Name: warranty_work_orders warranty_work_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5858 (class 2606 OID 262503)
-- Name: warranty_work_orders warranty_work_orders_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5859 (class 2606 OID 246255)
-- Name: warranty_work_orders warranty_work_orders_owner_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_owner_technician_id_fkey FOREIGN KEY (owner_technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5860 (class 2606 OID 286325)
-- Name: warranty_work_orders warranty_work_orders_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5861 (class 2606 OID 229022)
-- Name: warranty_work_orders warranty_work_orders_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warranty_work_orders
    ADD CONSTRAINT warranty_work_orders_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5839 (class 2606 OID 43887)
-- Name: work_order_attachments work_order_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_attachments
    ADD CONSTRAINT work_order_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- TOC entry 5840 (class 2606 OID 43882)
-- Name: work_order_attachments work_order_attachments_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_attachments
    ADD CONSTRAINT work_order_attachments_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- TOC entry 5836 (class 2606 OID 16484)
-- Name: work_order_inventory work_order_inventory_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_inventory
    ADD CONSTRAINT work_order_inventory_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE RESTRICT;


--
-- TOC entry 5837 (class 2606 OID 16479)
-- Name: work_order_inventory work_order_inventory_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_inventory
    ADD CONSTRAINT work_order_inventory_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- TOC entry 5838 (class 2606 OID 24773)
-- Name: work_order_notes work_order_notes_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_order_notes
    ADD CONSTRAINT work_order_notes_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- TOC entry 5841 (class 2606 OID 43909)
-- Name: work_order_time_entries work_order_time_entries_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_time_entries
    ADD CONSTRAINT work_order_time_entries_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id);


--
-- TOC entry 5842 (class 2606 OID 43904)
-- Name: work_order_time_entries work_order_time_entries_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: repairadmin
--

ALTER TABLE ONLY public.work_order_time_entries
    ADD CONSTRAINT work_order_time_entries_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- TOC entry 5829 (class 2606 OID 253454)
-- Name: work_orders work_orders_converted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_converted_by_user_id_fkey FOREIGN KEY (converted_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5830 (class 2606 OID 16449)
-- Name: work_orders work_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- TOC entry 5831 (class 2606 OID 262498)
-- Name: work_orders work_orders_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.assigned_machines(id) ON DELETE CASCADE;


--
-- TOC entry 5832 (class 2606 OID 246250)
-- Name: work_orders work_orders_owner_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_owner_technician_id_fkey FOREIGN KEY (owner_technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5833 (class 2606 OID 286316)
-- Name: work_orders work_orders_sales_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_sales_user_id_fkey FOREIGN KEY (sales_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 5834 (class 2606 OID 16465)
-- Name: work_orders work_orders_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 6238 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customers TO repairadmin;


--
-- TOC entry 6239 (class 0 OID 0)
-- Dependencies: 221
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO repairadmin;


--
-- TOC entry 6253 (class 0 OID 0)
-- Dependencies: 222
-- Name: SEQUENCE customers_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.customers_id_seq TO repairadmin;


--
-- TOC entry 6269 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE inventory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventory TO repairadmin;


--
-- TOC entry 6272 (class 0 OID 0)
-- Dependencies: 228
-- Name: SEQUENCE inventory_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.inventory_id_seq TO repairadmin;


--
-- TOC entry 6281 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE machines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.machines TO repairadmin;


--
-- TOC entry 6283 (class 0 OID 0)
-- Dependencies: 224
-- Name: SEQUENCE machines_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.machines_id_seq TO repairadmin;


--
-- TOC entry 6305 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE work_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.work_orders TO repairadmin;


--
-- TOC entry 6316 (class 0 OID 0)
-- Dependencies: 220
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.users_id_seq TO repairadmin;


--
-- TOC entry 6323 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE work_order_inventory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.work_order_inventory TO repairadmin;


--
-- TOC entry 6325 (class 0 OID 0)
-- Dependencies: 230
-- Name: SEQUENCE work_order_inventory_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.work_order_inventory_id_seq TO repairadmin;


--
-- TOC entry 6330 (class 0 OID 0)
-- Dependencies: 226
-- Name: SEQUENCE work_orders_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.work_orders_id_seq TO repairadmin;


-- Completed on 2025-10-11 14:27:09

--
-- PostgreSQL database dump complete
--

