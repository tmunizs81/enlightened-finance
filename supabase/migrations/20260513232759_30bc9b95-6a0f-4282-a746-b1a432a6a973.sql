-- 1. Clean up existing duplicates before applying constraint
-- Keep the receipt only on the most recently created transaction record (or just pick one)
WITH duplicates AS (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY receipt_url ORDER BY created_at DESC) as rn
    FROM public.transactions
    WHERE receipt_url IS NOT NULL
)
UPDATE public.transactions
SET receipt_url = NULL
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 2. Now apply the unique constraint
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_receipt_url_unique UNIQUE (receipt_url);

-- 3. Trigger function to block reuse and provide a clear error message
CREATE OR REPLACE FUNCTION public.check_receipt_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.receipt_url IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.transactions 
            WHERE receipt_url = NEW.receipt_url 
            AND id != NEW.id
        ) THEN
            RAISE EXCEPTION 'SimpliFin Security: Este comprovante já está vinculado a outra transação e não pode ser reutilizado.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS trigger_check_receipt_uniqueness ON public.transactions;
CREATE TRIGGER trigger_check_receipt_uniqueness
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.check_receipt_uniqueness();

-- 5. Tighten RLS policies
-- We assume the policy "Users can update their own transactions" exists.
-- If it doesn't, this will fail or we can use DO blocks. 
-- For safety in this environment, we use DROP/CREATE.

DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;

CREATE POLICY "Users can update their own transactions"
ON public.transactions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
    auth.uid() = user_id 
);

-- 6. Cleanup Job (Database level)
-- This function can be called via Cron if pg_cron is available, 
-- or manually as a maintenance task.
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_receipts()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Business logic cleanup: remove receipt_url from transactions 
    -- that are not in the current month (if the user wants to strictly enforce month-only)
    -- However, usually we just want to prevent REUSE, not delete old valid receipts.
    -- If the user wants to "remove links not from current month":
    UPDATE public.transactions
    SET receipt_url = NULL
    WHERE receipt_url IS NOT NULL
    AND date < date_trunc('month', now())::date;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
