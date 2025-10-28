-- 1. Update profiles visibility policy to allow viewing all ride members
DROP POLICY IF EXISTS "Users can view ride members public profiles" ON profiles;

CREATE POLICY "Can view all ride members profiles" 
ON profiles FOR SELECT 
USING (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM ride_members 
    WHERE ride_members.user_id = profiles.id
  )
);

-- 2. Create admin policies for comprehensive data access
CREATE POLICY "Admins can view all profiles" 
ON profiles FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all ride members" 
ON ride_members FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all ride groups" 
ON ride_groups FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all events" 
ON events FOR SELECT 
USING (has_role(auth.uid(), 'admin'));