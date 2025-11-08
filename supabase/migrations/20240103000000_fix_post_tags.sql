-- Ensure post_tags table exists with proper structure
CREATE TABLE IF NOT EXISTS post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, tag_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags(tag_id);

-- Enable RLS
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for post_tags
DROP POLICY IF EXISTS "Anyone can read post_tags" ON post_tags;
CREATE POLICY "Anyone can read post_tags" ON post_tags
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert post_tags" ON post_tags;
CREATE POLICY "Authenticated users can insert post_tags" ON post_tags
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete their own post_tags" ON post_tags;
CREATE POLICY "Users can delete their own post_tags" ON post_tags
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_tags.post_id
      AND posts.user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON post_tags TO authenticated, anon;

-- Update get_tag_popularity function to not return post_count
CREATE OR REPLACE FUNCTION get_tag_popularity()
RETURNS TABLE (
  name TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.name,
    COUNT(pt.post_id) as count
  FROM tags t
  LEFT JOIN post_tags pt ON t.id = pt.tag_id
  GROUP BY t.id, t.name
  ORDER BY count DESC, t.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get posts by tags with ANY or ALL mode
CREATE OR REPLACE FUNCTION get_posts_by_tags(
  tag_names TEXT[],
  match_mode TEXT DEFAULT 'any'
)
RETURNS TABLE (
  post_id UUID
) AS $$
BEGIN
  IF match_mode = 'all' THEN
    -- ALL mode: post must have ALL selected tags
    RETURN QUERY
    SELECT DISTINCT p.id as post_id
    FROM posts p
    WHERE (
      SELECT COUNT(DISTINCT pt.tag_id)
      FROM post_tags pt
      INNER JOIN tags t ON pt.tag_id = t.id
      WHERE pt.post_id = p.id
      AND LOWER(t.name) = ANY(SELECT LOWER(unnest(tag_names)))
    ) = array_length(tag_names, 1);
  ELSE
    -- ANY mode: post must have at least ONE selected tag
    RETURN QUERY
    SELECT DISTINCT p.id as post_id
    FROM posts p
    INNER JOIN post_tags pt ON p.id = pt.post_id
    INNER JOIN tags t ON pt.tag_id = t.id
    WHERE LOWER(t.name) = ANY(SELECT LOWER(unnest(tag_names)));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_posts_by_tags TO authenticated, anon;

COMMENT ON TABLE post_tags IS 'Junction table linking posts to tags';
COMMENT ON FUNCTION get_posts_by_tags IS 'Fetch posts filtered by tags with ANY or ALL matching mode';
