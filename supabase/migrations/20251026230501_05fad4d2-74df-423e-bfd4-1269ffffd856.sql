-- Create payment_confirmations table
CREATE TABLE payment_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uber_payment_id UUID NOT NULL REFERENCES uber_payments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(uber_payment_id, user_id)
);

ALTER TABLE payment_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view confirmations for their rides"
  ON payment_confirmations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM uber_payments up
      JOIN ride_members rm ON rm.ride_id = up.ride_id
      WHERE up.id = payment_confirmations.uber_payment_id
      AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can confirm their own payments"
  ON payment_confirmations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create payment_reminders table
CREATE TABLE payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uber_payment_id UUID NOT NULL REFERENCES uber_payments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_reminder_sent TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reminder_count INTEGER DEFAULT 0,
  payment_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(uber_payment_id, user_id)
);

ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders"
  ON payment_reminders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Update uber_payments table
ALTER TABLE uber_payments 
  ADD COLUMN IF NOT EXISTS payer_venmo_username TEXT,
  ADD COLUMN IF NOT EXISTS cost_type TEXT DEFAULT 'rideshare';

-- Add check constraint separately to avoid issues
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uber_payments_cost_type_check'
  ) THEN
    ALTER TABLE uber_payments 
    ADD CONSTRAINT uber_payments_cost_type_check 
    CHECK (cost_type IN ('rideshare', 'gas'));
  END IF;
END $$;

-- Add new notification types
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM ('ride_invite', 'new_message', 'attendance_survey');
  END IF;
  
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_amount_entered';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_reminder';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_confirmed';
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'venmo_required';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;