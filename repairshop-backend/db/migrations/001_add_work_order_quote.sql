-- Adds quote, warranty, and payment fields to work_orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS is_warranty boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS labor_hours numeric(6,2),
  ADD COLUMN IF NOT EXISTS labor_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS quote_subtotal_parts numeric(12,2),
  ADD COLUMN IF NOT EXISTS quote_total numeric(12,2),
  ADD COLUMN IF NOT EXISTS approval_status text, -- pending/approved/declined
  ADD COLUMN IF NOT EXISTS approval_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS troubleshooting_fee numeric(12,2),
  ADD COLUMN IF NOT EXISTS paid_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS total_cost numeric(12,2);

-- Optional: extend status domain by documentation (enforced by app layer)
-- Existing analytics reference total_cost; this ensures column exists.

