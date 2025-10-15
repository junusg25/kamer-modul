-- Migration: Create system_settings table for application-wide settings
-- Date: 2025-01-14
-- Purpose: Store system-wide settings like language preference, app configuration, etc.

BEGIN;

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_by ON system_settings(updated_by);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_updated_at();

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('app_language', 'en', 'Application language for all users (en/bs)'),
('app_name', 'Kamer.ba', 'Application display name'),
('app_version', '1.0.0', 'Application version'),
('maintenance_mode', 'false', 'Enable maintenance mode (true/false)'),
('max_file_size', '52428800', 'Maximum file upload size in bytes (50MB)'),
('allowed_file_types', 'png,jpg,jpeg,pdf,docx,xlsx', 'Allowed file types for uploads')
ON CONFLICT (setting_key) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE system_settings IS 'Stores system-wide application settings';
COMMENT ON COLUMN system_settings.setting_key IS 'Unique identifier for the setting';
COMMENT ON COLUMN system_settings.setting_value IS 'Value of the setting';
COMMENT ON COLUMN system_settings.description IS 'Human-readable description of the setting';
COMMENT ON COLUMN system_settings.updated_by IS 'User ID who last updated this setting';

COMMIT;
