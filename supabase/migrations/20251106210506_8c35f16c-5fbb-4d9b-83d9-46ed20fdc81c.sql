
-- Add missing notification type for attendance surveys
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'attendance_survey';
