GRANT SELECT ON public.app_settings TO anon;
CREATE POLICY "Anon can read settings" ON public.app_settings FOR SELECT TO anon USING (true);