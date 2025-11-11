-- Phase 1: Critical Security Fix - Move roles to separate table

-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('staff', 'supervisor', 'manager');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, role)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. RLS policy: Users can read their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- 5. RLS policy: Only managers can insert/update roles (for future admin panel)
CREATE POLICY "Managers can manage all roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'manager'
  )
);

-- 6. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 7. Migrate existing roles from profiles to user_roles (map technician to staff)
INSERT INTO public.user_roles (user_id, role)
SELECT 
  user_id, 
  CASE 
    WHEN role = 'technician' THEN 'staff'::public.app_role
    ELSE role::public.app_role
  END
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 8. Remove role column from profiles table
ALTER TABLE public.profiles DROP COLUMN role;

-- 9. Update Jobs table RLS policies for supervisors

-- Supervisors can view all jobs
CREATE POLICY "Supervisors can view all jobs"
ON public.jobs
FOR SELECT
USING (public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'manager'));

-- Supervisors can create jobs
CREATE POLICY "Supervisors can create jobs"
ON public.jobs
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'manager'));

-- Supervisors can update any job
CREATE POLICY "Supervisors can update any job"
ON public.jobs
FOR UPDATE
USING (public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'manager'));

-- 10. Update Clock Entries RLS policies for supervisors

-- Supervisors can view all clock entries
CREATE POLICY "Supervisors can view all clock entries"
ON public.clock_entries
FOR SELECT
USING (public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'manager'));

-- 11. Update Job Updates RLS policies for supervisors

-- Supervisors can view all job updates
CREATE POLICY "Supervisors can view all job updates"
ON public.job_updates
FOR SELECT
USING (public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'manager'));

-- 12. Add new columns to jobs table for supervisor features
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_type TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS estimated_duration NUMERIC;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS materials_required TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS safety_requirements TEXT;

-- 13. Add timesheet approval columns to clock_entries
ALTER TABLE public.clock_entries ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE public.clock_entries ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.clock_entries ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.clock_entries ADD COLUMN IF NOT EXISTS approval_notes TEXT;
ALTER TABLE public.clock_entries ADD COLUMN IF NOT EXISTS total_hours NUMERIC;
ALTER TABLE public.clock_entries ADD COLUMN IF NOT EXISTS break_duration NUMERIC;

-- 14. Supervisors can update clock entry approval status
CREATE POLICY "Supervisors can update clock entry approvals"
ON public.clock_entries
FOR UPDATE
USING (public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'manager'));

-- 15. Add location tracking column
ALTER TABLE public.clock_entries ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP WITH TIME ZONE;