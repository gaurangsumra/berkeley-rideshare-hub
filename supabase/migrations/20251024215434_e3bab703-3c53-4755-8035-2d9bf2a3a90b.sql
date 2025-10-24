-- Update ride_invites table to expire after 3 days instead of 7 days
-- and set default max_uses to 1 for single-use links

-- Drop the existing default constraint for expires_at
ALTER TABLE public.ride_invites 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '3 days');

-- Set default max_uses to 1 (single use)
ALTER TABLE public.ride_invites 
ALTER COLUMN max_uses SET DEFAULT 1;

-- Update any existing invites that haven't been used yet to have max_uses of 1 if null
UPDATE public.ride_invites 
SET max_uses = 1 
WHERE max_uses IS NULL AND use_count = 0;