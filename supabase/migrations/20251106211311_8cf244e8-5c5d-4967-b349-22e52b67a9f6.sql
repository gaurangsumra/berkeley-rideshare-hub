-- Add reminder tracking column
ALTER TABLE ride_attendance_surveys 
ADD COLUMN reminder_sent_at timestamp with time zone;

-- Add reminder notification type
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'attendance_survey_reminder';