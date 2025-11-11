-- Create storage bucket for job photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true);

-- Allow authenticated users to upload photos for their jobs
CREATE POLICY "Users can upload job photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'job-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own job photos
CREATE POLICY "Users can view their own job photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'job-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow supervisors to view all job photos
CREATE POLICY "Supervisors can view all job photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'job-photos'
  AND (
    has_role(auth.uid(), 'supervisor'::app_role) 
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

-- Allow users to delete their own job photos
CREATE POLICY "Users can delete their own job photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'job-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);