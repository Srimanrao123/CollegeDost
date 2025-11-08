-- Create topics table
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add topic_id column to posts table if it doesn't exist
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL;

-- Add tags column to posts table if it doesn't exist (as text array)
ALTER TABLE public.posts 
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON public.posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_posts_tags ON public.posts USING GIN(tags);

-- Create a function to get unique tags from all posts
CREATE OR REPLACE FUNCTION public.get_unique_tags()
RETURNS TABLE(tag TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT unnest(tags) as tag
  FROM public.posts
  WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
  ORDER BY tag;
END;
$$;

-- Insert some default topics
INSERT INTO public.topics (name, description) VALUES
  ('Engineering', 'Engineering-related posts and discussions'),
  ('Medical', 'Medical and healthcare topics'),
  ('MBA', 'Master of Business Administration discussions'),
  ('CA', 'Chartered Accountancy topics'),
  ('Law', 'Legal studies and discussions'),
  ('Science', 'Science and research topics'),
  ('Commerce', 'Commerce and business topics')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS if needed
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Create policy to allow everyone to read topics
CREATE POLICY "Topics are viewable by everyone"
  ON public.topics FOR SELECT
  USING (true);

