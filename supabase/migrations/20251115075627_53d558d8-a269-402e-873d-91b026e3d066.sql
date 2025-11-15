-- Add work_progress column to jobs table for tracking specific job completion items
ALTER TABLE public.jobs 
ADD COLUMN work_progress JSONB DEFAULT '[]'::jsonb,
ADD COLUMN work_completion NUMERIC DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.jobs.work_progress IS 'JSON array of work items with completion status (e.g., Fan Installation, Dishwasher Repair)';
COMMENT ON COLUMN public.jobs.work_completion IS 'Percentage of work items completed (0-100)';