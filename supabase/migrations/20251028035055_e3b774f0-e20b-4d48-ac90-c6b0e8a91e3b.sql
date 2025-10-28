-- Create email notification logs table
CREATE TABLE public.email_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.ride_groups(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.ride_group_messages(id) ON DELETE SET NULL,
  recipient_emails TEXT[] NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'new_chat_message',
  success BOOLEAN NOT NULL DEFAULT false,
  failed_recipients TEXT[],
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.email_notification_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to view all logs
CREATE POLICY "Admins can view all email logs"
ON public.email_notification_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create policy for system to insert logs
CREATE POLICY "System can insert email logs"
ON public.email_notification_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_email_logs_ride_id ON public.email_notification_logs(ride_id);
CREATE INDEX idx_email_logs_sent_at ON public.email_notification_logs(sent_at DESC);