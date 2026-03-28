ALTER TABLE public.pending_ocr_transactions
  DROP CONSTRAINT pending_ocr_transactions_account_id_fkey,
  ADD CONSTRAINT pending_ocr_transactions_account_id_fkey
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;