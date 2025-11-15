-- Create job_comments table for task communication
CREATE TABLE public.job_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  comment_text text NOT NULL CHECK (char_length(comment_text) > 0 AND char_length(comment_text) <= 2000),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Index for performance
CREATE INDEX idx_job_comments_job_id ON public.job_comments(job_id);
CREATE INDEX idx_job_comments_created_at ON public.job_comments(created_at DESC);

-- Enable RLS
ALTER TABLE public.job_comments ENABLE ROW LEVEL SECURITY;

-- Staff can view comments on their assigned jobs
CREATE POLICY "Staff can view comments on assigned jobs"
ON public.job_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_comments.job_id
    AND jobs.assigned_to = auth.uid()
  )
);

-- Supervisors/managers can view all comments
CREATE POLICY "Supervisors can view all comments"
ON public.job_comments FOR SELECT
USING (
  public.has_role(auth.uid(), 'supervisor'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role)
);

-- Staff can add comments to their assigned jobs
CREATE POLICY "Staff can add comments to assigned jobs"
ON public.job_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_comments.job_id
    AND jobs.assigned_to = auth.uid()
  )
);

-- Supervisors can add comments to any job
CREATE POLICY "Supervisors can add comments to any job"
ON public.job_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    public.has_role(auth.uid(), 'supervisor'::app_role) OR
    public.has_role(auth.uid(), 'manager'::app_role)
  )
);

-- Users can update their own comments (within 15 minutes)
CREATE POLICY "Users can update own recent comments"
ON public.job_comments FOR UPDATE
USING (
  auth.uid() = user_id AND
  created_at > (now() - interval '15 minutes')
);

-- Users can delete their own comments (within 15 minutes)
CREATE POLICY "Users can delete own recent comments"
ON public.job_comments FOR DELETE
USING (
  auth.uid() = user_id AND
  created_at > (now() - interval '15 minutes')
);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_job_comments_updated_at
  BEFORE UPDATE ON public.job_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_comments;