-- Create photo approvals table
CREATE TABLE public.photo_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_update_id UUID NOT NULL REFERENCES public.job_updates(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  comments TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_update_id, photo_url)
);

-- Enable RLS
ALTER TABLE public.photo_approvals ENABLE ROW LEVEL SECURITY;

-- Supervisors can view all photo approvals
CREATE POLICY "Supervisors can view all photo approvals"
ON public.photo_approvals
FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Supervisors can update photo approvals
CREATE POLICY "Supervisors can update photo approvals"
ON public.photo_approvals
FOR UPDATE
USING (
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Staff can view approvals for their own job updates
CREATE POLICY "Staff can view their own photo approvals"
ON public.photo_approvals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_updates ju
    WHERE ju.id = photo_approvals.job_update_id
    AND ju.user_id = auth.uid()
  )
);

-- Function to create photo approval records when photos are uploaded
CREATE OR REPLACE FUNCTION public.create_photo_approvals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert approval records for each photo URL
  INSERT INTO public.photo_approvals (job_update_id, photo_url)
  SELECT NEW.id, unnest(NEW.photo_urls)
  ON CONFLICT (job_update_id, photo_url) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create photo approval records
CREATE TRIGGER on_job_update_photos_inserted
AFTER INSERT ON public.job_updates
FOR EACH ROW
WHEN (NEW.photo_urls IS NOT NULL AND array_length(NEW.photo_urls, 1) > 0)
EXECUTE FUNCTION public.create_photo_approvals();

-- Enable realtime for photo approvals
ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_approvals;