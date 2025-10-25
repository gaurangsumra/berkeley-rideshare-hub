-- Create unique partial index if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_one_driver_per_carpool'
  ) THEN
    CREATE UNIQUE INDEX idx_one_driver_per_carpool 
    ON ride_members (ride_id) 
    WHERE role = 'driver';
  END IF;
END $$;

-- Migrate existing "Self-Driving" rides: assign first member as driver
WITH first_members AS (
  SELECT DISTINCT ON (ride_id) 
    ride_id, user_id
  FROM ride_members
  WHERE ride_id IN (
    SELECT id FROM ride_groups WHERE travel_mode = 'Self-Driving'
  )
  AND role IS NULL
  ORDER BY ride_id, created_at ASC
)
UPDATE ride_members
SET role = 'driver'
WHERE (ride_id, user_id) IN (SELECT ride_id, user_id FROM first_members);