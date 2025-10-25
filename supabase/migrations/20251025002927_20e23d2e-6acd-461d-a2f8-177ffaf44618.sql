-- Create enum for roles
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Insert admin users (will work once they sign up)
-- Note: These will be inserted when users with these emails sign up
-- For now, we'll create the structure and handle insertion via trigger or manual insertion

-- Update events RLS policies for update
DROP POLICY IF EXISTS "Event creators can update their events" ON public.events;
CREATE POLICY "Event creators and admins can update events" ON public.events
  FOR UPDATE
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- Update events RLS policies for delete
DROP POLICY IF EXISTS "Event creators can delete their events" ON public.events;
CREATE POLICY "Event creators and admins can delete events" ON public.events
  FOR DELETE
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));