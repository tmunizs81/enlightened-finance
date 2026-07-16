
-- app_settings singleton
CREATE TABLE public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  active_payment_gateway TEXT NOT NULL DEFAULT 'asaas' CHECK (active_payment_gateway IN ('asaas','stripe')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT app_settings_singleton CHECK (id = true)
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (id, active_payment_gateway) VALUES (true, 'asaas')
  ON CONFLICT (id) DO NOTHING;

-- Stripe columns on licenses
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_licenses_stripe_sub ON public.licenses(stripe_subscription_id);
