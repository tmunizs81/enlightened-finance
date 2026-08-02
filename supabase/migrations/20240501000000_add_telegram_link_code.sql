-- Add telegram_link_code to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_link_code text UNIQUE;

-- Add comment to profiles table
COMMENT ON COLUMN public.profiles.telegram_link_code IS 'Unique code for linking Telegram account via Deep Link';

-- Add unique constraint to telegram_chat_id if not already present
-- (Note: telegram_chat_id was already present in the schema view)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_telegram_chat_id_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_telegram_chat_id_key UNIQUE (telegram_chat_id);
    END IF;
END $$;
