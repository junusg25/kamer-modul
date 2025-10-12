-- Migration: Create user_action_logs table for comprehensive audit trail
-- Created: 2025-01-27

-- Table to store all user actions for audit and compliance
CREATE TABLE IF NOT EXISTS user_action_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'convert', 'assign', etc.
    entity_type VARCHAR(50) NOT NULL, -- 'customer', 'work_order', 'machine', 'inventory', etc.
    entity_id INTEGER,
    entity_name VARCHAR(255),
    action_details JSONB, -- Store before/after values, additional context
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_action_logs_user ON user_action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_user_created ON user_action_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_entity ON user_action_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_action_type ON user_action_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_created ON user_action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_entity_created ON user_action_logs(entity_type, created_at DESC);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_user_action_logs_user_entity ON user_action_logs(user_id, entity_type, created_at DESC);

-- Note: No sample data needed - logs are created by user actions
