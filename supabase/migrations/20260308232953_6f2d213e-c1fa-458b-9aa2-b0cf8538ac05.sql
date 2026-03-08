
-- Create storage bucket for automatic backups
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('backups', 'backups', false, 52428800, ARRAY['application/json']);

-- RLS: Users can view their own backups
CREATE POLICY "Users view own backups"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can delete own backups
CREATE POLICY "Users delete own backups"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text);
