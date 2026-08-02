ALTER TABLE public.telegram_drafts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
GRANT ALL ON public.telegram_drafts TO service_role;
GRANT ALL ON public.telegram_drafts TO authenticated;
GRANT ALL ON public.telegram_drafts TO anon;
DROP POLICY IF EXISTS "Service role full access on telegram_drafts" ON public.telegram_drafts;
CREATE POLICY "Service role full access on telegram_drafts"
ON public.telegram_drafts FOR ALL
TO service_role
USING (true) WITH CHECK (true);
