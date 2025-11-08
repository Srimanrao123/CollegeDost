-- Diagnostic query to check current RLS policies on profiles table
-- Run this first to see what policies exist

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY policyname;

