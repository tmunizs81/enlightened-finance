-- Remover políticas restritivas existentes
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Criar políticas PERMISSIVAS (comportamento padrão correto)
CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Fazer o mesmo para a tabela licenses
DROP POLICY IF EXISTS "Users can view own license" ON public.licenses;
DROP POLICY IF EXISTS "Admins can view all licenses" ON public.licenses;

CREATE POLICY "Users can view own license"
  ON public.licenses
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all licenses"
  ON public.licenses
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));