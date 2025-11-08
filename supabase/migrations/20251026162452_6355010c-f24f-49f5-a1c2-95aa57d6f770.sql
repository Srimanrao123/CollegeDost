-- Add category column to posts table for Explore filtering
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS category text DEFAULT 'General';

-- Add followers_count and following_count to profiles for performance
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS followers_count integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS following_count integer DEFAULT 0;

-- Create function to update follower counts
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment following count for follower
    UPDATE public.profiles
    SET following_count = following_count + 1
    WHERE id = NEW.follower_id;
    
    -- Increment followers count for following
    UPDATE public.profiles
    SET followers_count = followers_count + 1
    WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement following count for follower
    UPDATE public.profiles
    SET following_count = following_count - 1
    WHERE id = OLD.follower_id;
    
    -- Decrement followers count for following
    UPDATE public.profiles
    SET followers_count = followers_count - 1
    WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for follow counts
DROP TRIGGER IF EXISTS update_follow_counts_trigger ON public.follows;
CREATE TRIGGER update_follow_counts_trigger
AFTER INSERT OR DELETE ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.update_follow_counts();

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;