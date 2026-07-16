
-- =========================================================================
-- MODO FAMÍLIA — SimplyFin
-- =========================================================================

-- 1. Enum de papéis
DO $$ BEGIN
  CREATE TYPE public.family_role AS ENUM ('owner','admin','member','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabela families
CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_id UUID REFERENCES public.licenses(id) ON DELETE SET NULL,
  max_seats INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- 3. family_members
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.family_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON public.family_members(family_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- 4. family_invites
CREATE TABLE IF NOT EXISTS public.family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  role public.family_role NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_family_invites_email ON public.family_invites(lower(email));
CREATE INDEX IF NOT EXISTS idx_family_invites_family ON public.family_invites(family_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_invites TO authenticated;
GRANT ALL ON public.family_invites TO service_role;
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

-- 5. Funções auxiliares
CREATE OR REPLACE FUNCTION public.get_user_family(_uid UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT family_id FROM public.family_members WHERE user_id = _uid LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_family_role(_uid UUID)
RETURNS public.family_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT role FROM public.family_members WHERE user_id = _uid LIMIT 1
$$;

-- Retorna nível numérico: viewer=1, member=2, admin=3, owner=4
CREATE OR REPLACE FUNCTION public.family_role_level(_r public.family_role)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _r
    WHEN 'viewer' THEN 1
    WHEN 'member' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'owner' THEN 4
    ELSE 0 END
$$;

-- Verifica se o registro pode ser visto/gerenciado pelo usuário via família
CREATE OR REPLACE FUNCTION public.can_read_family(_uid UUID, _fid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _fid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _uid AND family_id = _fid
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_family(_uid UUID, _fid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _fid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _uid AND family_id = _fid
      AND public.family_role_level(role) >= 2
  )
$$;

-- Licença ativa considerando família (owner tem, membros herdam)
CREATE OR REPLACE FUNCTION public.has_active_family_license(_uid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm
    JOIN public.families f ON f.id = fm.family_id
    JOIN public.licenses l ON l.user_id = f.owner_id
    WHERE fm.user_id = _uid
      AND l.status = 'active'
      AND l.expires_at > now()
      AND l.plan_type = 'family'
  )
$$;

-- 6. Trigger genérico que preenche family_id automaticamente
CREATE OR REPLACE FUNCTION public.auto_fill_family_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  fid UUID;
BEGIN
  IF NEW.family_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT family_id INTO fid FROM public.family_members WHERE user_id = NEW.user_id LIMIT 1;
    IF fid IS NOT NULL THEN
      NEW.family_id := fid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Adicionar family_id + index + trigger em cada tabela de dados
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'accounts','transactions','budgets','goals','categories','tags',
    'recurring_transactions','financial_rules','ai_insights',
    'pending_ocr_transactions','achievements','streaks','weekly_challenges'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE SET NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_family ON public.%I(family_id) WHERE family_id IS NOT NULL', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_autofamily ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_autofamily BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auto_fill_family_id()', t, t);
  END LOOP;
END $$;

-- 8. RLS das tabelas de família
DROP POLICY IF EXISTS "Users view own families" ON public.families;
CREATE POLICY "Users view own families" ON public.families
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.can_read_family(auth.uid(), id));

DROP POLICY IF EXISTS "Users create families" ON public.families;
CREATE POLICY "Users create families" ON public.families
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner updates family" ON public.families;
CREATE POLICY "Owner updates family" ON public.families
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owner deletes family" ON public.families;
CREATE POLICY "Owner deletes family" ON public.families
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Members view family members" ON public.family_members;
CREATE POLICY "Members view family members" ON public.family_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));

-- family_members: escrita apenas via edge function (service role)
-- (nenhuma policy de insert/update/delete para authenticated)

DROP POLICY IF EXISTS "Invitees see own invites" ON public.family_invites;
CREATE POLICY "Invitees see own invites" ON public.family_invites
  FOR SELECT TO authenticated
  USING (
    lower(email) = lower(coalesce((auth.jwt()->>'email'),''))
    OR public.can_read_family(auth.uid(), family_id)
  );
-- invites: escrita via edge function (service role)

-- 9. Reescrever RLS das tabelas de dados com escopo familiar
-- ------ accounts
DROP POLICY IF EXISTS "Users manage own accounts" ON public.accounts;
CREATE POLICY "accounts_select" ON public.accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));
CREATE POLICY "accounts_insert" ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "accounts_update" ON public.accounts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id))
  WITH CHECK (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));
CREATE POLICY "accounts_delete" ON public.accounts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));

-- ------ transactions (drop TODAS as policies antigas incluindo duplicatas)
DROP POLICY IF EXISTS "Users manage own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));
CREATE POLICY "transactions_insert" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (receipt_url IS NULL OR date >= (date_trunc('month'::text, now()))::date)
  );
CREATE POLICY "transactions_update" ON public.transactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id))
  WITH CHECK (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));
CREATE POLICY "transactions_delete" ON public.transactions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));

-- ------ helper para tabelas simples (user_id + family_id)
-- budgets
DROP POLICY IF EXISTS "Users manage own budgets" ON public.budgets;
CREATE POLICY "budgets_select" ON public.budgets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));
CREATE POLICY "budgets_insert" ON public.budgets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "budgets_update" ON public.budgets FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id))
  WITH CHECK (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));
CREATE POLICY "budgets_delete" ON public.budgets FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));

-- goals
DROP POLICY IF EXISTS "Users manage own goals" ON public.goals;
CREATE POLICY "goals_select" ON public.goals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));
CREATE POLICY "goals_insert" ON public.goals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "goals_update" ON public.goals FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id))
  WITH CHECK (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));
CREATE POLICY "goals_delete" ON public.goals FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));

-- categories
DROP POLICY IF EXISTS "Users manage own categories" ON public.categories;
CREATE POLICY "categories_select" ON public.categories FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));
CREATE POLICY "categories_insert" ON public.categories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "categories_update" ON public.categories FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id))
  WITH CHECK (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));
CREATE POLICY "categories_delete" ON public.categories FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));

-- tags
DROP POLICY IF EXISTS "Users manage own tags" ON public.tags;
CREATE POLICY "tags_select" ON public.tags FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));
CREATE POLICY "tags_insert" ON public.tags FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tags_update" ON public.tags FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id))
  WITH CHECK (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));
CREATE POLICY "tags_delete" ON public.tags FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));

-- recurring_transactions
DROP POLICY IF EXISTS "Users manage own recurring transactions" ON public.recurring_transactions;
CREATE POLICY "recurring_select" ON public.recurring_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));
CREATE POLICY "recurring_insert" ON public.recurring_transactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "recurring_update" ON public.recurring_transactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id))
  WITH CHECK (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));
CREATE POLICY "recurring_delete" ON public.recurring_transactions FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));

-- financial_rules
DROP POLICY IF EXISTS "Users manage own rules" ON public.financial_rules;
CREATE POLICY "rules_select" ON public.financial_rules FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));
CREATE POLICY "rules_insert" ON public.financial_rules FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "rules_update" ON public.financial_rules FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id))
  WITH CHECK (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));
CREATE POLICY "rules_delete" ON public.financial_rules FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));

-- ai_insights
DROP POLICY IF EXISTS "Users manage own insights" ON public.ai_insights;
CREATE POLICY "insights_select" ON public.ai_insights FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));
CREATE POLICY "insights_insert" ON public.ai_insights FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "insights_update" ON public.ai_insights FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id))
  WITH CHECK (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));
CREATE POLICY "insights_delete" ON public.ai_insights FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_write_family(auth.uid(), family_id));

-- achievements
DROP POLICY IF EXISTS "Users manage own achievements" ON public.achievements;
CREATE POLICY "achievements_select" ON public.achievements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));
CREATE POLICY "achievements_insert" ON public.achievements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "achievements_update" ON public.achievements FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "achievements_delete" ON public.achievements FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- streaks
DROP POLICY IF EXISTS "Users manage own streaks" ON public.streaks;
CREATE POLICY "streaks_select" ON public.streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));
CREATE POLICY "streaks_insert" ON public.streaks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "streaks_update" ON public.streaks FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "streaks_delete" ON public.streaks FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- weekly_challenges
DROP POLICY IF EXISTS "Users manage own challenges" ON public.weekly_challenges;
CREATE POLICY "challenges_select" ON public.weekly_challenges FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_family(auth.uid(), family_id));
CREATE POLICY "challenges_insert" ON public.weekly_challenges FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "challenges_update" ON public.weekly_challenges FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "challenges_delete" ON public.weekly_challenges FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- transaction_splits / transaction_tags (herdam via transactions)
DROP POLICY IF EXISTS "Users manage own transaction splits" ON public.transaction_splits;
CREATE POLICY "splits_all" ON public.transaction_splits FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_splits.transaction_id
      AND (t.user_id = auth.uid() OR public.can_read_family(auth.uid(), t.family_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_splits.transaction_id
      AND (t.user_id = auth.uid() OR public.can_write_family(auth.uid(), t.family_id))
  ));

DROP POLICY IF EXISTS "Users manage own transaction tags" ON public.transaction_tags;
CREATE POLICY "txtags_all" ON public.transaction_tags FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_tags.transaction_id
      AND (t.user_id = auth.uid() OR public.can_read_family(auth.uid(), t.family_id))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_tags.transaction_id
      AND (t.user_id = auth.uid() OR public.can_write_family(auth.uid(), t.family_id))
  ));

-- 10. Licenças: coluna max_seats
ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS max_seats INT NOT NULL DEFAULT 1;

-- 11. Trigger updated_at em families
DROP TRIGGER IF EXISTS trg_families_updated ON public.families;
CREATE TRIGGER trg_families_updated
  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
