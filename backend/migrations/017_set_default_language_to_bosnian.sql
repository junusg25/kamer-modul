-- Migration: Set default application language to Bosnian
-- Date: 2025-01-14
-- Purpose: Change the default language from English to Bosnian

BEGIN;

-- Update the default app_language setting to Bosnian
UPDATE system_settings 
SET setting_value = 'bs', 
    updated_at = NOW()
WHERE setting_key = 'app_language';

-- If the setting doesn't exist, insert it
INSERT INTO system_settings (setting_key, setting_value, description) 
VALUES ('app_language', 'bs', 'Application language for all users (en/bs)')
ON CONFLICT (setting_key) DO UPDATE SET 
    setting_value = 'bs',
    updated_at = NOW();

COMMIT;
