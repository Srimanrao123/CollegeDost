-- Add onboarding fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS entrance_exam TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add check constraint for entrance_exam values
ALTER TABLE public.profiles
ADD CONSTRAINT entrance_exam_type CHECK (entrance_exam IN ('Competitive Exam', 'Board Exam', NULL));