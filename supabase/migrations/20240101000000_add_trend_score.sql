-- Add trend_score column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS trend_score NUMERIC DEFAULT 0;

-- Create index for efficient sorting by trend_score
CREATE INDEX IF NOT EXISTS idx_posts_trend_score ON posts(trend_score DESC);

-- Function to calculate trend score
CREATE OR REPLACE FUNCTION calculate_trend_score(
  likes INTEGER,
  comments INTEGER,
  views INTEGER,
  created_at TIMESTAMPTZ
) RETURNS NUMERIC AS $$
DECLARE
  age_hours NUMERIC;
  decay_factor NUMERIC;
  base_score NUMERIC;
BEGIN
  -- Calculate age in hours
  age_hours := EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600;
  
  -- Calculate decay factor: exp(-age_hours / 24)
  decay_factor := EXP(-age_hours / 24.0);
  
  -- Calculate base score: (likes * 3 + comments * 5 + views * 0.2)
  base_score := (COALESCE(likes, 0) * 3.0) + 
                (COALESCE(comments, 0) * 5.0) + 
                (COALESCE(views, 0) * 0.2);
  
  -- Return final trend score
  RETURN base_score * decay_factor;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update trend score for a post
CREATE OR REPLACE FUNCTION update_post_trend_score()
RETURNS TRIGGER AS $$
DECLARE
  views_count INTEGER;
BEGIN
  -- Get views count from post_views table
  SELECT COUNT(*) INTO views_count
  FROM post_views
  WHERE post_id = NEW.id;
  
  -- Calculate and set trend_score
  NEW.trend_score := calculate_trend_score(
    NEW.likes_count,
    NEW.comments_count,
    views_count,
    NEW.created_at
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update trend_score on INSERT
DROP TRIGGER IF EXISTS update_trend_score_on_insert ON posts;
CREATE TRIGGER update_trend_score_on_insert
  BEFORE INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_post_trend_score();

-- Trigger to update trend_score on UPDATE of likes_count or comments_count
DROP TRIGGER IF EXISTS update_trend_score_on_update ON posts;
CREATE TRIGGER update_trend_score_on_update
  BEFORE UPDATE OF likes_count, comments_count ON posts
  FOR EACH ROW
  WHEN (OLD.likes_count IS DISTINCT FROM NEW.likes_count OR 
        OLD.comments_count IS DISTINCT FROM NEW.comments_count)
  EXECUTE FUNCTION update_post_trend_score();

-- Function to recalculate all trend scores (for periodic updates)
CREATE OR REPLACE FUNCTION recalculate_all_trend_scores()
RETURNS void AS $$
BEGIN
  UPDATE posts
  SET trend_score = calculate_trend_score(
    likes_count,
    comments_count,
    (SELECT COUNT(*) FROM post_views WHERE post_views.post_id = posts.id),
    created_at
  );
END;
$$ LANGUAGE plpgsql;

-- Initial calculation of trend scores for existing posts
DO $$
BEGIN
  PERFORM recalculate_all_trend_scores();
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_trend_score TO authenticated;
GRANT EXECUTE ON FUNCTION update_post_trend_score TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_all_trend_scores TO service_role;
