-- Create enum for survey status
CREATE TYPE public.survey_status AS ENUM ('pending', 'in_progress', 'completed', 'expired');

-- Create ride_attendance_surveys table
CREATE TABLE public.ride_attendance_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  survey_status survey_status NOT NULL DEFAULT 'pending',
  survey_sent_at TIMESTAMPTZ,
  survey_deadline TIMESTAMPTZ NOT NULL,
  total_members INTEGER NOT NULL,
  responses_received INTEGER NOT NULL DEFAULT 0,
  consensus_processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ride_id)
);

-- Create ride_attendance_responses table
CREATE TABLE public.ride_attendance_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.ride_attendance_surveys(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  respondent_user_id UUID NOT NULL,
  attended_user_ids UUID[] NOT NULL,
  responded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(survey_id, respondent_user_id)
);

-- Create ride_completions table
CREATE TABLE public.ride_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  confirmed_by_consensus BOOLEAN NOT NULL DEFAULT true,
  vote_count INTEGER NOT NULL,
  total_voters INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ride_id, user_id)
);

-- Update get_user_ride_stats function to count from ride_completions
CREATE OR REPLACE FUNCTION public.get_user_ride_stats(user_uuid uuid)
RETURNS TABLE (
  total_rides bigint,
  completed_rides bigint,
  completion_percentage numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT rm.ride_id)::bigint as total_rides,
    COUNT(DISTINCT rc.ride_id)::bigint as completed_rides,
    CASE 
      WHEN COUNT(DISTINCT rm.ride_id) = 0 THEN 0
      ELSE ROUND(
        (COUNT(DISTINCT rc.ride_id)::numeric / COUNT(DISTINCT rm.ride_id)::numeric) * 100, 
        1
      )
    END as completion_percentage
  FROM ride_members rm
  LEFT JOIN ride_completions rc ON rc.ride_id = rm.ride_id AND rc.user_id = rm.user_id
  WHERE rm.user_id = user_uuid AND rm.status = 'joined';
END;
$$;

-- RLS Policies for ride_attendance_surveys
ALTER TABLE public.ride_attendance_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ride members can view surveys"
ON public.ride_attendance_surveys FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ride_members 
    WHERE ride_id = ride_attendance_surveys.ride_id 
    AND user_id = auth.uid()
  )
);

-- RLS Policies for ride_attendance_responses
ALTER TABLE public.ride_attendance_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ride members can view responses"
ON public.ride_attendance_responses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM ride_members 
    WHERE ride_id = ride_attendance_responses.ride_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Members can submit own response"
ON public.ride_attendance_responses FOR INSERT
WITH CHECK (
  auth.uid() = respondent_user_id
  AND EXISTS (
    SELECT 1 FROM ride_members 
    WHERE ride_id = ride_attendance_responses.ride_id 
    AND user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM ride_attendance_surveys
    WHERE id = ride_attendance_responses.survey_id
    AND survey_status IN ('pending', 'in_progress')
    AND survey_deadline > NOW()
  )
);

-- RLS Policies for ride_completions
ALTER TABLE public.ride_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view completions"
ON public.ride_completions FOR SELECT
TO authenticated
USING (true);

-- Update user_ratings RLS policy to require confirmed completions
DROP POLICY IF EXISTS "Users can rate ride companions" ON public.user_ratings;

CREATE POLICY "Users can rate ride companions"
ON public.user_ratings FOR INSERT
WITH CHECK (
  auth.uid() = rater_user_id 
  AND EXISTS (
    SELECT 1
    FROM ride_completions rc1
    JOIN ride_completions rc2 ON rc1.ride_id = rc2.ride_id
    WHERE rc1.user_id = auth.uid() 
    AND rc2.user_id = user_ratings.rated_user_id
    AND rc1.ride_id = user_ratings.ride_id
    AND rc1.confirmed_by_consensus = true
    AND rc2.confirmed_by_consensus = true
  )
);

-- Add indexes for performance
CREATE INDEX idx_ride_attendance_surveys_ride_id ON public.ride_attendance_surveys(ride_id);
CREATE INDEX idx_ride_attendance_surveys_status ON public.ride_attendance_surveys(survey_status);
CREATE INDEX idx_ride_attendance_responses_survey_id ON public.ride_attendance_responses(survey_id);
CREATE INDEX idx_ride_attendance_responses_ride_id ON public.ride_attendance_responses(ride_id);
CREATE INDEX idx_ride_completions_ride_id ON public.ride_completions(ride_id);
CREATE INDEX idx_ride_completions_user_id ON public.ride_completions(user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_attendance_surveys;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_attendance_responses;