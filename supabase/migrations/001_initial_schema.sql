-- ============================================
-- Berkeley Rideshare Hub — Full Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.notification_type AS ENUM (
  'new_message', 'member_joined', 'member_left', 'group_full',
  'group_ready', 'meeting_point_tie', 'ride_starting_soon',
  'payment_amount_entered', 'payment_reminder', 'payment_confirmed',
  'venmo_required', 'attendance_survey', 'attendance_survey_reminder',
  'ride_invite'
);
CREATE TYPE public.survey_status AS ENUM ('pending', 'in_progress', 'completed', 'expired');

-- 2. TABLES (in dependency order)

-- profiles (depends on auth.users, references ride_groups later via FK)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  photo text,
  program text,
  venmo_username text,
  is_invited_user boolean DEFAULT false,
  invited_via_ride_id uuid,
  created_at timestamptz DEFAULT now()
);

-- events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date_time timestamptz NOT NULL,
  destination text NOT NULL,
  city text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(destination, '') || ' ' || coalesce(city, '') || ' ' || coalesce(description, ''))
  ) STORED
);
CREATE INDEX events_search_idx ON public.events USING gin(search_vector);

-- ride_groups
CREATE TABLE public.ride_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  departure_time timestamptz NOT NULL,
  travel_mode text NOT NULL,
  meeting_point text,
  capacity integer,
  min_capacity integer,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Now add the deferred FK from profiles to ride_groups
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_invited_via_ride_id_fkey
  FOREIGN KEY (invited_via_ride_id) REFERENCES public.ride_groups(id);

-- ride_members
CREATE TABLE public.ride_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  role text,
  status text,
  willing_to_pay boolean,
  created_at timestamptz DEFAULT now()
);

-- event_access
CREATE TABLE public.event_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  granted_via_ride_id uuid REFERENCES public.ride_groups(id),
  granted_at timestamptz DEFAULT now()
);

-- event_interests
CREATE TABLE public.event_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- event_comments
CREATE TABLE public.event_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  comment text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ride_id uuid REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ride_group_messages (chat)
CREATE TABLE public.ride_group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ride_message_reads
CREATE TABLE public.ride_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  last_read_at timestamptz DEFAULT now(),
  UNIQUE(ride_id, user_id)
);

-- meeting_votes
CREATE TABLE public.meeting_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  vote_option text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- uber_payments
CREATE TABLE public.uber_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  payer_user_id uuid NOT NULL REFERENCES public.profiles(id),
  amount numeric,
  cost_type text,
  venmo_link text,
  payer_venmo_username text,
  created_at timestamptz DEFAULT now()
);

-- payment_confirmations
CREATE TABLE public.payment_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uber_payment_id uuid NOT NULL REFERENCES public.uber_payments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  confirmed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- payment_reminders
CREATE TABLE public.payment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uber_payment_id uuid NOT NULL REFERENCES public.uber_payments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reminder_count integer DEFAULT 0,
  last_reminder_sent timestamptz,
  payment_confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ride_invites
CREATE TABLE public.ride_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  invite_token text NOT NULL UNIQUE,
  invited_email text,
  inviter_name text,
  max_uses integer,
  use_count integer DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ride_attendance_surveys
CREATE TABLE public.ride_attendance_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL UNIQUE REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  survey_status public.survey_status DEFAULT 'pending',
  total_members integer NOT NULL,
  responses_received integer DEFAULT 0,
  survey_deadline timestamptz NOT NULL,
  survey_sent_at timestamptz,
  reminder_sent_at timestamptz,
  consensus_processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ride_attendance_responses
CREATE TABLE public.ride_attendance_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.ride_attendance_surveys(id) ON DELETE CASCADE,
  respondent_user_id uuid NOT NULL,
  attended_user_ids uuid[] NOT NULL,
  responded_at timestamptz DEFAULT now()
);

-- ride_completions
CREATE TABLE public.ride_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  vote_count integer NOT NULL DEFAULT 0,
  total_voters integer NOT NULL DEFAULT 0,
  confirmed_by_consensus boolean DEFAULT false,
  completed_at timestamptz DEFAULT now()
);

-- user_ratings
CREATE TABLE public.user_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  rater_user_id uuid NOT NULL,
  rated_user_id uuid NOT NULL,
  rating numeric,
  comment text,
  created_at timestamptz DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

-- calendar_tokens
CREATE TABLE public.calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  provider text DEFAULT 'google',
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- email_notification_logs
CREATE TABLE public.email_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  notification_type text DEFAULT 'ride_invite',
  recipient_emails text[] NOT NULL,
  message_id uuid REFERENCES public.ride_group_messages(id),
  success boolean DEFAULT true,
  error_message text,
  failed_recipients text[],
  sent_at timestamptz DEFAULT now()
);

-- feedback_submissions
CREATE TABLE public.feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  feedback_type text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  contact_email text NOT NULL,
  ride_id uuid REFERENCES public.ride_groups(id),
  status text DEFAULT 'open',
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. VIEW: public_profiles
CREATE VIEW public.public_profiles AS
  SELECT id, name, photo, program, created_at
  FROM public.profiles;

-- 4. FUNCTIONS

-- get_user_ride_stats
CREATE OR REPLACE FUNCTION public.get_user_ride_stats(user_uuid uuid)
RETURNS TABLE(total_rides bigint, completed_rides bigint, completion_percentage numeric)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT rm.ride_id) AS total_rides,
    COUNT(DISTINCT rc.ride_id) AS completed_rides,
    CASE
      WHEN COUNT(DISTINCT rm.ride_id) = 0 THEN 0
      ELSE ROUND((COUNT(DISTINCT rc.ride_id)::numeric / COUNT(DISTINCT rm.ride_id)::numeric) * 100, 1)
    END AS completion_percentage
  FROM public.ride_members rm
  LEFT JOIN public.ride_completions rc ON rc.ride_id = rm.ride_id AND rc.confirmed_by_consensus = true
  WHERE rm.user_id = user_uuid AND rm.status = 'joined';
END;
$$;

-- has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- search_events
CREATE OR REPLACE FUNCTION public.search_events(search_query text)
RETURNS SETOF public.events
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.events
  WHERE search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY date_time DESC;
END;
$$;

-- 5. ROW LEVEL SECURITY

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uber_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_attendance_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_attendance_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone authed can read, users update their own
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Events: anyone authed can read and create
CREATE POLICY "Anyone can view events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Authed users can create events" ON public.events FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update events" ON public.events FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete events" ON public.events FOR DELETE USING (auth.uid() = created_by);

-- Ride groups: anyone authed can read and create
CREATE POLICY "Anyone can view ride groups" ON public.ride_groups FOR SELECT USING (true);
CREATE POLICY "Authed users can create ride groups" ON public.ride_groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update ride groups" ON public.ride_groups FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete ride groups" ON public.ride_groups FOR DELETE USING (auth.uid() = created_by);

-- Ride members: anyone authed can read, users manage their own membership
CREATE POLICY "Anyone can view ride members" ON public.ride_members FOR SELECT USING (true);
CREATE POLICY "Authed users can join rides" ON public.ride_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their membership" ON public.ride_members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave rides" ON public.ride_members FOR DELETE USING (auth.uid() = user_id);

-- Event access
CREATE POLICY "Anyone can view event access" ON public.event_access FOR SELECT USING (true);
CREATE POLICY "Authed users can grant access" ON public.event_access FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Event interests
CREATE POLICY "Anyone can view interests" ON public.event_interests FOR SELECT USING (true);
CREATE POLICY "Users can express interest" ON public.event_interests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove interest" ON public.event_interests FOR DELETE USING (auth.uid() = user_id);

-- Event comments
CREATE POLICY "Anyone can view comments" ON public.event_comments FOR SELECT USING (true);
CREATE POLICY "Authed users can comment" ON public.event_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.event_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.event_comments FOR DELETE USING (auth.uid() = user_id);

-- Notifications: users see their own
CREATE POLICY "Users see own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Chat messages: ride members can read/write
CREATE POLICY "Anyone can view messages" ON public.ride_group_messages FOR SELECT USING (true);
CREATE POLICY "Authed users can send messages" ON public.ride_group_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Message reads
CREATE POLICY "Users manage own reads" ON public.ride_message_reads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert reads" ON public.ride_message_reads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update reads" ON public.ride_message_reads FOR UPDATE USING (auth.uid() = user_id);

-- Meeting votes
CREATE POLICY "Anyone can view votes" ON public.meeting_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote" ON public.meeting_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can change vote" ON public.meeting_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can remove vote" ON public.meeting_votes FOR DELETE USING (auth.uid() = user_id);

-- Uber payments
CREATE POLICY "Anyone can view payments" ON public.uber_payments FOR SELECT USING (true);
CREATE POLICY "Users can create payments" ON public.uber_payments FOR INSERT WITH CHECK (auth.uid() = payer_user_id);
CREATE POLICY "Users can update own payments" ON public.uber_payments FOR UPDATE USING (auth.uid() = payer_user_id);

-- Payment confirmations
CREATE POLICY "Anyone can view confirmations" ON public.payment_confirmations FOR SELECT USING (true);
CREATE POLICY "Users can confirm" ON public.payment_confirmations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payment reminders
CREATE POLICY "Users see own reminders" ON public.payment_reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create reminders" ON public.payment_reminders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update reminders" ON public.payment_reminders FOR UPDATE USING (auth.uid() = user_id);

-- Ride invites
CREATE POLICY "Anyone can view invites" ON public.ride_invites FOR SELECT USING (true);
CREATE POLICY "Authed users can create invites" ON public.ride_invites FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creators can update invites" ON public.ride_invites FOR UPDATE USING (auth.uid() = created_by);

-- Attendance surveys
CREATE POLICY "Anyone can view surveys" ON public.ride_attendance_surveys FOR SELECT USING (true);
CREATE POLICY "Authed can create surveys" ON public.ride_attendance_surveys FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authed can update surveys" ON public.ride_attendance_surveys FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Attendance responses
CREATE POLICY "Anyone can view responses" ON public.ride_attendance_responses FOR SELECT USING (true);
CREATE POLICY "Users can respond" ON public.ride_attendance_responses FOR INSERT WITH CHECK (auth.uid() = respondent_user_id);

-- Ride completions
CREATE POLICY "Anyone can view completions" ON public.ride_completions FOR SELECT USING (true);
CREATE POLICY "Authed can create completions" ON public.ride_completions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authed can update completions" ON public.ride_completions FOR UPDATE USING (auth.uid() IS NOT NULL);

-- User ratings
CREATE POLICY "Anyone can view ratings" ON public.user_ratings FOR SELECT USING (true);
CREATE POLICY "Users can rate" ON public.user_ratings FOR INSERT WITH CHECK (auth.uid() = rater_user_id);

-- User roles
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Calendar tokens
CREATE POLICY "Users manage own tokens" ON public.calendar_tokens FOR ALL USING (auth.uid() = user_id);

-- Email logs
CREATE POLICY "Authed can view logs" ON public.email_notification_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authed can create logs" ON public.email_notification_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Feedback
CREATE POLICY "Users can view own feedback" ON public.feedback_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can submit feedback" ON public.feedback_submissions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 6. ENABLE REALTIME for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_members;

-- 7. Create a trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view photos" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');
CREATE POLICY "Users can upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own photos" ON storage.objects FOR UPDATE USING (bucket_id = 'profile-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete own photos" ON storage.objects FOR DELETE USING (bucket_id = 'profile-photos' AND auth.uid() IS NOT NULL);
