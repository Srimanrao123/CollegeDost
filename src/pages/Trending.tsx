import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PostCard } from "@/components/posts/PostCard";
import { useTrendingPosts } from "@/hooks/useTrendingPosts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { deriveProfileHandle, getAvatarUrl, type ProfileHandleSource } from "@/lib/profileDisplay";

export interface TrendingPost {
  id: string;
  user_id: string;
  title: string | null;
  content: string | null;
  image_r2_key: string | null;
  category: string | null;
  exam_type?: string | null;
  created_at: string;
  comments_count: number;
  views_count: number;
  likes_count?: number;
  trend_score?: number;
  tags: string[];
  slug?: string | null;
  profiles?: {
    username?: string | null;
    full_name?: string | null;
    avatar_r2_key?: string | null;
    avatar_url?: string | null;
  };
}

type SortOption = "trending" | "latest" | "popular";

const Trending = () => {
  const { isAuthenticated } = useAuth();
  const [sortBy, setSortBy] = useState<SortOption>("trending");

  // Show 10 posts for non-authenticated users, 25 for authenticated users
  const postLimit = isAuthenticated ? 25 : 10;
  const { posts, loading } = useTrendingPosts(postLimit);

  const sortedPosts = useMemo(() => {
    const copy = [...posts];
    switch (sortBy) {
      case "latest":
        return copy.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case "popular":
        return copy.sort((a, b) => {
          const scoreA = (a.likes_count || 0) + (a.comments_count || 0);
          const scoreB = (b.likes_count || 0) + (b.comments_count || 0);
          return scoreB - scoreA;
        });
      case "trending":
      default:
        return copy.sort((a, b) => (b.trend_score || 0) - (a.trend_score || 0));
    }
  }, [posts, sortBy]);

  // Extra guard in case hook returns more than the client limit
  const displayedPosts = isAuthenticated ? sortedPosts : sortedPosts.slice(0, 10);

  const getTimeAgo = (dateString: string) =>
    formatDistanceToNow(new Date(dateString), { addSuffix: true });

  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Trending Posts</h1>
          <p className="text-sm text-muted-foreground">Check out what the community is talking about right now.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trending">Trending</SelectItem>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="popular">Most Liked</SelectItem>
            </SelectContent>
          </Select>
          </div>
        </div>

      {displayedPosts.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          No trending posts yet. Check back soon!
          </Card>
        ) : (
            <div className="space-y-4">
              {displayedPosts.map((post) => (
                <PostCard 
                  key={post.id}
                  id={post.id}
                  slug={post.slug || null}
                  authorId={post.user_id}
              author={deriveProfileHandle(post.profiles as ProfileHandleSource | null, "anonymous")}
              timeAgo={getTimeAgo(post.created_at)}
              title={post.title || post.content?.substring(0, 100) || "Untitled"}
              content={post.content || ""}
              imageR2Key={post.image_r2_key || null}
                  category={post.category}
              examType={post.exam_type || ""}
                  comments={post.comments_count || 0}
                  views={post.views_count || 0}
                  tags={post.tags || []}
                  avatarUrl={getAvatarUrl(post.profiles, 40) || undefined}
                />
              ))}
            </div>
        )}
      </div>
  );
};

export default Trending;
