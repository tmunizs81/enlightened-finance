-- 1. Restrict update_account_balance_on_transaction (internal trigger function)
ALTER FUNCTION public.update_account_balance_on_transaction() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.update_account_balance_on_transaction() FROM public, anon, authenticated;

-- 2. Restrict has_role (internal authorization function)
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
-- Revoking from anon as it should only be used in authenticated context or RLS
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;

-- 3. Additional cleanup for common linter-flagged functions if they exist
-- (Checking for names previously seen or common in templates)

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user' AND pronamespace = 'public'::regnamespace) THEN
        ALTER FUNCTION public.handle_new_user() SET search_path = public;
        REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'admin_list_profiles' AND pronamespace = 'public'::regnamespace) THEN
        ALTER FUNCTION public.admin_list_profiles() SET search_path = public;
        REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM public, anon, authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_license_key' AND pronamespace = 'public'::regnamespace) THEN
        ALTER FUNCTION public.generate_license_key() SET search_path = public;
        REVOKE EXECUTE ON FUNCTION public.generate_license_key() FROM public, anon, authenticated;
    END IF;
END $$;
