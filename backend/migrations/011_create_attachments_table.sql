-- Migration: Create attachments table for file management across all entity types
-- This table will store attachments for repair tickets, warranty repair tickets, work orders, and warranty work orders

CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('repair_ticket', 'warranty_repair_ticket', 'work_order', 'warranty_work_order')),
  entity_id INTEGER NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  description TEXT,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_at ON attachments(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_attachments_active ON attachments(is_active);

-- Create unique constraint to prevent duplicate file names per entity
CREATE UNIQUE INDEX IF NOT EXISTS idx_attachments_unique_file ON attachments(entity_type, entity_id, file_name) WHERE is_active = TRUE;

-- Add comments for documentation
COMMENT ON TABLE attachments IS 'Stores file attachments for repair tickets, warranty repair tickets, work orders, and warranty work orders';
COMMENT ON COLUMN attachments.entity_type IS 'Type of entity: repair_ticket, warranty_repair_ticket, work_order, warranty_work_order';
COMMENT ON COLUMN attachments.entity_id IS 'ID of the entity this attachment belongs to';
COMMENT ON COLUMN attachments.file_name IS 'Generated file name (e.g., tk_01_25.png)';
COMMENT ON COLUMN attachments.original_name IS 'Original filename when uploaded';
COMMENT ON COLUMN attachments.file_path IS 'Full path to the stored file';
COMMENT ON COLUMN attachments.file_type IS 'MIME type of the file';
COMMENT ON COLUMN attachments.file_size IS 'File size in bytes';
COMMENT ON COLUMN attachments.version IS 'Version number for file versioning';
COMMENT ON COLUMN attachments.is_active IS 'Whether this attachment is active (for soft deletes)';
