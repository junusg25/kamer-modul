-- Fix the calculate_dynamic_pricing function
-- The EXTRACT(DAYS FROM ...) syntax was incorrect

CREATE OR REPLACE FUNCTION public.calculate_dynamic_pricing(
    p_rental_machine_id INTEGER,
    p_rental_start_date DATE,
    p_rental_end_date DATE,
    p_customer_id INTEGER DEFAULT NULL
) RETURNS TABLE(
    daily_price DECIMAL(10,2),
    weekly_price DECIMAL(10,2),
    monthly_price DECIMAL(10,2),
    applied_rules JSONB,
    customer_discount DECIMAL(5,2)
) AS $$
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
    SELECT COALESCE(demand_level, 'medium') INTO demand_level
    FROM demand_tracking
    WHERE rental_machine_id = p_rental_machine_id 
      AND date = p_rental_start_date;
    
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
$$ LANGUAGE plpgsql;
