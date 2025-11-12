-- Drop the problematic policy
DROP POLICY IF EXISTS "Managers can manage all roles" ON public.user_roles;

-- Recreate it using the has_role() security definer function to avoid recursion
CREATE POLICY "Managers can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'manager'::app_role));