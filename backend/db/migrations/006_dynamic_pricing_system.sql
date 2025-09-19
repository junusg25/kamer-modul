-- Migration: Dynamic Pricing System for Rental Machines
-- This adds dynamic pricing capabilities with demand-based adjustments

-- Create pricing rules table
CREATE TABLE IF NOT EXISTS public.pricing_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL, -- 'demand', 'seasonal', 'availability', 'customer_tier', 'duration'
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 1, -- Higher priority rules override lower ones
    conditions JSONB NOT NULL, -- Rule conditions (e.g., {"demand_level": "high", "season": "summer"})
    adjustments JSONB NOT NULL, -- Price adjustments (e.g., {"daily_multiplier": 1.2, "weekly_multiplier": 1.1})
    created_by INTEGER REFERENCES public.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for pricing rules
CREATE INDEX IF NOT EXISTS idx_pricing_rules_type ON public.pricing_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON public.pricing_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_priority ON public.pricing_rules(priority);

-- Create machine-specific pricing table
CREATE TABLE IF NOT EXISTS public.machine_pricing (
    id SERIAL PRIMARY KEY,
    rental_machine_id INTEGER NOT NULL REFERENCES public.rental_machines(id) ON DELETE CASCADE,
    base_price_daily DECIMAL(10,2) NOT NULL,
    base_price_weekly DECIMAL(10,2),
    base_price_monthly DECIMAL(10,2),
    minimum_rental_days INTEGER DEFAULT 1,
    maximum_rental_days INTEGER,
    currency VARCHAR(3) DEFAULT 'EUR',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rental_machine_id)
);

-- Create indexes for machine pricing
CREATE INDEX IF NOT EXISTS idx_machine_pricing_machine_id ON public.machine_pricing(rental_machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_pricing_active ON public.machine_pricing(is_active);

-- Create pricing history table for tracking price changes
CREATE TABLE IF NOT EXISTS public.pricing_history (
    id SERIAL PRIMARY KEY,
    rental_machine_id INTEGER NOT NULL REFERENCES public.rental_machines(id) ON DELETE CASCADE,
    old_price_daily DECIMAL(10,2),
    new_price_daily DECIMAL(10,2),
    old_price_weekly DECIMAL(10,2),
    new_price_weekly DECIMAL(10,2),
    old_price_monthly DECIMAL(10,2),
    new_price_monthly DECIMAL(10,2),
    change_reason VARCHAR(255),
    applied_rules JSONB, -- Which pricing rules were applied
    changed_by INTEGER REFERENCES public.users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for pricing history
CREATE INDEX IF NOT EXISTS idx_pricing_history_machine_id ON public.pricing_history(rental_machine_id);
CREATE INDEX IF NOT EXISTS idx_pricing_history_changed_at ON public.pricing_history(changed_at);

-- Create demand tracking table
CREATE TABLE IF NOT EXISTS public.demand_tracking (
    id SERIAL PRIMARY KEY,
    rental_machine_id INTEGER REFERENCES public.rental_machines(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    demand_level VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'peak'
    utilization_percentage DECIMAL(5,2),
    booking_requests INTEGER DEFAULT 0,
    completed_rentals INTEGER DEFAULT 0,
    cancelled_rentals INTEGER DEFAULT 0,
    average_rental_duration DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rental_machine_id, date)
);

-- Create indexes for demand tracking
CREATE INDEX IF NOT EXISTS idx_demand_tracking_machine_id ON public.demand_tracking(rental_machine_id);
CREATE INDEX IF NOT EXISTS idx_demand_tracking_date ON public.demand_tracking(date);
CREATE INDEX IF NOT EXISTS idx_demand_tracking_demand_level ON public.demand_tracking(demand_level);

-- Create customer pricing tiers table
CREATE TABLE IF NOT EXISTS public.customer_pricing_tiers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    discount_percentage DECIMAL(5,2) DEFAULT 0, -- Percentage discount from base price
    minimum_rentals INTEGER DEFAULT 0, -- Minimum rentals to qualify
    minimum_total_spent DECIMAL(10,2) DEFAULT 0, -- Minimum total spent to qualify
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create customer tier assignments table
CREATE TABLE IF NOT EXISTS public.customer_tier_assignments (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    tier_id INTEGER NOT NULL REFERENCES public.customer_pricing_tiers(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES public.users(id),
    expires_at TIMESTAMP, -- Optional expiration date
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(customer_id, tier_id)
);

-- Create indexes for customer tiers
CREATE INDEX IF NOT EXISTS idx_customer_tier_assignments_customer_id ON public.customer_tier_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tier_assignments_tier_id ON public.customer_tier_assignments(tier_id);
CREATE INDEX IF NOT EXISTS idx_customer_tier_assignments_active ON public.customer_tier_assignments(is_active);

-- Insert default pricing tiers
INSERT INTO public.customer_pricing_tiers (name, description, discount_percentage, minimum_rentals, minimum_total_spent) VALUES
('Standard', 'Standard pricing for all customers', 0.00, 0, 0),
('Frequent', 'Frequent customers with 5+ rentals', 5.00, 5, 0),
('VIP', 'VIP customers with 20+ rentals or €10,000+ spent', 10.00, 20, 10000),
('Enterprise', 'Enterprise customers with 50+ rentals or €25,000+ spent', 15.00, 50, 25000)
ON CONFLICT (name) DO NOTHING;

-- Insert default pricing rules
INSERT INTO public.pricing_rules (name, description, rule_type, priority, conditions, adjustments) VALUES
('High Demand Multiplier', 'Increase prices during high demand periods', 'demand', 3, 
 '{"demand_level": "high"}', '{"daily_multiplier": 1.3, "weekly_multiplier": 1.2, "monthly_multiplier": 1.1}'),

('Peak Demand Multiplier', 'Significant price increase during peak demand', 'demand', 4,
 '{"demand_level": "peak"}', '{"daily_multiplier": 1.5, "weekly_multiplier": 1.3, "monthly_multiplier": 1.2}'),

('Low Demand Discount', 'Reduce prices during low demand periods', 'demand', 2,
 '{"demand_level": "low"}', '{"daily_multiplier": 0.8, "weekly_multiplier": 0.85, "monthly_multiplier": 0.9}'),

('Summer Premium', 'Higher prices during summer months', 'seasonal', 2,
 '{"season": "summer"}', '{"daily_multiplier": 1.2, "weekly_multiplier": 1.15, "monthly_multiplier": 1.1}'),

('Winter Discount', 'Lower prices during winter months', 'seasonal', 2,
 '{"season": "winter"}', '{"daily_multiplier": 0.9, "weekly_multiplier": 0.85, "monthly_multiplier": 0.8}'),

('Low Availability Premium', 'Higher prices when availability is low', 'availability', 3,
 '{"availability_percentage": {"lt": 20}}', '{"daily_multiplier": 1.4, "weekly_multiplier": 1.3, "monthly_multiplier": 1.2}'),

('Long Term Discount', 'Discount for longer rental periods', 'duration', 1,
 '{"rental_days": {"gte": 30}}', '{"daily_multiplier": 0.7, "weekly_multiplier": 0.75, "monthly_multiplier": 0.8}'),

('Short Term Premium', 'Premium for very short rentals', 'duration', 1,
 '{"rental_days": {"lte": 3}}', '{"daily_multiplier": 1.2, "weekly_multiplier": 1.1, "monthly_multiplier": 1.05}')
ON CONFLICT DO NOTHING;

-- Add triggers for updated_at columns
CREATE TRIGGER set_updated_at_pricing_rules
    BEFORE UPDATE ON public.pricing_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_machine_pricing
    BEFORE UPDATE ON public.machine_pricing
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add function to calculate dynamic pricing
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
BEGIN
    -- Get base pricing for the machine
    SELECT * INTO base_pricing
    FROM machine_pricing
    WHERE rental_machine_id = p_rental_machine_id AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No pricing found for machine %', p_rental_machine_id;
    END IF;
    
    -- Calculate rental duration
    rental_days := EXTRACT(DAYS FROM p_rental_end_date - p_rental_start_date) + 1;
    
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
            IF rule_conditions->'availability_percentage' ? 'lt' THEN
                rule_applies := rule_applies AND (availability_percentage < (rule_conditions->'availability_percentage'->>'lt')::DECIMAL);
            END IF;
        END IF;
        
        -- Apply rule if conditions are met
        IF rule_applies THEN
            IF rule_adjustments ? 'daily_multiplier' THEN
                final_daily := final_daily * (rule_adjustments->>'daily_multiplier')::DECIMAL;
            END IF;
            IF rule_adjustments ? 'weekly_multiplier' THEN
                final_weekly := final_weekly * (rule_adjustments->>'weekly_multiplier')::DECIMAL;
            END IF;
            IF rule_adjustments ? 'monthly_multiplier' THEN
                final_monthly := final_monthly * (rule_adjustments->>'monthly_multiplier')::DECIMAL;
            END IF;
            
            -- Add to applied rules
            applied_rules := applied_rules || jsonb_build_object(
                'rule_id', rule_record.id,
                'rule_name', rule_record.name,
                'rule_type', rule_record.rule_type,
                'adjustments', rule_adjustments
            );
        END IF;
    END LOOP;
    
    -- Get customer tier discount
    SELECT COALESCE(cpt.discount_percentage, 0) INTO customer_tier
    FROM customer_tier_assignments cta
    JOIN customer_pricing_tiers cpt ON cta.tier_id = cpt.id
    WHERE cta.customer_id = p_customer_id 
      AND cta.is_active = TRUE 
      AND (cta.expires_at IS NULL OR cta.expires_at > CURRENT_TIMESTAMP);
    
    -- Apply customer discount
    final_daily := final_daily * (1 - COALESCE(customer_tier, 0) / 100);
    final_weekly := final_weekly * (1 - COALESCE(customer_tier, 0) / 100);
    final_monthly := final_monthly * (1 - COALESCE(customer_tier, 0) / 100);
    
    -- Return results
    RETURN QUERY SELECT 
        final_daily,
        final_weekly,
        final_monthly,
        applied_rules,
        COALESCE(customer_tier, 0);
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE public.pricing_rules IS 'Dynamic pricing rules with conditions and adjustments';
COMMENT ON TABLE public.machine_pricing IS 'Base pricing for each rental machine';
COMMENT ON TABLE public.pricing_history IS 'History of price changes for audit trail';
COMMENT ON TABLE public.demand_tracking IS 'Daily demand tracking for pricing decisions';
COMMENT ON TABLE public.customer_pricing_tiers IS 'Customer pricing tiers with discount levels';
COMMENT ON TABLE public.customer_tier_assignments IS 'Customer assignments to pricing tiers';
COMMENT ON FUNCTION public.calculate_dynamic_pricing IS 'Calculates dynamic pricing based on rules, demand, and customer tier';
