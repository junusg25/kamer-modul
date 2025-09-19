-- Migration: Update rental status constraints to include 'reserved'
-- This allows machine rentals to have 'reserved' status for future bookings

-- Update machine_rentals table constraint
ALTER TABLE public.machine_rentals 
DROP CONSTRAINT IF EXISTS machine_rentals_rental_status_check;

ALTER TABLE public.machine_rentals
ADD CONSTRAINT machine_rentals_rental_status_check
CHECK (rental_status IN ('active', 'reserved', 'returned', 'overdue', 'cancelled'));

-- Update rental_machines table constraint  
ALTER TABLE public.rental_machines 
DROP CONSTRAINT IF EXISTS rental_machines_rental_status_check;

ALTER TABLE public.rental_machines
ADD CONSTRAINT rental_machines_rental_status_check
CHECK (rental_status IN ('available', 'rented', 'reserved', 'maintenance', 'retired'));
