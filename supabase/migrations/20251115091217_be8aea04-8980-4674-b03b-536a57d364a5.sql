-- Make job-photos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE name = 'job-photos';

-- Add RLS policies for storage.objects
CREATE POLICY "Staff can upload to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'job-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can access photos from their assigned jobs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'job-photos' AND (
    -- Staff can see their own uploads
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Supervisors can see all photos
    public.has_role(auth.uid(), 'supervisor'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "Staff can update their own photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'job-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Staff can delete their own photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'job-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);