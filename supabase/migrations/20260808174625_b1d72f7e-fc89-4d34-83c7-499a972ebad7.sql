ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deepseek_api_key TEXT;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;