-- Drop the existing policy that allows all authenticated users to view all profiles
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Create a new policy that restricts profile visibility to:
-- 1. Users can see their own profile
-- 2. Users can see profiles of people in their shared rides
CREATE POLICY "Users can view own profile and ride members" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id 
  OR 
  EXISTS (
    SELECT 1 
    FROM ride_members rm1
    JOIN ride_members rm2 ON rm1.ride_id = rm2.ride_id
    WHERE rm1.user_id = auth.uid() 
    AND rm2.user_id = profiles.id
  )
);