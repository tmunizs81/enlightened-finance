
-- Ensure profiles has the necessary telegram columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'telegram_chat_id') THEN
        ALTER TABLE public.profiles ADD COLUMN telegram_chat_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'telegram_bot_token') THEN
        ALTER TABLE public.profiles ADD COLUMN telegram_bot_token TEXT;
    END IF;
END $$;

-- Fix RLS Policy for Profiles (Telegram metadata update)
DROP POLICY IF EXISTS "Users can update their own profile telegram info" ON public.profiles;
CREATE POLICY "Users can update their own profile telegram info"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure service role has access
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
