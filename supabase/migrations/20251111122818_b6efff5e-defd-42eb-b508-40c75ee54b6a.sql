-- Add signature URL column to jobs table
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id);

-- Create index for faster queries on completed jobs
CREATE INDEX IF NOT EXISTS idx_jobs_completed_at ON public.jobs(completed_at) WHERE completed_at IS NOT NULL;