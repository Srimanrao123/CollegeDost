-- Add tags column to posts table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'posts' 
        AND column_name = 'tags'
    ) THEN
        ALTER TABLE posts ADD COLUMN tags TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;
END $$;

-- Create index on tags for better performance
CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING GIN(tags);

-- Create tags table if it doesn't exist
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create post_tags junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS post_tags (
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (post_id, tag_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Enable RLS on tags table
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- Enable RLS on post_tags table
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;

-- Create policies for tags (read-only for all, insert for authenticated)
CREATE POLICY IF NOT EXISTS "Anyone can view tags" ON tags
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can insert tags" ON tags
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create policies for post_tags (read-only for all, insert for authenticated)
CREATE POLICY IF NOT EXISTS "Anyone can view post_tags" ON post_tags
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can insert post_tags" ON post_tags
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Users can delete their post_tags" ON post_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM posts 
            WHERE posts.id = post_tags.post_id 
            AND posts.user_id = auth.uid()
        )
    );
