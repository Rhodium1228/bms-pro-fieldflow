-- Fix search_path for calculate_checklist_completion function
DROP FUNCTION IF EXISTS calculate_checklist_completion(JSONB);

CREATE OR REPLACE FUNCTION calculate_checklist_completion(checklist JSONB)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
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