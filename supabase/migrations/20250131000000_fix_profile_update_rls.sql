-- Fix RLS policy for profile updates
-- The existing policy only has USING clause, but UPDATE policies need WITH CHECK clause as well

-- Ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing update policies on profiles (in case there are duplicates or variations)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND cmd = 'UPDATE'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
    END LOOP;
END $$;

-- Create updated policy with both USING and WITH CHECK clauses
-- USING: checks if user can access the row to update
-- WITH CHECK: validates the updated row still meets policy conditions
-- Both are REQUIRED for UPDATE operations in Supabase
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Verify the policy was created
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can update their own profile'
        AND cmd = 'UPDATE'
    ) THEN
        RAISE EXCEPTION 'Policy creation failed!';
    END IF;
END $$;

