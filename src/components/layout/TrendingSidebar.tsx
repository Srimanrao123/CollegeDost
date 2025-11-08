import { TrendingUp, Loader2, ThumbsUp, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useTrendingPosts } from "@/hooks/useTrendingPosts";
import { formatDistanceToNow } from "date-fns";
import { cn, removeTagsFromContent } from "@/lib/utils";
import { deriveProfileHandle, deriveProfileInitial, type ProfileHandleSource } from "@/lib/profileDisplay";

export const TrendingSidebar = () => {
  const { posts, loading } = useTrendingPosts(8); // Show top 8 trending posts

  return (
    <aside className="hidden xl:block w-80 border-l bg-card h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-lg">Trending Now</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No trending posts yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post, index) => (
              <Link key={post.id} to={`/post/${post.id}`}>
                <Card className="p-3 hover:bg-secondary/50 transition-all cursor-pointer hover:shadow-md border-l-4 border-l-transparent hover:border-l-primary">
                  <div className="flex items-start gap-3">
                    {/* Trending Rank Badge */}
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                      index === 0 ? "bg-yellow-500 text-white" :
                      index === 1 ? "bg-gray-400 text-white" :
                      index === 2 ? "bg-orange-600 text-white" :
                      "bg-primary/10 text-primary"
                    )}>
                      {index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Author Info */}
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={post.profiles?.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {deriveProfileInitial(post.profiles as ProfileHandleSource | null)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium truncate">
                          {deriveProfileHandle(post.profiles as ProfileHandleSource | null, "anonymous")}
                        </span>
                      </div>
                      
                      {/* Post Title/Content */}
                      <p className="text-sm font-semibold line-clamp-2 mb-2">
                        {post.title || removeTagsFromContent(post.content, post.tags || []) || 'No content'}
                      </p>


                      {/* Tags */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {post.tags.slice(0, 2).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full"
                            >
                              #{tag}
                            </span>
                          ))}
                          {post.tags.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{post.tags.length - 2}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Engagement Stats */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          <span>{post.likes_count || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          <span>{post.comments_count || 0}</span>
                        </div>
                        <span className="text-xs ml-auto">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </span>
                      </div>

                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {!loading && posts.length > 0 && (
          <div className="pt-4 border-t">
            <Link to="/trending">
              <button className="w-full text-sm text-primary hover:underline font-medium">
                View all trending posts →
              </button>
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
};
