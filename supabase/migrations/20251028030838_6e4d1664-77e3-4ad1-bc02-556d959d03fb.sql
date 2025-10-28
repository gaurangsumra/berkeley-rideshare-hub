-- Function to check for existing ride membership in same event
CREATE OR REPLACE FUNCTION public.check_one_ride_per_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user is already in another ride for this event
  IF EXISTS (
    SELECT 1 
    FROM ride_members rm
    JOIN ride_groups rg ON rm.ride_id = rg.id
    JOIN ride_groups new_rg ON new_rg.id = NEW.ride_id
    WHERE rm.user_id = NEW.user_id
      AND rm.status = 'joined'
      AND rg.event_id = new_rg.event_id
      AND rm.ride_id != NEW.ride_id
  ) THEN
    RAISE EXCEPTION 'User is already in a ride group for this event';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to ride_members table
CREATE TRIGGER enforce_one_ride_per_event
  BEFORE INSERT ON ride_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_one_ride_per_event();