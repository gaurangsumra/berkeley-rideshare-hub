-- Add Venmo username to profiles
ALTER TABLE profiles 
ADD COLUMN venmo_username text;

-- Create function to calculate user ride statistics
CREATE OR REPLACE FUNCTION get_user_ride_stats(user_uuid uuid)
RETURNS TABLE (
  total_rides bigint,
  completed_rides bigint,
  completion_percentage numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_rides,
    COUNT(CASE WHEN rg.departure_time < NOW() THEN 1 END)::bigint as completed_rides,
    CASE 
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND((COUNT(CASE WHEN rg.departure_time < NOW() THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 1)
    END as completion_percentage
  FROM ride_members rm
  JOIN ride_groups rg ON rm.ride_id = rg.id
  WHERE rm.user_id = user_uuid AND rm.status = 'joined';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;