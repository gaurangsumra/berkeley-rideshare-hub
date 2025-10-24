-- Create ride_invites table
CREATE TABLE public.ride_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  invite_token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  max_uses INTEGER DEFAULT NULL,
  use_count INTEGER NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.ride_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ride_invites
CREATE POLICY "Anyone can view invites" 
ON public.ride_invites 
FOR SELECT 
USING (true);

CREATE POLICY "Ride members can create invites" 
ON public.ride_invites 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by 
  AND EXISTS (
    SELECT 1 FROM ride_members 
    WHERE ride_members.ride_id = ride_invites.ride_id 
    AND ride_members.user_id = auth.uid()
  )
);

CREATE POLICY "Invite creators can update their invites" 
ON public.ride_invites 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Add columns to profiles table for invited users
ALTER TABLE public.profiles 
ADD COLUMN is_invited_user BOOLEAN DEFAULT false,
ADD COLUMN invited_via_ride_id UUID REFERENCES public.ride_groups(id) ON DELETE SET NULL;

-- Update RLS policy for ride_members to allow invited users to join their specific ride
DROP POLICY IF EXISTS "Authenticated users can join rides" ON public.ride_members;

CREATE POLICY "Authenticated users can join rides" 
ON public.ride_members 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND (
    -- Regular users can join any ride
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_invited_user = false)
    OR
    -- Invited users can only join the ride they were invited to
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_invited_user = true 
      AND invited_via_ride_id = ride_id
    )
  )
);

-- Create index for faster invite token lookups
CREATE INDEX idx_ride_invites_token ON public.ride_invites(invite_token);
CREATE INDEX idx_profiles_invited_user ON public.profiles(is_invited_user, invited_via_ride_id);