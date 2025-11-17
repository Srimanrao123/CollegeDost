-- Create index on posts.created_at for efficient filtering and sorting
-- This is critical for queries that filter by date range and order by created_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc ON public.posts(created_at DESC);

-- Create composite index for trending queries that filter by date and order by created_at
-- This can help with queries that filter by created_at >= date AND order by created_at DESC
CREATE INDEX IF NOT EXISTS idx_posts_created_at_trend_score ON public.posts(created_at DESC, trend_score DESC NULLS LAST);

