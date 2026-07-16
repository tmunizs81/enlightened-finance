REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_license_key() FROM authenticated;