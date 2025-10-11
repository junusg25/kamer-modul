-- Migration: Create user_table_preferences table for column visibility preferences
-- Created: 2025-01-27

-- Table to store user-specific table column visibility preferences
CREATE TABLE IF NOT EXISTS user_table_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    table_key VARCHAR(50) NOT NULL,
    visible_columns JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique preference per user per table
    UNIQUE(user_id, table_key)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_table_prefs_user ON user_table_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_table_prefs_table ON user_table_preferences(table_key);
CREATE INDEX IF NOT EXISTS idx_user_table_prefs_user_table ON user_table_preferences(user_id, table_key);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_table_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_table_preferences_updated_at ON user_table_preferences;
CREATE TRIGGER update_user_table_preferences_updated_at
    BEFORE UPDATE ON user_table_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_table_preferences_updated_at();

-- Note: No sample data needed - preferences are created on-demand by users
