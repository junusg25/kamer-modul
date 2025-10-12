-- Migration: Reset repair tickets and warranty repair tickets tables
-- This clears all repair and warranty ticket data and resets sequences

-- Disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Truncate repair tickets and all related data (CASCADE)
TRUNCATE TABLE repair_tickets CASCADE;

-- Truncate warranty repair tickets and all related data (CASCADE)
TRUNCATE TABLE warranty_repair_tickets CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Reset the sequence for repair_tickets
ALTER SEQUENCE repair_tickets_id_seq RESTART WITH 1;

-- Reset the sequence for warranty_repair_tickets
ALTER SEQUENCE warranty_repair_tickets_id_seq RESTART WITH 1;

-- Delete sequences from yearly_sequences table for TK and WT prefixes
DELETE FROM yearly_sequences WHERE prefix IN ('TK', 'WT');

-- Verify the reset
SELECT 
    (SELECT COUNT(*) FROM repair_tickets) as repair_tickets_count,
    (SELECT COUNT(*) FROM warranty_repair_tickets) as warranty_repair_tickets_count,
    (SELECT COUNT(*) FROM yearly_sequences WHERE prefix = 'TK') as tk_sequence_count,
    (SELECT COUNT(*) FROM yearly_sequences WHERE prefix = 'WT') as wt_sequence_count;

-- Show message
SELECT 'Repair tickets and warranty repair tickets have been reset. Next tickets will be TK-01/25 and WT-01/25' as status;

