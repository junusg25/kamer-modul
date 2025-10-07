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
    UNIQUE (user_id, target_type, target_period_start) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sales_targets_user_id ON sales_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_targets_target_type ON sales_targets(target_type);
CREATE INDEX IF NOT EXISTS idx_sales_targets_period ON sales_targets(target_period_start, target_period_end);
CREATE INDEX IF NOT EXISTS idx_sales_targets_active ON sales_targets(is_active);
CREATE INDEX IF NOT EXISTS idx_sales_targets_created_by ON sales_targets(created_by);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sales_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sales_targets_updated_at ON sales_targets;
CREATE TRIGGER update_sales_targets_updated_at
    BEFORE UPDATE ON sales_targets
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_targets_updated_at();

-- Note: Sample targets will be inserted through the API endpoints
-- This ensures proper validation and error handling
