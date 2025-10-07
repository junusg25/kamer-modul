-- Migration: Create sales_targets table for target management
-- Created: 2025-01-27

CREATE TABLE IF NOT EXISTS sales_targets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('monthly', 'quarterly', 'yearly')),
    target_amount DECIMAL(12,2) NOT NULL CHECK (target_amount >= 0),
    target_period_start DATE NOT NULL,
    target_period_end DATE NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    -- Ensure target period end is after start
    CONSTRAINT valid_target_period CHECK (target_period_end > target_period_start),
    
    -- Ensure only one active target per user per period
    CONSTRAINT unique_active_target EXCLUDE (user_id WITH =, target_type WITH =, target_period_start WITH =) 
        WHERE (is_active = true)
);

-- Create indexes for better performance
CREATE INDEX idx_sales_targets_user_id ON sales_targets(user_id);
CREATE INDEX idx_sales_targets_target_type ON sales_targets(target_type);
CREATE INDEX idx_sales_targets_period ON sales_targets(target_period_start, target_period_end);
CREATE INDEX idx_sales_targets_active ON sales_targets(is_active);
CREATE INDEX idx_sales_targets_created_by ON sales_targets(created_by);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sales_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sales_targets_updated_at
    BEFORE UPDATE ON sales_targets
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_targets_updated_at();

-- Insert some sample targets for existing sales users
INSERT INTO sales_targets (user_id, target_type, target_amount, target_period_start, target_period_end, created_by, description)
SELECT 
    u.id,
    'monthly',
    CASE 
        WHEN u.role = 'sales' THEN 50000.00  -- 50,000 KM monthly target for sales
        ELSE 25000.00  -- 25,000 KM for other roles
    END,
    DATE_TRUNC('month', CURRENT_DATE),  -- Start of current month
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,  -- End of current month
    1,  -- Created by admin (user ID 1)
    'Initial monthly target for ' || u.name
FROM users u 
WHERE u.role = 'sales' AND u.status = 'active'
ON CONFLICT (user_id, target_type, target_period_start) WHERE is_active = true DO NOTHING;

-- Insert quarterly targets
INSERT INTO sales_targets (user_id, target_type, target_amount, target_period_start, target_period_end, created_by, description)
SELECT 
    u.id,
    'quarterly',
    CASE 
        WHEN u.role = 'sales' THEN 150000.00  -- 150,000 KM quarterly target
        ELSE 75000.00  -- 75,000 KM for other roles
    END,
    DATE_TRUNC('quarter', CURRENT_DATE),  -- Start of current quarter
    (DATE_TRUNC('quarter', CURRENT_DATE) + INTERVAL '3 months' - INTERVAL '1 day')::DATE,  -- End of current quarter
    1,  -- Created by admin
    'Initial quarterly target for ' || u.name
FROM users u 
WHERE u.role = 'sales' AND u.status = 'active'
ON CONFLICT (user_id, target_type, target_period_start) WHERE is_active = true DO NOTHING;

-- Insert yearly targets
INSERT INTO sales_targets (user_id, target_type, target_amount, target_period_start, target_period_end, created_by, description)
SELECT 
    u.id,
    'yearly',
    CASE 
        WHEN u.role = 'sales' THEN 600000.00  -- 600,000 KM yearly target
        ELSE 300000.00  -- 300,000 KM for other roles
    END,
    DATE_TRUNC('year', CURRENT_DATE),  -- Start of current year
    (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day')::DATE,  -- End of current year
    1,  -- Created by admin
    'Initial yearly target for ' || u.name
FROM users u 
WHERE u.role = 'sales' AND u.status = 'active'
ON CONFLICT (user_id, target_type, target_period_start) WHERE is_active = true DO NOTHING;
