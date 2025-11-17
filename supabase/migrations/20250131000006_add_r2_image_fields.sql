-- Add R2 image fields to posts table for migration from Supabase Storage to Cloudflare R2
-- This allows gradual migration without breaking existing posts

-- Add image_r2_key column to store the R2 key/path
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS image_r2_key TEXT;

-- Add image_r2_migrated flag to track migration status
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS image_r2_migrated BOOLEAN DEFAULT false;

-- Create index on migration flag for efficient querying during migration
CREATE INDEX IF NOT EXISTS idx_posts_image_r2_migrated 
  ON public.posts(image_r2_migrated) 
  WHERE image_r2_migrated = false;

-- Create index on image_r2_key for efficient lookups
CREATE INDEX IF NOT EXISTS idx_posts_image_r2_key 
  ON public.posts(image_r2_key) 
  WHERE image_r2_key IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.posts.image_r2_key IS 'Cloudflare R2 key/path for the post image. Takes precedence over image_url when present.';
COMMENT ON COLUMN public.posts.image_r2_migrated IS 'Flag indicating if the image has been migrated from Supabase Storage to R2.';

