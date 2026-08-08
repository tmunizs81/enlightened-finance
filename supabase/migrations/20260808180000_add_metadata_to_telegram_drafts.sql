-- A versão anterior do telegram-webhook gravava draft.metadata (file_id, ocr_provider)
-- sem essa coluna existir, causando falha silenciosa ao salvar rascunhos de OCR.
ALTER TABLE public.telegram_drafts ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
