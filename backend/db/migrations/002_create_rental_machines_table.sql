-- Migration: Create rental_machines table and update machine_rentals table
-- This separates rental machines from assigned machines

-- Create rental_machines table
CREATE TABLE IF NOT EXISTS public.rental_machines (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES public.machine_models(id) ON DELETE CASCADE,
    serial_number VARCHAR(255) NOT NULL UNIQUE,
    rental_status VARCHAR(20) DEFAULT 'available' CHECK (rental_status IN ('available', 'rented', 'maintenance', 'retired')),
    condition VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'poor')),
    location VARCHAR(255),
    notes TEXT,
    created_by INTEGER REFERENCES public.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for rental_machines
CREATE INDEX IF NOT EXISTS idx_rental_machines_model_id ON public.rental_machines(model_id);
CREATE INDEX IF NOT EXISTS idx_rental_machines_serial_number ON public.rental_machines(serial_number);
CREATE INDEX IF NOT EXISTS idx_rental_machines_rental_status ON public.rental_machines(rental_status);
CREATE INDEX IF NOT EXISTS idx_rental_machines_condition ON public.rental_machines(condition);
CREATE INDEX IF NOT EXISTS idx_rental_machines_created_by ON public.rental_machines(created_by);

-- Add trigger for updated_at
CREATE TRIGGER set_updated_at_rental_machines
    BEFORE UPDATE ON public.rental_machines
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Update machine_rentals table to reference rental_machines instead of assigned_machines
-- First, drop the existing foreign key constraint
ALTER TABLE public.machine_rentals DROP CONSTRAINT IF EXISTS machine_rentals_assigned_machine_id_fkey;

-- Drop the assigned_machine_id column
ALTER TABLE public.machine_rentals DROP COLUMN IF EXISTS assigned_machine_id;

-- Add rental_machine_id column
ALTER TABLE public.machine_rentals ADD COLUMN IF NOT EXISTS rental_machine_id INTEGER;

-- Add foreign key constraint to rental_machines
ALTER TABLE public.machine_rentals 
ADD CONSTRAINT machine_rentals_rental_machine_id_fkey 
FOREIGN KEY (rental_machine_id) REFERENCES public.rental_machines(id) ON DELETE CASCADE;

-- Create index for the new foreign key
CREATE INDEX IF NOT EXISTS idx_machine_rentals_rental_machine_id ON public.machine_rentals(rental_machine_id);

-- Update rental_status check constraint to include new statuses
ALTER TABLE public.machine_rentals 
DROP CONSTRAINT IF EXISTS machine_rentals_rental_status_check;

ALTER TABLE public.machine_rentals 
ADD CONSTRAINT machine_rentals_rental_status_check 
CHECK (rental_status IN ('active', 'returned', 'overdue', 'cancelled'));

-- Add some sample rental machines for testing
INSERT INTO public.rental_machines (model_id, serial_number, rental_status, condition, location, notes, created_by)
SELECT 
    mm.id,
    'RENT-' || mm.id || '-001' as serial_number,
    'available' as rental_status,
    'good' as condition,
    'Warehouse A' as location,
    'Sample rental machine for testing' as notes,
    (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1) as created_by
FROM public.machine_models mm
LIMIT 3
ON CONFLICT (serial_number) DO NOTHING;
