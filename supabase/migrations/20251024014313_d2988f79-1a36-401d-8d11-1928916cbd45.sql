-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo TEXT,
  program TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_time TIMESTAMP WITH TIME ZONE NOT NULL,
  destination TEXT NOT NULL,
  city TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Anyone can view events"
  ON public.events FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Event creators can update their events"
  ON public.events FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Event creators can delete their events"
  ON public.events FOR DELETE
  USING (auth.uid() = created_by);

-- Create ride_groups table
CREATE TABLE public.ride_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
  travel_mode TEXT NOT NULL CHECK (travel_mode IN ('Self-Driving', 'Uber')),
  meeting_point TEXT,
  capacity INTEGER DEFAULT 4 CHECK (capacity > 0 AND capacity <= 4),
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ride_groups ENABLE ROW LEVEL SECURITY;

-- Ride groups policies
CREATE POLICY "Anyone can view ride groups"
  ON public.ride_groups FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create ride groups"
  ON public.ride_groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creators can update their groups"
  ON public.ride_groups FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Group creators can delete their groups"
  ON public.ride_groups FOR DELETE
  USING (auth.uid() = created_by);

-- Create ride_members table
CREATE TABLE public.ride_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.ride_groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('driver', 'rider', 'payer')),
  status TEXT DEFAULT 'joined' CHECK (status IN ('joined', 'cancelled')),
  willing_to_pay BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ride_id, user_id)
);

ALTER TABLE public.ride_members ENABLE ROW LEVEL SECURITY;

-- Ride members policies
CREATE POLICY "Anyone can view ride members"
  ON public.ride_members FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can join rides"
  ON public.ride_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members can update their own membership"
  ON public.ride_members FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Members can delete their own membership"
  ON public.ride_members FOR DELETE
  USING (auth.uid() = user_id);

-- Create meeting_votes table
CREATE TABLE public.meeting_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.ride_groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  vote_option TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ride_id, user_id, vote_option)
);

ALTER TABLE public.meeting_votes ENABLE ROW LEVEL SECURITY;

-- Meeting votes policies
CREATE POLICY "Ride members can view votes for their rides"
  ON public.meeting_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ride_members
      WHERE ride_id = meeting_votes.ride_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Ride members can vote"
  ON public.meeting_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.ride_members
      WHERE ride_id = meeting_votes.ride_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own votes"
  ON public.meeting_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Create uber_payments table
CREATE TABLE public.uber_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.ride_groups(id) ON DELETE CASCADE NOT NULL,
  payer_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2),
  venmo_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.uber_payments ENABLE ROW LEVEL SECURITY;

-- Uber payments policies
CREATE POLICY "Ride members can view payments for their rides"
  ON public.uber_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ride_members
      WHERE ride_id = uber_payments.ride_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Payers can create payment records"
  ON public.uber_payments FOR INSERT
  WITH CHECK (auth.uid() = payer_user_id);

CREATE POLICY "Payers can update their payment records"
  ON public.uber_payments FOR UPDATE
  USING (auth.uid() = payer_user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, photo, program, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'program', 'Not specified'),
    new.email
  );
  RETURN new;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();