
-- Tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tags" ON public.tags
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Junction table: transaction <-> tags
CREATE TABLE public.transaction_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(transaction_id, tag_id)
);

ALTER TABLE public.transaction_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own transaction tags" ON public.transaction_tags
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
  );

-- Transaction splits table
CREATE TABLE public.transaction_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own transaction splits" ON public.transaction_splits
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
  );
