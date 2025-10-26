-- Step 1: Drop the old constraint first
ALTER TABLE ride_groups 
DROP CONSTRAINT IF EXISTS ride_groups_travel_mode_check;

-- Step 2: Update existing data to new format
UPDATE ride_groups 
SET travel_mode = 'Rideshare (Uber/Lyft)' 
WHERE travel_mode = 'Uber';

UPDATE ride_groups 
SET travel_mode = 'Carpool (Student Driver)' 
WHERE travel_mode = 'Self-Driving';

-- Step 3: Add new constraint with updated values
ALTER TABLE ride_groups 
ADD CONSTRAINT ride_groups_travel_mode_check 
CHECK (travel_mode IN ('Rideshare (Uber/Lyft)', 'Carpool (Student Driver)'));