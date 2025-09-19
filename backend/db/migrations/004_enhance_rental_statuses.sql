-- Migration: Enhance rental machine statuses with granular status management
-- This adds new statuses for better machine lifecycle tracking

-- Update rental_machines table status constraint to include new statuses
ALTER TABLE public.rental_machines
DROP CONSTRAINT IF EXISTS rental_machines_rental_status_check;

ALTER TABLE public.rental_machines
ADD CONSTRAINT rental_machines_rental_status_check
CHECK (rental_status IN ('available', 'rented', 'reserved', 'cleaning', 'inspection', 'maintenance', 'repair', 'quarantine', 'retired'));

-- Add status transition tracking table
CREATE TABLE IF NOT EXISTS public.rental_machine_status_history (
    id SERIAL PRIMARY KEY,
    rental_machine_id INTEGER NOT NULL REFERENCES public.rental_machines(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    reason TEXT,
    changed_by INTEGER REFERENCES public.users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Create indexes for status history
CREATE INDEX IF NOT EXISTS idx_rental_machine_status_history_machine_id ON public.rental_machine_status_history(rental_machine_id);
CREATE INDEX IF NOT EXISTS idx_rental_machine_status_history_changed_at ON public.rental_machine_status_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_rental_machine_status_history_new_status ON public.rental_machine_status_history(new_status);

-- Add status transition rules table
CREATE TABLE IF NOT EXISTS public.rental_status_transition_rules (
    id SERIAL PRIMARY KEY,
    from_status VARCHAR(20) NOT NULL,
    to_status VARCHAR(20) NOT NULL,
    requires_approval BOOLEAN DEFAULT FALSE,
    auto_transition_after_hours INTEGER, -- NULL means manual transition only
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default transition rules
INSERT INTO public.rental_status_transition_rules (from_status, to_status, requires_approval, auto_transition_after_hours, description) VALUES
-- Normal rental flow
('available', 'rented', FALSE, NULL, 'Machine rented to customer'),
('rented', 'cleaning', FALSE, NULL, 'Machine returned and needs cleaning'),
('cleaning', 'inspection', FALSE, 2, 'Auto-transition to inspection after 2 hours'),
('inspection', 'available', FALSE, 1, 'Auto-transition to available after 1 hour'),
('inspection', 'repair', TRUE, NULL, 'Issues found during inspection'),
('inspection', 'quarantine', TRUE, NULL, 'Safety issues found during inspection'),

-- Maintenance flow
('available', 'maintenance', TRUE, NULL, 'Scheduled maintenance'),
('maintenance', 'inspection', FALSE, NULL, 'Maintenance completed, needs inspection'),
('maintenance', 'repair', TRUE, NULL, 'Maintenance revealed repair needs'),

-- Repair flow
('repair', 'inspection', FALSE, NULL, 'Repair completed, needs inspection'),
('repair', 'quarantine', TRUE, NULL, 'Repair failed or safety concerns'),

-- Quarantine flow
('quarantine', 'repair', TRUE, NULL, 'Issues resolved, needs repair'),
('quarantine', 'inspection', TRUE, NULL, 'Issues resolved, needs inspection'),
('quarantine', 'retired', TRUE, NULL, 'Machine deemed unsafe for service'),

-- Reserved flow
('available', 'reserved', FALSE, NULL, 'Machine reserved for future rental'),
('reserved', 'rented', FALSE, NULL, 'Reserved rental becomes active'),

-- Retirement flow
('available', 'retired', TRUE, NULL, 'Machine retired from service'),
('maintenance', 'retired', TRUE, NULL, 'Machine retired during maintenance'),
('repair', 'retired', TRUE, NULL, 'Machine retired during repair'),
('quarantine', 'retired', TRUE, NULL, 'Machine retired from quarantine');

-- Add status change trigger function
CREATE OR REPLACE FUNCTION public.track_rental_machine_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track if status actually changed
    IF OLD.rental_status IS DISTINCT FROM NEW.rental_status THEN
        INSERT INTO public.rental_machine_status_history (
            rental_machine_id,
            old_status,
            new_status,
            changed_at
        ) VALUES (
            NEW.id,
            OLD.rental_status,
            NEW.rental_status,
            CURRENT_TIMESTAMP
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status change tracking
DROP TRIGGER IF EXISTS rental_machine_status_change_trigger ON public.rental_machines;
CREATE TRIGGER rental_machine_status_change_trigger
    AFTER UPDATE ON public.rental_machines
    FOR EACH ROW
    EXECUTE FUNCTION public.track_rental_machine_status_change();

-- Add status transition validation function
CREATE OR REPLACE FUNCTION public.validate_status_transition(
    p_machine_id INTEGER,
    p_new_status VARCHAR(20),
    p_user_id INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    current_status VARCHAR(20);
    transition_rule RECORD;
BEGIN
    -- Get current status
    SELECT rental_status INTO current_status
    FROM public.rental_machines
    WHERE id = p_machine_id;
    
    -- Check if transition is allowed
    SELECT * INTO transition_rule
    FROM public.rental_status_transition_rules
    WHERE from_status = current_status AND to_status = p_new_status;
    
    -- If no rule found, transition is not allowed
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- If approval required and no user provided, not allowed
    IF transition_rule.requires_approval AND p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE public.rental_machine_status_history IS 'Tracks all status changes for rental machines with timestamps and reasons';
COMMENT ON TABLE public.rental_status_transition_rules IS 'Defines allowed status transitions and business rules';
COMMENT ON FUNCTION public.validate_status_transition IS 'Validates if a status transition is allowed based on business rules';
