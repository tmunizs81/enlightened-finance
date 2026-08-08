-- Chave de IA universal (usada como fallback quando o usuário não cadastrou a
-- própria chave em Configurações). Este projeto roda em uma plataforma que não
-- expõe os Secrets de Edge Functions para o dono do app, então guardamos o
-- fallback aqui em vez de em Deno.env. Tabela travada: nenhuma policy de RLS é
-- criada para anon/authenticated, então só o service_role (usado pelas Edge
-- Functions) consegue ler ou escrever.
CREATE TABLE IF NOT EXISTS public.platform_secrets (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  gemini_api_key TEXT,
  groq_api_key TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_secrets_singleton CHECK (id = true)
);

ALTER TABLE public.platform_secrets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_secrets FROM anon, authenticated;
GRANT ALL ON public.platform_secrets TO service_role;

INSERT INTO public.platform_secrets (id, gemini_api_key)
VALUES (true, 'AIzaSyBIjoNTgS_4kzRrbs8Qw7zYfeX7T7gtbqY')
ON CONFLICT (id) DO UPDATE SET gemini_api_key = EXCLUDED.gemini_api_key, updated_at = now();
