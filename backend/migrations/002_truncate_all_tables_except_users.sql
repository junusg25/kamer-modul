-- Migration: Truncate all tables except users and reset sequences
-- Date: 2025-10-11
-- Description: Removes all data from tables (except users) and resets auto-increment IDs

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- ========================================
-- TRUNCATE TABLES (Keep users table)
-- ========================================

-- Customer Portal
TRUNCATE TABLE online_users CASCADE;

-- Customers and Machines
TRUNCATE TABLE assigned_machines CASCADE;
TRUNCATE TABLE machine_serials CASCADE;
TRUNCATE TABLE machine_models CASCADE;
TRUNCATE TABLE machine_categories CASCADE;
TRUNCATE TABLE customers CASCADE;

-- Repair Tickets and Work Orders
TRUNCATE TABLE repair_ticket_notes CASCADE;
TRUNCATE TABLE repair_tickets CASCADE;
TRUNCATE TABLE warranty_repair_ticket_notes CASCADE;
TRUNCATE TABLE warranty_repair_tickets CASCADE;

TRUNCATE TABLE work_order_notes CASCADE;
TRUNCATE TABLE work_order_inventory CASCADE;
TRUNCATE TABLE work_orders CASCADE;

TRUNCATE TABLE warranty_work_order_notes CASCADE;
TRUNCATE TABLE warranty_work_order_inventory CASCADE;
TRUNCATE TABLE warranty_work_orders CASCADE;

-- Quotes
TRUNCATE TABLE quote_items CASCADE;
TRUNCATE TABLE quotes CASCADE;

-- Inventory
TRUNCATE TABLE inventory_adjustments CASCADE;
TRUNCATE TABLE inventory CASCADE;

-- Sales
TRUNCATE TABLE sales_targets CASCADE;
TRUNCATE TABLE sales_opportunities CASCADE;
TRUNCATE TABLE leads CASCADE;

-- Rentals
TRUNCATE TABLE rental_transactions CASCADE;
TRUNCATE TABLE rentals CASCADE;
TRUNCATE TABLE rental_fleet CASCADE;
TRUNCATE TABLE rental_pricing_rules CASCADE;

-- Notifications and Activity
TRUNCATE TABLE notifications CASCADE;
TRUNCATE TABLE activity_logs CASCADE;
TRUNCATE TABLE user_activity_logs CASCADE;

-- Feedback and Settings
TRUNCATE TABLE feedback CASCADE;
TRUNCATE TABLE user_table_preferences CASCADE;

-- Permissions (Keep user_permissions for existing users)
-- TRUNCATE TABLE user_permissions CASCADE;  -- Commented out to keep permissions
TRUNCATE TABLE user_permissions_audit CASCADE;

-- Yearly Sequences (IMPORTANT: This controls formatted numbers like TK-01/25)
TRUNCATE TABLE yearly_sequences CASCADE;

-- ========================================
-- RESET SEQUENCES (Auto-increment IDs)
-- ========================================

-- Customers and Machines
ALTER SEQUENCE customers_id_seq RESTART WITH 1;
ALTER SEQUENCE machine_categories_id_seq RESTART WITH 1;
ALTER SEQUENCE machine_models_id_seq RESTART WITH 1;
ALTER SEQUENCE machine_serials_id_seq RESTART WITH 1;
ALTER SEQUENCE assigned_machines_id_seq RESTART WITH 1;

-- Repair Tickets
ALTER SEQUENCE repair_tickets_id_seq RESTART WITH 1;
ALTER SEQUENCE repair_ticket_notes_id_seq RESTART WITH 1;
ALTER SEQUENCE warranty_repair_tickets_id_seq RESTART WITH 1;
ALTER SEQUENCE warranty_repair_ticket_notes_id_seq RESTART WITH 1;

-- Work Orders
ALTER SEQUENCE work_orders_id_seq RESTART WITH 1;
ALTER SEQUENCE work_order_notes_id_seq RESTART WITH 1;
ALTER SEQUENCE work_order_inventory_id_seq RESTART WITH 1;
ALTER SEQUENCE warranty_work_orders_id_seq RESTART WITH 1;
ALTER SEQUENCE warranty_work_order_notes_id_seq RESTART WITH 1;
ALTER SEQUENCE warranty_work_order_inventory_id_seq RESTART WITH 1;

-- Quotes
ALTER SEQUENCE quotes_id_seq RESTART WITH 1;
ALTER SEQUENCE quote_items_id_seq RESTART WITH 1;

-- Inventory
ALTER SEQUENCE inventory_id_seq RESTART WITH 1;
ALTER SEQUENCE inventory_adjustments_id_seq RESTART WITH 1;

-- Sales
ALTER SEQUENCE leads_id_seq RESTART WITH 1;
ALTER SEQUENCE sales_opportunities_id_seq RESTART WITH 1;
ALTER SEQUENCE sales_targets_id_seq RESTART WITH 1;

-- Rentals
ALTER SEQUENCE rental_fleet_id_seq RESTART WITH 1;
ALTER SEQUENCE rentals_id_seq RESTART WITH 1;
ALTER SEQUENCE rental_transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE rental_pricing_rules_id_seq RESTART WITH 1;

-- Notifications and Activity
ALTER SEQUENCE notifications_id_seq RESTART WITH 1;
ALTER SEQUENCE activity_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE user_activity_logs_id_seq RESTART WITH 1;

-- Feedback and Settings
ALTER SEQUENCE feedback_id_seq RESTART WITH 1;
ALTER SEQUENCE user_table_preferences_id_seq RESTART WITH 1;

-- Permissions
ALTER SEQUENCE user_permissions_audit_id_seq RESTART WITH 1;

-- Yearly Sequences
ALTER SEQUENCE yearly_sequences_id_seq RESTART WITH 1;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Show count of records in all tables (should be 0 except users)
DO $$
DECLARE
    r RECORD;
    v_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TABLE COUNTS AFTER TRUNCATE';
    RAISE NOTICE '========================================';
    
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        ORDER BY tablename
    ) LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO v_count;
        RAISE NOTICE '% : % records', RPAD(r.tablename, 40, ' '), v_count;
    END LOOP;
    
    RAISE NOTICE '========================================';
END $$;

-- Success message
SELECT 'Database reset complete! All data deleted except users table.' AS message;

