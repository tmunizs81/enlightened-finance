CREATE TABLE IF NOT EXISTS public.telegram_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  description TEXT NOT NULL DEFAULT 'Lançamento Telegram',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_drafts TO authenticated;
GRANT ALL ON public.telegram_drafts TO service_role;

ALTER TABLE public.telegram_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on telegram_drafts" ON public.telegram_drafts;
CREATE POLICY "Service role full access on telegram_drafts"
ON public.telegram_drafts FOR ALL
TO service_role
USING (true) WITH CHECK (true);
