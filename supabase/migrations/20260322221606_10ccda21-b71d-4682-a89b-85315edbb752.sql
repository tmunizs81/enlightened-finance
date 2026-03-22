
CREATE OR REPLACE FUNCTION public.update_account_balance_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.account_id IS NOT NULL THEN
      IF OLD.type = 'expense' THEN
        UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
      ELSIF OLD.type = 'income' THEN
        UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.account_id IS NOT NULL THEN
      IF NEW.type = 'expense' THEN
        UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
      ELSIF NEW.type = 'income' THEN
        UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_update_account_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_account_balance_on_transaction();
