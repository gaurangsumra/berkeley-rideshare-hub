-- Create feedback_submissions table for user feedback
CREATE TABLE public.feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  feedback_type text NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'question', 'complaint', 'compliment')),
  subject text NOT NULL,
  description text NOT NULL,
  contact_email text NOT NULL,
  ride_id uuid REFERENCES ride_groups(id),
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including non-authenticated users) to submit feedback
CREATE POLICY "Anyone can submit feedback"
ON public.feedback_submissions
FOR INSERT
WITH CHECK (true);

-- Create index for admin querying
CREATE INDEX idx_feedback_status_created ON public.feedback_submissions(status, created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_feedback_updated_at
BEFORE UPDATE ON public.feedback_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_feedback_updated_at();