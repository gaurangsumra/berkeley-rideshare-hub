-- Phase 1: Make profiles.program nullable
ALTER TABLE profiles ALTER COLUMN program DROP NOT NULL;
ALTER TABLE profiles ALTER COLUMN program SET DEFAULT 'Not specified';

-- Phase 2: Create event_access table
CREATE TABLE event_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  granted_via_ride_id UUID REFERENCES ride_groups(id) ON DELETE SET NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE event_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own event access" ON event_access
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert event access" ON event_access
  FOR INSERT
  WITH CHECK (true);

-- Phase 3: Create trigger to auto-grant event access
CREATE OR REPLACE FUNCTION grant_event_access_on_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = NEW.user_id 
    AND is_invited_user = true
  ) THEN
    INSERT INTO event_access (user_id, event_id, granted_via_ride_id)
    SELECT NEW.user_id, rg.event_id, NEW.ride_id
    FROM ride_groups rg
    WHERE rg.id = NEW.ride_id
    ON CONFLICT (user_id, event_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER grant_event_access_trigger
AFTER INSERT ON ride_members
FOR EACH ROW
EXECUTE FUNCTION grant_event_access_on_join();

-- Phase 4: Update Events RLS policies
DROP POLICY IF EXISTS "Anyone can view events" ON events;

CREATE POLICY "Berkeley users see all events" ON events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (is_invited_user = false OR is_invited_user IS NULL)
    )
  );

CREATE POLICY "Non-Berkeley users see invited events" ON events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_invited_user = true
    )
    AND EXISTS (
      SELECT 1 FROM event_access
      WHERE user_id = auth.uid()
      AND event_id = events.id
    )
  );

-- Phase 5: Update ride_invites table
ALTER TABLE ride_invites ADD COLUMN invited_email TEXT;
ALTER TABLE ride_invites ADD COLUMN inviter_name TEXT;

CREATE INDEX idx_ride_invites_email ON ride_invites(invited_email);