-- Security Fix 1: Add RLS to public_profiles view
-- This view exposes user data without authentication, so we'll add RLS protection
ALTER VIEW public_profiles SET (security_invoker = true);

COMMENT ON VIEW public_profiles IS 'Public view of user profiles with RLS protection via security_invoker';

-- Security Fix 2: Move invite use count increment to server-side trigger
-- This prevents client-side bypass of max_uses limits

-- Create function to increment invite usage when a new user signs up
CREATE OR REPLACE FUNCTION public.increment_invite_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_ride_id UUID;
  invite_token_value TEXT;
BEGIN
  -- Extract invite info from user metadata
  invite_ride_id := (NEW.raw_user_meta_data->>'invited_via_ride_id')::UUID;
  
  -- Only process if user was invited via a ride
  IF invite_ride_id IS NOT NULL THEN
    -- Find the invite token for this ride and user
    SELECT ri.invite_token INTO invite_token_value
    FROM ride_invites ri
    WHERE ri.ride_id = invite_ride_id
      AND ri.expires_at > NOW()
      AND (ri.max_uses IS NULL OR ri.use_count < ri.max_uses)
    ORDER BY ri.created_at DESC
    LIMIT 1;
    
    -- Increment use count if valid token found
    IF invite_token_value IS NOT NULL THEN
      UPDATE ride_invites
      SET use_count = use_count + 1
      WHERE invite_token = invite_token_value
        AND expires_at > NOW()
        AND (max_uses IS NULL OR use_count < max_uses);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table to increment invite usage after user creation
DROP TRIGGER IF EXISTS on_auth_user_increment_invite ON auth.users;

CREATE TRIGGER on_auth_user_increment_invite
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_invite_usage();