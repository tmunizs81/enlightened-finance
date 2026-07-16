
-- 1) profiles.trial_ends_at
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Backfill trial for existing profiles that have no license yet
UPDATE public.profiles p
SET trial_ends_at = COALESCE(p.trial_ends_at, p.created_at + INTERVAL '7 days')
WHERE p.trial_ends_at IS NULL;

-- Update handle_new_user to also set trial_ends_at
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, trial_ends_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    now() + INTERVAL '7 days'
  );
  RETURN NEW;
END;
$function$;

-- 2) licenses extra columns for Asaas
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS next_charge_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_status TEXT,
  ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_licenses_asaas_sub ON public.licenses(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_licenses_asaas_cus ON public.licenses(asaas_customer_id);

-- 3) payment_events (audit log)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'asaas',
  event_type TEXT NOT NULL,
  payment_id TEXT,
  subscription_id TEXT,
  customer_id TEXT,
  user_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all payment events"
ON public.payment_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read their own payment events"
ON public.payment_events FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_payment_events_sub ON public.payment_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_user ON public.payment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON public.payment_events(created_at DESC);
