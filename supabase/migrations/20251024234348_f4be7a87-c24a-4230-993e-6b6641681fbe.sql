-- Fix RLS policies on calendar_tokens to ensure proper evaluation
DROP POLICY IF EXISTS "Users can view own calendar tokens" ON calendar_tokens;
DROP POLICY IF EXISTS "Users can insert own calendar tokens" ON calendar_tokens;
DROP POLICY IF EXISTS "Users can update own calendar tokens" ON calendar_tokens;
DROP POLICY IF EXISTS "Users can delete own calendar tokens" ON calendar_tokens;

-- Create updated policies with explicit text casting for clarity
CREATE POLICY "Users can view own calendar tokens"
  ON calendar_tokens FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own calendar tokens"
  ON calendar_tokens FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own calendar tokens"
  ON calendar_tokens FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own calendar tokens"
  ON calendar_tokens FOR DELETE
  USING (auth.uid()::text = user_id::text);