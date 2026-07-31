-- 1) plano família permitido
ALTER TABLE public.licenses DROP CONSTRAINT IF EXISTS licenses_plan_type_check;
ALTER TABLE public.licenses ADD CONSTRAINT licenses_plan_type_check
  CHECK (plan_type = ANY (ARRAY['monthly','yearly','lifetime','family']));

-- 2) licenças avulsas (sem usuário vinculado)
ALTER TABLE public.licenses ALTER COLUMN user_id DROP NOT NULL;

-- 3) admin pode criar usuários mesmo com cadastros públicos desativados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _signups_enabled boolean;
  _by_admin boolean;
BEGIN
  _by_admin := COALESCE((NEW.raw_user_meta_data->>'created_by_admin')::boolean, false);

  IF NOT _by_admin THEN
    SELECT signups_enabled INTO _signups_enabled
    FROM public.app_settings
    WHERE id = true;

    IF _signups_enabled IS NOT NULL AND _signups_enabled = false THEN
      RAISE EXCEPTION 'SIGNUPS_DISABLED: Novos cadastros estão temporariamente desabilitados pelo administrador.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, trial_ends_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    now() + INTERVAL '7 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;