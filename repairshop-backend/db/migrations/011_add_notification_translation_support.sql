-- Migration: Add translation support to notifications table
-- This migration adds columns to support translation keys and parameters for notifications

-- Add new columns to notifications table
ALTER TABLE public.notifications 
ADD COLUMN title_key text,
ADD COLUMN message_key text,
ADD COLUMN message_params jsonb;

-- Update existing notifications to have translation keys
-- For now, we'll set the translation keys to match the existing title/message
-- This ensures backward compatibility while we transition to the new system
UPDATE public.notifications 
SET 
  title_key = 'notifications.legacyTitle',
  message_key = 'notifications.legacyMessage',
  message_params = '{}'::jsonb
WHERE title_key IS NULL;

-- Make the new columns NOT NULL after setting default values
ALTER TABLE public.notifications 
ALTER COLUMN title_key SET NOT NULL,
ALTER COLUMN message_key SET NOT NULL,
ALTER COLUMN message_params SET NOT NULL;

-- Add indexes for better performance on translation lookups
CREATE INDEX idx_notifications_title_key ON public.notifications(title_key);
CREATE INDEX idx_notifications_message_key ON public.notifications(message_key);
