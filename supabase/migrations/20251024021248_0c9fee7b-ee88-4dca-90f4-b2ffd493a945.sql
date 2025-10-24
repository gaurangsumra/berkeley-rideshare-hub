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