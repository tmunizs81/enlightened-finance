ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS processing_ms INTEGER;

CREATE INDEX IF NOT EXISTS payment_events_created_at_idx ON public.payment_events (created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_status_idx ON public.payment_events (status);
CREATE INDEX IF NOT EXISTS payment_events_event_type_idx ON public.payment_events (event_type);