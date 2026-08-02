ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;