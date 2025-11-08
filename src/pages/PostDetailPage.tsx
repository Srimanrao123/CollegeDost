import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, ThumbsUp, Share2, Loader2 } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useLikes } from "@/hooks/useLikes";
import { supabase } from "@/integrations/supabase/client";
import { CommentSection } from "@/components/posts/CommentSection";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { usePostView } from "@/hooks/usePostView";
import { createRealtimeChannel } from "@/lib/realtime";
import { removeTagsFromContent } from "@/lib/utils";
import { deriveProfileHandle, deriveProfileInitial, type ProfileHandleSource } from "@/lib/profileDisplay";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { toast } from "sonner";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasLiked, likesCount, toggleLike } = useLikes(id!, user?.id);

  
  const handleLike = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    toggleLike();
  };

  const handleSharePost = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    const shareUrl = `${window.location.origin}/post/${id}`;
    navigator.clipboard.writeText(shareUrl);
    toast( "Post link copied to your clipboard");
  };
  const { startTrackingPostView, stopTrackingPostView } = useNotificationTriggers();

  // Track post view
  usePostView(id);

  // Start tracking post view time for follow-up notifications
  useEffect(() => {
    if (id && user) {
      startTrackingPostView(id);
      return () => {
        stopTrackingPostView(id);
      };
    }
  }, [id, user, startTrackingPostView, stopTrackingPostView]);

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch post
        const { data: postData, error: fetchError } = await supabase
          .from("posts")
          .select("*")
          .eq("id", id)
          .single();

        if (fetchError) throw fetchError;

        if (postData) {
          // Fetch profile
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .eq("id", postData.user_id)
            .single();

          // Fetch tags through post_tags junction table
          const { data: postTagsData } = await (supabase as any)
            .from('post_tags')
            .select('tag_id, tags(name)')
            .eq('post_id', id);

          const tags = postTagsData?.map((pt: any) => pt.tags?.name).filter(Boolean) || [];

          setPost({
            ...postData,
            profiles: profileData,
            tags: tags // Override with tags from post_tags
          });
        }
      } catch (err: any) {
        console.error("Error fetching post:", err);
        setError(err.message || "Failed to fetch post");
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  // Scoped realtime subscriptions for post detail page
  useEffect(() => {
    if (!id) return;
    if (typeof window === "undefined") return; // SSR guard

    const refetchPost = async () => {
      try {
        const { data: postData, error: fetchError } = await supabase
          .from("posts")
          .select("*")
          .eq("id", id)
          .single();

        if (!fetchError && postData) {
          // Fetch profile
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .eq("id", postData.user_id)
            .single();

          // Fetch tags
          const { data: postTagsData } = await (supabase as any)
            .from('post_tags')
            .select('tag_id, tags(name)')
            .eq('post_id', id);

          const tags = postTagsData?.map((pt: any) => pt.tags?.name).filter(Boolean) || [];

          setPost({
            ...postData,
            profiles: profileData,
            tags: tags
          });
        }
      } catch (err) {
        console.error("Error refetching post:", err);
      }
    };

    const rt = createRealtimeChannel(`realtime:post-detail:${id}`);

    // Listen to post updates
    rt.onPostgresChange(
      { table: "posts", event: "UPDATE", filter: `id=eq.${id}` },
      () => {
        refetchPost();
      }
    );

    // Listen to likes changes (for immediate UI updates)
    rt.onPostgresChange(
      { table: "likes", event: "*", filter: `post_id=eq.${id}` },
      () => {
        // Likes hook will handle the actual count update
        // This subscription ensures immediate visibility
      }
    );

    // Listen to comments changes (for immediate UI updates)
    rt.onPostgresChange(
      { table: "comments", event: "*", filter: `post_id=eq.${id}` },
      () => {
        // Comments hook will handle the actual updates
        // This subscription ensures immediate visibility
      }
    );

    rt.subscribe().catch((err: any) => {
      console.error("Failed to subscribe to post detail realtime:", err);
    });

    return () => {
      rt.unsubscribe();
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Post not found.</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link to="/">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Link>
      </Button>

      <Card className="p-6 mb-6">
        {/* Post Header */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.profiles?.avatar_url} />
            <AvatarFallback>
              {deriveProfileInitial(post.profiles as ProfileHandleSource | null)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link
                to={`/profile/${post.user_id}`}
                className="font-semibold hover:underline"
              >
                {deriveProfileHandle(post.profiles as ProfileHandleSource | null, "anonymous")}
              </Link>
              <span className="text-sm text-muted-foreground">
                • {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
            </div>
            {post.category && (
              <span className="text-xs text-muted-foreground">{post.category}</span>
            )}
          </div>
        </div>

        {/* Post Title */}
        {post.title && (
          <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
        )}

        {/* Post Content */}
        {post.content && (
          <p className="text-base mb-4 whitespace-pre-wrap">
            {removeTagsFromContent(post.content, post.tags || [])}
          </p>
        )}

        {/* Post Tags - Display tags from post_tags table */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag: string, idx: number) => (
              <span
                key={idx}
                className="px-2 py-1 text-xs bg-secondary rounded-full hover:bg-secondary/80 cursor-pointer transition-colors"
                onClick={() => {
                  // Navigate to tag filter page
                  window.location.href = `/?tag=${tag}`;
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Post Image */}
        {post.image_url && (
          <div className="relative w-full bg-muted">
            <img
              src={post.image_url}
              alt={post.title || "Post image"}
              className="max-w-full h-auto"
              loading="eager"
              decoding="async"
            />
          </div>
        )}

        {/* Post Link */}
        {post.link_url && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 border rounded-lg hover:bg-secondary/50 transition-colors mb-4"
          >
            <span className="text-sm text-primary hover:underline">
              {post.link_url}
            </span>
          </a>
        )}

        {/* Post Actions */}
        <div className="flex items-center gap-4 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 hover:bg-transparent"
            onClick={handleLike}
          >
            <ThumbsUp
              className={`h-5 w-5 transition-colors ${
                hasLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"
              }`}
            />
            <span className="font-medium">{likesCount}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2  text-muted-foreground"
            onClick={handleSharePost}
          >
            <Share2 className="h-5 w-5" 
             />
            Share
          </Button>
          <span className="ml-auto text-sm text-muted-foreground">
            {post.comments_count || 0} comments
          </span>
        </div>
      </Card>

      {/* Comments Section */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Comments</h2>
        <CommentSection postId={id!} />
      </Card>
    </div>
  );
}
