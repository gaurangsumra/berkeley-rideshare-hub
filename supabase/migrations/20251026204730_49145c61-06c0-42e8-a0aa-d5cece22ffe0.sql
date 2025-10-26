-- Phase 1: Add capacity management columns
ALTER TABLE ride_groups ADD COLUMN IF NOT EXISTS min_capacity INTEGER DEFAULT 1;

-- Phase 2: Chat functionality tables
CREATE TABLE IF NOT EXISTS ride_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES ride_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ride_messages_ride_id ON ride_group_messages(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_messages_created_at ON ride_group_messages(created_at DESC);

-- RLS for messages
ALTER TABLE ride_group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view ride messages"
  ON ride_group_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ride_members
      WHERE ride_members.ride_id = ride_group_messages.ride_id
      AND ride_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can send messages"
  ON ride_group_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM ride_members
      WHERE ride_members.ride_id = ride_group_messages.ride_id
      AND ride_members.user_id = auth.uid()
    )
  );

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE ride_group_messages;

-- Message read tracking
CREATE TABLE IF NOT EXISTS ride_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES ride_groups(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ride_id)
);

ALTER TABLE ride_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own read status"
  ON ride_message_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Phase 3: Notifications system
CREATE TYPE notification_type AS ENUM (
  'new_message',
  'member_joined',
  'member_left',
  'group_full',
  'group_ready',
  'meeting_point_tie',
  'ride_starting_soon'
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ride_id UUID REFERENCES ride_groups(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Notification trigger for new messages
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, ride_id, type, title, message, metadata)
  SELECT 
    rm.user_id,
    NEW.ride_id,
    'new_message',
    'New message in your ride group',
    'You have a new message from ' || COALESCE((SELECT name FROM profiles WHERE id = NEW.user_id), 'a member'),
    jsonb_build_object('message_id', NEW.id)
  FROM ride_members rm
  WHERE rm.ride_id = NEW.ride_id
  AND rm.user_id != NEW.user_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_sent
  AFTER INSERT ON ride_group_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- Phase 4: User ratings system
CREATE TABLE IF NOT EXISTS user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rated_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rater_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES ride_groups(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rated_user_id, rater_user_id, ride_id)
);

CREATE INDEX IF NOT EXISTS idx_user_ratings_rated_user ON user_ratings(rated_user_id);

ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can rate ride companions"
  ON user_ratings FOR INSERT
  WITH CHECK (
    auth.uid() = rater_user_id AND
    EXISTS (
      SELECT 1 FROM ride_members rm1
      JOIN ride_members rm2 ON rm1.ride_id = rm2.ride_id
      WHERE rm1.user_id = auth.uid()
      AND rm2.user_id = rated_user_id
      AND rm1.ride_id = user_ratings.ride_id
      AND rm1.ride_id IN (
        SELECT id FROM ride_groups WHERE departure_time < now()
      )
    )
  );

CREATE POLICY "View aggregated ratings"
  ON user_ratings FOR SELECT
  USING (true);