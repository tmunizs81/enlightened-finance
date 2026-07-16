-- Commercial fields on licenses
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS price_brl numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.licenses
  DROP CONSTRAINT IF EXISTS licenses_plan_type_check;
ALTER TABLE public.licenses
  ADD CONSTRAINT licenses_plan_type_check CHECK (plan_type IN ('monthly','yearly','lifetime'));

CREATE INDEX IF NOT EXISTS idx_licenses_user_status ON public.licenses(user_id, status);

-- Audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  target_email text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can read audit log"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON public.admin_audit_log(actor_id);