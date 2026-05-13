-- Final execution restriction for SECURITY DEFINER functions flagged by the linter
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;

-- Ensure all public schema SECURITY DEFINER functions are truly isolated
REVOKE EXECUTE ON FUNCTION public.update_account_balance_on_transaction() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_license_key() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
