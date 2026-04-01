ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS boleto_url text;
ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS boleto_url text;