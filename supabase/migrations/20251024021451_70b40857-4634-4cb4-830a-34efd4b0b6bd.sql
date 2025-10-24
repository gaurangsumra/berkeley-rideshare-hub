-- Recreate the view with SECURITY INVOKER to fix the security warning
CREATE OR REPLACE VIEW public.public_profiles 
WITH (security_invoker=true) AS
SELECT 
  id,
  name,
  photo,
  program,
  created_at
FROM public.profiles;