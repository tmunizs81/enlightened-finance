
CREATE TABLE public.pending_ocr_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chat_id text NOT NULL,
  amount numeric NOT NULL,
  description text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid REFERENCES public.categories(id),
  account_id uuid REFERENCES public.accounts(id),
  confidence text DEFAULT 'medium',
  receipt_url text,
  receipt_path text,
  status text NOT NULL DEFAULT 'pending',
  edit_field text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_ocr_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages pending OCR"
ON public.pending_ocr_transactions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
