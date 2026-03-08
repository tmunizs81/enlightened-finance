
-- Add receipt_url column to transactions
ALTER TABLE public.transactions ADD COLUMN receipt_url TEXT;

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

-- RLS: Users can upload to their own folder
CREATE POLICY "Users upload own receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can view own receipts
CREATE POLICY "Users view own receipts"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can delete own receipts
CREATE POLICY "Users delete own receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Public read access for displaying receipts
CREATE POLICY "Public read receipts"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'receipts');
