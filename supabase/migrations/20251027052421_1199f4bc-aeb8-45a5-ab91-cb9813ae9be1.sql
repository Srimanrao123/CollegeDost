-- Add parent_id column to comments table for threaded/nested comments
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

-- Create index for better performance when querying nested comments
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);

-- Add sorting column (helpful for "Best" sorting)
CREATE INDEX IF NOT EXISTS idx_comments_likes_count ON public.comments(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at DESC);