-- Add notes column to clock_entries table
ALTER TABLE public.clock_entries 
ADD COLUMN notes TEXT;