-- Migration: Add last_seen column to users table
-- Date: 2025-01-30

-- Add last_seen column to users table
ALTER TABLE users ADD COLUMN last_seen timestamp without time zone DEFAULT CURRENT_TIMESTAMP;

-- Update existing users to have a last_seen value
UPDATE users SET last_seen = created_at WHERE last_seen IS NULL;
