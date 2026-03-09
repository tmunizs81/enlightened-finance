
-- Weekly challenges table
CREATE TABLE public.weekly_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'spending_reduction',
  target_category_id UUID REFERENCES public.categories(id),
  target_amount NUMERIC,
  target_percent NUMERIC,
  current_progress NUMERIC NOT NULL DEFAULT 0,
  xp_reward INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'active',
  week_start DATE NOT NULL DEFAULT CURRENT_DATE,
  week_end DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own challenges" ON public.weekly_challenges
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
