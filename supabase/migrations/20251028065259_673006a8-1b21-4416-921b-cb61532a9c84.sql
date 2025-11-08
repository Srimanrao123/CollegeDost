-- Update profiles table to support multi-select entrance exams and interested exams
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS entrance_exam;

ALTER TABLE public.profiles 
  ADD COLUMN entrance_exam text[] DEFAULT '{}',
  ADD COLUMN interested_exams text[] DEFAULT '{}';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_state ON public.profiles(state);
CREATE INDEX IF NOT EXISTS idx_profiles_entrance_exam ON public.profiles USING GIN(entrance_exam);
CREATE INDEX IF NOT EXISTS idx_profiles_interested_exams ON public.profiles USING GIN(interested_exams);