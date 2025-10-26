-- Create event_comments table
CREATE TABLE IF NOT EXISTS event_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_event_comments_event_id ON event_comments(event_id);
CREATE INDEX idx_event_comments_created_at ON event_comments(created_at DESC);

-- Enable RLS
ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view comments for events they can see
CREATE POLICY "Users can view comments for accessible events"
  ON event_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_comments.event_id
    )
  );

-- RLS Policy: Authenticated users can create comments
CREATE POLICY "Authenticated users can create comments"
  ON event_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON event_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON event_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE event_comments;