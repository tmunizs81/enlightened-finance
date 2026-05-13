-- Add alert customization columns to budgets table
ALTER TABLE public.budgets 
ADD COLUMN IF NOT EXISTS alert_threshold INTEGER DEFAULT 80,
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.budgets.alert_threshold IS 'Percentage threshold (0-100) to trigger budget warnings.';
COMMENT ON COLUMN public.budgets.notification_enabled IS 'Toggle for active notifications/alerts for this category budget.';
