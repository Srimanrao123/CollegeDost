-- Create RPC function to get tag popularity
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
