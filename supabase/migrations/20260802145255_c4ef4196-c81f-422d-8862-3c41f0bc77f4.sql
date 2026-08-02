-- Migration: add-type-to-pending-ocr
-- Adds type column (expense/income) to pending_ocr_transactions

ALTER TABLE public.pending_ocr_transactions ADD COLUMN IF NOT EXISTS type text DEFAULT 'expense';
COMMENT ON COLUMN public.pending_ocr_transactions.type IS 'Transaction type (expense or income)';
