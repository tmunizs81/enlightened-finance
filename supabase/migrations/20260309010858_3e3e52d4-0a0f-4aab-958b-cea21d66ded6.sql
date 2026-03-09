-- Criar tabela de licenças
CREATE TABLE public.licenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  license_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca rápida por user_id
CREATE INDEX idx_licenses_user_id ON public.licenses(user_id);

-- Índice para busca por license_key
CREATE INDEX idx_licenses_key ON public.licenses(license_key);

-- Enable Row Level Security
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- Admins podem ver e gerenciar todas as licenças
CREATE POLICY "Admins can view all licenses" 
ON public.licenses 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert licenses" 
ON public.licenses 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update licenses" 
ON public.licenses 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete licenses" 
ON public.licenses 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));

-- Usuários podem ver apenas suas próprias licenças
CREATE POLICY "Users can view own license" 
ON public.licenses 
FOR SELECT 
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_licenses_updated_at
BEFORE UPDATE ON public.licenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para gerar license key única
CREATE OR REPLACE FUNCTION public.generate_license_key()
RETURNS TEXT
LANGUAGE plpgsql
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