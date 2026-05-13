-- 1. Fix handle_new_user (auth trigger)
ALTER FUNCTION public.handle_new_user() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

-- 2. Fix admin_list_profiles (admin function)
ALTER FUNCTION public.admin_list_profiles() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM public, anon, authenticated;

-- 3. Fix update_account_balance_on_transaction (trigger)
ALTER FUNCTION public.update_account_balance_on_transaction() SET search_path = public;

-- 4. Fix generate_license_key
ALTER FUNCTION public.generate_license_key() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.generate_license_key() FROM public, anon;

-- 5. Fix has_role with correct signature
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
-- Keep EXECUTE for authenticated if it's used in RLS, but set search_path
