-- Migration: Enhance quotes system for comprehensive quote management
-- Created: 2025-01-27

-- Add new fields to quotes table
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS declined_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS follow_up_reminder_date DATE,
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS delivery_terms TEXT,
ADD COLUMN IF NOT EXISTS quote_type VARCHAR(50) DEFAULT 'custom', -- 'custom', 'template', 'machine_sale', 'parts', 'service'
ADD COLUMN IF NOT EXISTS template_id INTEGER,
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_quote_id INTEGER;

-- Add new fields to quote_items table
ALTER TABLE quote_items
ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) DEFAULT 'custom', -- 'machine', 'part', 'service', 'custom'
ADD COLUMN IF NOT EXISTS item_reference_id INTEGER, -- References machine_models.id or inventory.id
ADD COLUMN IF NOT EXISTS item_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Update existing quote_items to have item_name from description
UPDATE quote_items SET item_name = LEFT(description, 255) WHERE item_name IS NULL;

-- Update existing quote_items to have total_price calculated
UPDATE quote_items SET total_price = quantity * unit_price WHERE total_price IS NULL;

-- Create quote_templates table
CREATE TABLE IF NOT EXISTS quote_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL, -- 'machine_sale', 'parts_package', 'service', 'custom'
    description TEXT,
    default_valid_days INTEGER DEFAULT 30,
    default_terms_conditions TEXT,
    default_payment_terms TEXT,
    default_delivery_terms TEXT,
    default_discount_percentage DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create quote_template_items table (predefined items for templates)
CREATE TABLE IF NOT EXISTS quote_template_items (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES quote_templates(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- 'machine', 'part', 'service', 'custom'
    item_reference_id INTEGER, -- References machine_models.id or inventory.id
    item_name VARCHAR(255) NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(12,2),
    category VARCHAR(100),
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quotes_sent_at ON quotes(sent_at);
CREATE INDEX IF NOT EXISTS idx_quotes_accepted_at ON quotes(accepted_at);
CREATE INDEX IF NOT EXISTS idx_quotes_follow_up ON quotes(follow_up_reminder_date);
CREATE INDEX IF NOT EXISTS idx_quotes_template_id ON quotes(template_id);
CREATE INDEX IF NOT EXISTS idx_quotes_parent_id ON quotes(parent_quote_id);
CREATE INDEX IF NOT EXISTS idx_quotes_type ON quotes(quote_type);

CREATE INDEX IF NOT EXISTS idx_quote_templates_type ON quote_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_quote_templates_active ON quote_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_quote_templates_created_by ON quote_templates(created_by);

CREATE INDEX IF NOT EXISTS idx_quote_template_items_template ON quote_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_quote_template_items_type ON quote_template_items(item_type);
CREATE INDEX IF NOT EXISTS idx_quote_template_items_reference ON quote_template_items(item_reference_id);

-- Create trigger to update updated_at timestamp for templates
CREATE OR REPLACE FUNCTION update_quote_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_quote_templates_updated_at ON quote_templates;
CREATE TRIGGER update_quote_templates_updated_at
    BEFORE UPDATE ON quote_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_quote_templates_updated_at();

-- Insert default quote templates
INSERT INTO quote_templates (template_name, template_type, description, default_valid_days, default_terms_conditions, default_payment_terms, created_by)
VALUES 
(
    'New Machine Sale',
    'machine_sale',
    'Standard template for selling new machines to customers',
    30,
    '1. Prices are valid for 30 days from quote date
2. Delivery time: 2-4 weeks from order confirmation
3. Installation and training included
4. 12-month manufacturer warranty included
5. Payment required before delivery',
    'Payment terms: 50% deposit, 50% on delivery',
    1
),
(
    'Parts Package',
    'parts_package',
    'Template for selling spare parts and accessories',
    14,
    '1. Prices are valid for 14 days from quote date
2. Parts availability subject to stock
3. Delivery time: 3-5 business days
4. All parts come with 90-day warranty
5. Returns accepted within 14 days if unused',
    'Payment terms: Full payment on order or Net 30 for established customers',
    1
),
(
    'Service & Maintenance',
    'service',
    'Template for service and maintenance contracts',
    30,
    '1. Quote valid for 30 days
2. Service to be scheduled within 2 weeks of acceptance
3. All labor and parts included as specified
4. Additional repairs require separate approval
5. 90-day warranty on all work performed',
    'Payment terms: Payment due upon completion of service',
    1
),
(
    'Custom Quote',
    'custom',
    'Blank template for custom quotes',
    30,
    'Standard terms and conditions apply. Please contact us for any questions.',
    'Payment terms to be discussed',
    1
)
ON CONFLICT DO NOTHING;

-- Add some sample template items for "New Machine Sale" template
INSERT INTO quote_template_items (template_id, item_type, item_name, description, quantity, category, position)
SELECT 
    t.id,
    'service',
    'Delivery & Installation',
    'Professional delivery and on-site installation',
    1,
    'Installation Services',
    0
FROM quote_templates t
WHERE t.template_name = 'New Machine Sale'
ON CONFLICT DO NOTHING;

INSERT INTO quote_template_items (template_id, item_type, item_name, description, quantity, category, position)
SELECT 
    t.id,
    'service',
    'Training Session',
    'Basic operation and maintenance training (2 hours)',
    1,
    'Training Services',
    1
FROM quote_templates t
WHERE t.template_name = 'New Machine Sale'
ON CONFLICT DO NOTHING;

-- Add some sample template items for "Service & Maintenance" template
INSERT INTO quote_template_items (template_id, item_type, item_name, description, quantity, category, position)
SELECT 
    t.id,
    'service',
    'Annual Maintenance',
    'Comprehensive annual maintenance service',
    1,
    'Maintenance Services',
    0
FROM quote_templates t
WHERE t.template_name = 'Service & Maintenance'
ON CONFLICT DO NOTHING;

-- Note: Machine and part items will be added dynamically when creating quotes

