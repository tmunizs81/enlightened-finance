
-- Step 1: Migration for profiles and RLS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'telegram_chat_id') THEN
        ALTER TABLE public.profiles ADD COLUMN telegram_chat_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'telegram_bot_token') THEN
        ALTER TABLE public.profiles ADD COLUMN telegram_bot_token TEXT;
    END IF;
END $$;

-- Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy for users to update their own telegram info
DROP POLICY IF EXISTS "Allow user update telegram info" ON public.profiles;
CREATE POLICY "Allow user update telegram info" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Ensure authenticated users can select their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Step 2: Grant permissions for transactions (for service role usage in edge function)
GRANT ALL ON public.transactions TO service_role;
GRANT ALL ON public.profiles TO service_role;
