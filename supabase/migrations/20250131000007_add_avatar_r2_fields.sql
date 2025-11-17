-- Add avatar_r2_key and avatar_r2_migrated columns to profiles table
-- These columns support migration from Supabase Storage to Cloudflare R2

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS avatar_r2_key TEXT;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS avatar_r2_migrated BOOLEAN DEFAULT false;

-- Create index on avatar_r2_key for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_r2_key ON public.profiles(avatar_r2_key);

-- Create index on avatar_r2_migrated for migration queries
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_r2_migrated ON public.profiles(avatar_r2_migrated);

