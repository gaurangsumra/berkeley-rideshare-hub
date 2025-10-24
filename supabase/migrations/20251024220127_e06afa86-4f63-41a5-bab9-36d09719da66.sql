-- Allow users to view public profile info of people in their ride groups
CREATE POLICY "Users can view ride members public profiles"
ON public.profiles
FOR SELECT
USING (
  -- User can see profiles of people in same ride groups
  EXISTS (
    SELECT 1 FROM ride_members rm1
    INNER JOIN ride_members rm2 ON rm1.ride_id = rm2.ride_id
    WHERE rm1.user_id = auth.uid()
    AND rm2.user_id = profiles.id
  )
);