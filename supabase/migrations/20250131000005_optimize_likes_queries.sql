-- Optimize likes queries with partial indexes
-- These indexes are specifically designed for the query pattern:
-- WHERE post_id = ? AND comment_id IS NULL

-- Partial index for post likes count queries (most common pattern)
-- This index is highly efficient for count queries on post likes
-- It only indexes rows where comment_id IS NULL, reducing index size
CREATE INDEX IF NOT EXISTS idx_likes_post_id_comment_null 
ON public.likes(post_id) 
WHERE comment_id IS NULL;

-- Partial index for post likes with created_at (for keyset pagination if needed)
-- This supports efficient pagination of likes for a post
CREATE INDEX IF NOT EXISTS idx_likes_post_id_created_at_comment_null 
ON public.likes(post_id, created_at DESC) 
WHERE comment_id IS NULL;

-- Partial index for comment likes count queries
-- This index is for comment likes (where post_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_likes_comment_id_post_null 
ON public.likes(comment_id) 
WHERE post_id IS NULL;

-- Note: The existing idx_likes_post_id_user_id index is still useful for
-- checking if a specific user has liked a post, but the partial indexes above
-- are more efficient for count queries and pagination.

