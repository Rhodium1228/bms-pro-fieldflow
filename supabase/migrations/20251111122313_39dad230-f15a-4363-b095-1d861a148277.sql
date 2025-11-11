-- Add checklist completion tracking columns to jobs table
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS safety_checklist JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS materials_checklist JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS safety_completion NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS materials_completion NUMERIC DEFAULT 0;

-- Update existing text fields to JSONB format if they have data
-- This converts comma-separated text to JSON array format
UPDATE public.jobs 
SET safety_checklist = 
  CASE 
    WHEN safety_requirements IS NOT NULL AND safety_requirements != '' THEN
      (SELECT jsonb_agg(jsonb_build_object('item', item, 'completed', false))
       FROM unnest(string_to_array(safety_requirements, ',')) AS item)
    ELSE '[]'::jsonb
  END
WHERE safety_checklist = '[]'::jsonb;

UPDATE public.jobs 
SET materials_checklist = 
  CASE 
    WHEN materials_required IS NOT NULL AND materials_required != '' THEN
      (SELECT jsonb_agg(jsonb_build_object('item', item, 'completed', false, 'quantity', 1))
       FROM unnest(string_to_array(materials_required, ',')) AS item)
    ELSE '[]'::jsonb
  END
WHERE materials_checklist = '[]'::jsonb;

-- Create function to calculate checklist completion percentage
CREATE OR REPLACE FUNCTION calculate_checklist_completion(checklist JSONB)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  total_items INTEGER;
  completed_items INTEGER;
BEGIN
  total_items := jsonb_array_length(checklist);
  
  IF total_items = 0 THEN
    RETURN 0;
  END IF;
  
  completed_items := (
    SELECT COUNT(*)
    FROM jsonb_array_elements(checklist) AS item
    WHERE (item->>'completed')::boolean = true
  );
  
  RETURN ROUND((completed_items::numeric / total_items::numeric) * 100, 0);
END;
$$;