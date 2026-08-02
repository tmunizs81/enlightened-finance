-- REFORÇO DE SEGURANÇA E ISOLAMENTO MULTI-TENANT
-- Garante RLS ativo e políticas restritas em todas as tabelas principais

-- 1. PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 2. TRANSACTIONS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
CREATE POLICY "Users can manage their own transactions" ON public.transactions
FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 3. PENDING_OCR_TRANSACTIONS
ALTER TABLE public.pending_ocr_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own pending transactions" ON public.pending_ocr_transactions;
CREATE POLICY "Users can manage their own pending transactions" ON public.pending_ocr_transactions
FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 4. ACCOUNTS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own accounts" ON public.accounts;
CREATE POLICY "Users can manage their own accounts" ON public.accounts
FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 5. CATEGORIES
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own categories" ON public.categories;
CREATE POLICY "Users can manage their own categories" ON public.categories
FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 6. GRANT DATA ACCESS (Indispensável no Supabase)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_ocr_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;

GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.transactions TO service_role;
GRANT ALL ON public.pending_ocr_transactions TO service_role;
GRANT ALL ON public.accounts TO service_role;
GRANT ALL ON public.categories TO service_role;
