-- Drop existing delete policy on ride_groups
DROP POLICY IF EXISTS "Group creators can delete their groups" ON ride_groups;

-- Create new policy that allows deletion only when member count <= 1
-- and the user is either an admin or a member of that ride group
CREATE POLICY "Delete groups with 0-1 members only"
ON ride_groups
FOR DELETE
TO authenticated
USING (
  -- Count members in this ride group
  (SELECT COUNT(*) FROM ride_members WHERE ride_id = ride_groups.id) <= 1
  AND (
    -- User is admin
    has_role(auth.uid(), 'admin'::app_role)
    OR
    -- User is a member of this ride group
    EXISTS (
      SELECT 1 FROM ride_members 
      WHERE ride_id = ride_groups.id 
      AND user_id = auth.uid()
    )
  )
);