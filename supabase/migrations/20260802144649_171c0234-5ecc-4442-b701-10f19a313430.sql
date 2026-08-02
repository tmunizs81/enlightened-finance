-- Migration: telegram-linking-self-service
-- Adds telegram_link_code to profiles table and ensures telegram_chat_id uniqueness.

-- 1. Add telegram_link_code to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_link_code text UNIQUE;
COMMENT ON COLUMN public.profiles.telegram_link_code IS 'Unique code for linking Telegram account via Deep Link';

-- 2. Add unique constraint to telegram_chat_id if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_telegram_chat_id_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_telegram_chat_id_key UNIQUE (telegram_chat_id);
    END IF;
END $$;

-- 3. Update Grants (already present, but good practice for migration transparency)
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO service_role;
