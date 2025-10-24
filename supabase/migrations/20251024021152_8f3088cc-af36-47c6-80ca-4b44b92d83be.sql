-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Users can view own profile and shared ride members" ON public.profiles;

-- Restrict profiles table to only show user's own full profile
CREATE POLICY "Users can only view their own full profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Create a view for public profile information (without email)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  name,
  photo,
  program,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;