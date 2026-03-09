-- Corrigir função generate_license_key com search_path seguro
CREATE OR REPLACE FUNCTION public.generate_license_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  key_prefix TEXT := 'T2FIN';
  key_suffix TEXT;
BEGIN
  key_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 20));
  RETURN key_prefix || '-' || 
         SUBSTRING(key_suffix FROM 1 FOR 5) || '-' ||
         SUBSTRING(key_suffix FROM 6 FOR 5) || '-' ||
         SUBSTRING(key_suffix FROM 11 FOR 5) || '-' ||
         SUBSTRING(key_suffix FROM 16 FOR 5);
END;
$$;