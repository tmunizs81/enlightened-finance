CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _signups_enabled boolean;
BEGIN
  SELECT signups_enabled INTO _signups_enabled
  FROM public.app_settings
  WHERE id = true;

  IF _signups_enabled IS NOT NULL AND _signups_enabled = false THEN
    RAISE EXCEPTION 'SIGNUPS_DISABLED: Novos cadastros estão temporariamente desabilitados pelo administrador.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.profiles (user_id, display_name, trial_ends_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    now() + INTERVAL '7 days'
  );
  RETURN NEW;
END;
$function$;