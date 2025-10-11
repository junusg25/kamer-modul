-- Migration: Add online_users table for tracking user online status across PM2 clusters
-- Date: 2025-10-11
-- Description: Creates a table to track which users are currently online using database instead of in-memory storage

-- Create online_users table
CREATE TABLE IF NOT EXISTS online_users (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_online_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_online_users_last_activity ON online_users(last_activity);

-- Add comment to table
COMMENT ON TABLE online_users IS 'Tracks currently online users across all PM2 instances';
COMMENT ON COLUMN online_users.user_id IS 'Reference to the user who is online';
COMMENT ON COLUMN online_users.connected_at IS 'When the user first connected in this session';
COMMENT ON COLUMN online_users.last_activity IS 'Last time the user had any activity (updated periodically)';

