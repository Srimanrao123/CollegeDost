import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ArrowLeft, ThumbsUp, Share2 } from "lucide-react";
import { useComments } from "@/hooks/useComments";
import { CommentThread } from "@/components/posts/CommentThread";
import { supabase } from "@/integrations/supabase/client";
import { useLikes } from "@/hooks/useLikes";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { removeTagsFromContent } from "@/lib/utils";
import { deriveProfileHandle, deriveProfileInitial, type ProfileHandleSource } from "@/lib/profileDisplay";

export default function CommentThreadPage() {
  const { postId = "", commentId = "" } = useParams<{ postId: string; commentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { comments, loading: commentsLoading } = useComments(postId || null);
  const [rootComment, setRootComment] = useState<any | null>(null);
  const [parentComment, setParentComment] = useState<any | null>(null); // NEW: track parent
  const [post, setPost] = useState<any>(null);
  const [postLoading, setPostLoading] = useState(true);
  const { hasLiked, likesCount, toggleLike } = useLikes(postId!, user?.id);
  const maxDepth = useMemo(() => {
    // Tailwind md breakpoint ~768px
    return window.matchMedia('(max-width: 767px)').matches ? 3 : 6;
  }, []);

  // Find the selected comment and its subtree from the full tree
  const findSubtree = (nodes: any[], id: string): any | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.replies && node.replies.length > 0) {
        const found = findSubtree(node.replies, id);
        if (found) return found;
      }
    }
    return null;
  };

  // NEW: Find parent comment of current comment
  const findParentComment = (nodes: any[], targetId: string, parent: any = null): any | null => {
    for (const node of nodes) {
      if (node.id === targetId) {
        return parent;
      }
      if (node.replies && node.replies.length > 0) {
        const found = findParentComment(node.replies, targetId, node);
        if (found !== null) return found;
      }
    }
    return null;
  };

  // Fetch post data
  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;

      try {
        setPostLoading(true);
        const { data: postData, error } = await supabase
          .from("posts")
          .select("*")
          .eq("id", postId)
          .single();

        if (error) throw error;

        if (postData) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .eq("id", postData.user_id)
            .single();

          const { data: postTagsData } = await (supabase as any)
            .from('post_tags')
            .select('tag_id, tags(name)')
            .eq('post_id', postId);

          const tags = postTagsData?.map((pt: any) => pt.tags?.name).filter(Boolean) || [];

          setPost({
            ...postData,
            profiles: profileData,
            tags: tags
          });
        }
      } catch (error) {
        console.error("Error fetching post:", error);
      } finally {
        setPostLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  // Find comment subtree and parent
  useEffect(() => {
    if (!commentsLoading && comments && commentId) {
      const subtree = findSubtree(comments as any[], commentId);
      setRootComment(subtree);
      
      // Find parent comment
      const parent = findParentComment(comments as any[], commentId);
      setParentComment(parent);
    }
  }, [comments, commentsLoading, commentId]);

  // NEW: Handle back navigation
  const handleBackToParent = () => {
    if (parentComment) {
      // Navigate to parent comment thread
      navigate(`/post/${postId}/comment/${parentComment.id}`);
    } else {
      // Navigate to full post (this is a top-level comment)
      navigate(`/post/${postId}`);
    }
  };

  if (postLoading || commentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post || !rootComment) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">We couldn't find that comment thread.</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go back
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handleBackToParent}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {parentComment ? "Back to parent comment" : "Back to post"}
          </Button>
          
          <Link 
            to={`/post/${postId}`} 
            className="text-sm text-muted-foreground hover:underline"
          >
            View full post
          </Link>
        </div>

        {/* Show Original Post (same as PostDetailPage) */}
        <Card className="p-6">
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

          {post.title && <h1 className="text-2xl font-bold mb-4">{post.title}</h1>}
          {post.content && (
            <p className="text-base mb-4 whitespace-pre-wrap">
              {removeTagsFromContent(post.content, post.tags || [])}
            </p>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag: string, idx: number) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs bg-secondary rounded-full hover:bg-secondary/80 cursor-pointer transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {post.image_url && (
            <div className="relative w-full flex justify-center bg-muted/30 rounded-lg p-4 mb-4">
              <img
                src={post.image_url}
                alt="Post content"
                className="max-w-full h-auto object-contain rounded-lg shadow-md"
                style={{ maxHeight: "500px" }}
                loading="eager"
              />
            </div>
          )}

          {post.link_url && (
            <a
              href={post.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 border rounded-lg hover:bg-secondary/50 transition-colors mb-4"
            >
              <span className="text-sm text-primary hover:underline">{post.link_url}</span>
            </a>
          )}

          <div className="flex items-center gap-4 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 hover:bg-transparent"
              onClick={() => {
                if (!user) {
                  navigate('/auth');
                  return;
                }
                toggleLike();
              }}
            >
              <ThumbsUp
                className={`h-5 w-5 transition-colors ${
                  hasLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"
                }`}
              />
              <span className="font-medium">{likesCount}</span>
            </Button>
            <Button variant="ghost" size="sm" className="gap-2 hover:bg-transparent text-muted-foreground">
              <Share2 className="h-5 w-5" />
              Share
            </Button>
          </div>
        </Card>

        {/* Comment Thread with breadcrumb */}
        <Card className="p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link to={`/post/${postId}`} className="hover:underline">
                Post
              </Link>
              {parentComment && (
                <>
                  <span>›</span>
                  <button
                    onClick={handleBackToParent}
                    className="hover:underline"
                  >
                    Parent comment
                  </button>
                </>
              )}
              <span>›</span>
              <span className="text-foreground">Current thread</span>
            </div>
            <h2 className="text-lg font-semibold">Comment Thread</h2>
            <p className="text-sm text-muted-foreground">
              Viewing comment and its replies
            </p>
          </div>
          
          <CommentThread
            comment={rootComment}
            postId={postId!}
            depth={0}
            focusedId={commentId}
            showContinueButton={true}
          />
        </Card>
    </div>
  );
}


