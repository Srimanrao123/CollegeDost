import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, Reply, MoreVertical, Trash2, Edit, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCommentLikes } from "@/hooks/useCommentLikes";
import { formatDistanceToNow } from "date-fns";
import { useComments } from "@/hooks/useComments";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { deriveProfileHandle, deriveProfileInitial, type ProfileHandleSource } from "@/lib/profileDisplay";

// Responsive maximum depth (mobile: 3, desktop: 6)
function useResponsiveMaxDepth() {
  const [maxDepth, setMaxDepth] = useState<number>(6);
  useEffect(() => {
    const compute = () => {
      // Tailwind md breakpoint ~768px
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      setMaxDepth(isMobile ? 3 : 6);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);
  return maxDepth;
}

interface CommentThreadProps {
  comment: any;
  postId: string;
  depth?: number;
  focusedId?: string;
  showContinueButton?: boolean; // NEW: optional prop to control button visibility
}

export function CommentThread({ 
  comment, 
  postId, 
  depth = 0, 
  focusedId,
  showContinueButton = true // NEW: default true
}: CommentThreadProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  
  const { hasLiked, likesCount, toggleLike } = useCommentLikes(comment.id, user?.id);
  const { addComment, updateComment, deleteComment } = useComments(postId);

  const isFocused = focusedId === comment.id;
  const isAuthor = user?.id === comment.user_id;
  const maxDepth = useResponsiveMaxDepth();
  const shouldShowContinueThread = showContinueButton && depth >= maxDepth && comment.replies && comment.replies.length > 0;

  const handleReply = async () => {
    if (!replyContent.trim() || !user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addComment(replyContent, user.id, comment.id, {
        username: user.email?.split('@')[0] || 'User',
        avatar_url: null
      });
      setReplyContent("");
      setShowReplyBox(false);
    } catch (error) {
      console.error("Error adding reply:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await updateComment(comment.id, editContent);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      await deleteComment(comment.id);
      toast({
        title: "Comment deleted",
        description: "Your comment has been deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const handleContinueThread = () => {
    navigate(`/post/${postId}/comment/${comment.id}`);
  };

  return (
    <div
      className={`${depth > 0 ? "ml-4 pl-4 border-l-2 border-border" : ""} ${
        isFocused ? "bg-primary/5 rounded-lg p-2 -ml-2 border-2 border-primary/30" : ""
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.profiles?.avatar_url} />
          <AvatarFallback>
            {deriveProfileInitial(comment.profiles as ProfileHandleSource | null)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm truncate">
              {deriveProfileHandle(comment.profiles as ProfileHandleSource | null, "anonymous")}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            {isAuthor && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(!isEditing)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                disabled={isSubmitting}
                className="min-h-[60px]"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEdit} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm mb-2 break-words whitespace-pre-wrap">{comment.content}</p>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2"
                  onClick={toggleLike}
                  disabled={!user}
                >
                  <ThumbsUp
                    className={`h-3 w-3 ${hasLiked ? "fill-red-500 text-red-500" : ""}`}
                  />
                  {likesCount > 0 && <span className="text-xs">{likesCount}</span>}
                </Button>

                {!shouldShowContinueThread && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2"
                    onClick={() => setShowReplyBox(!showReplyBox)}
                    disabled={!user}
                  >
                    <Reply className="h-3 w-3" />
                    <span className="text-xs">Reply</span>
                  </Button>
                )}

                {comment.replies && comment.replies.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
                  </span>
                )}
              </div>

              {showReplyBox && !shouldShowContinueThread && (
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="Write a reply..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    disabled={isSubmitting}
                    className="min-h-[60px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleReply} disabled={isSubmitting || !replyContent.trim()}>
                      {isSubmitting ? "Posting..." : "Reply"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowReplyBox(false);
                        setReplyContent("");
                      }}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Render nested replies or "Continue Thread" button */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-3">
          {shouldShowContinueThread ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleContinueThread}
              className="ml-11 gap-2 text-primary hover:text-primary hover:bg-primary/10"
            >
              <ChevronRight className="h-1.5 w-1.5" />
               more replies ({comment.replies.length})
            </Button>
          ) : (
            comment.replies.map((reply: any) => (
              <CommentThread
                key={reply.id}
                comment={reply}
                postId={postId}
                depth={depth + 1}
                focusedId={focusedId}
                showContinueButton={showContinueButton}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
