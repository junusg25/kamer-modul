-- Separate ticket numbering from work orders
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1000;

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS ticket_number integer UNIQUE;


