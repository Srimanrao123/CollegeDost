-- Add missing indexes for query optimization
-- These indexes support the optimized queries in the codebase

-- COMMENTS: Index on post_id for filtering comments by post
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);

-- COMMENTS: Composite index for post_id + created_at (common query pattern)
CREATE INDEX IF NOT EXISTS idx_comments_post_id_created_at ON public.comments(post_id, created_at DESC);

-- COMMENTS: Composite index for user_id + created_at (for user's comments)
CREATE INDEX IF NOT EXISTS idx_comments_user_id_created_at ON public.comments(user_id, created_at DESC);

-- LIKES: Index on post_id for filtering likes by post
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes(post_id);

-- LIKES: Composite index for post_id + user_id (common lookup pattern)
CREATE INDEX IF NOT EXISTS idx_likes_post_id_user_id ON public.likes(post_id, user_id) WHERE comment_id IS NULL;

-- LIKES: Composite index for comment_id + user_id (common lookup pattern)
CREATE INDEX IF NOT EXISTS idx_likes_comment_id_user_id ON public.likes(comment_id, user_id) WHERE post_id IS NULL;

-- LIKES: Index on user_id for filtering likes by user
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);

-- NOTIFICATIONS: Composite index for user_id + created_at (common query pattern)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON public.notifications(user_id, created_at DESC);

-- NOTIFICATIONS: Composite index for user_id + read (for filtering unread)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, read) WHERE read = false;

-- POSTS: Index on user_id + created_at (for user's posts)
CREATE INDEX IF NOT EXISTS idx_posts_user_id_created_at ON public.posts(user_id, created_at DESC);

-- POSTS: Composite index for topic_id + created_at (for topic filtering)
CREATE INDEX IF NOT EXISTS idx_posts_topic_id_created_at ON public.posts(topic_id, created_at DESC) WHERE topic_id IS NOT NULL;

-- POSTS: Index on exam_type for filtering (if not exists)
CREATE INDEX IF NOT EXISTS idx_posts_exam_type ON public.posts(exam_type) WHERE exam_type IS NOT NULL;

