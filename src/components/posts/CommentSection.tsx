import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useComments } from "@/hooks/useComments";
import { CommentThread } from "./CommentThread";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmojiPicker } from "@/components/ui/emoji-picker";

interface CommentSectionProps {
  postId: string;
  postSlug?: string | null; // Optional slug for navigation
}

export function CommentSection({ postId, postSlug }: CommentSectionProps) {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { comments, loading, sortBy, setSortBy, addComment } = useComments(postId);

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = newComment.substring(0, start) + emoji + newComment.substring(end);
    setNewComment(newValue);
    
    // Set cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || !user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Fetch user profile for optimistic UI
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, avatar_r2_key, avatar_url")
        .eq("id", user.id)
        .single();

      // Call addComment from useComments hook with parentId = null for top-level comment
      await addComment(newComment, user.id, null, profileData);
      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-6">
      {/* Comment Input */}
      <div className="space-y-2">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder={user ? "Join the conversation... (Ctrl+Enter to post)" : "Sign in to comment"}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!user || isSubmitting}
            rows={3}
            className="pr-10"
          />
          {user && (
            <div className="absolute bottom-2 right-2">
              <EmojiPicker onEmojiSelect={handleEmojiSelect} />
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!user || !newComment.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Posting...
              </>
            ) : (
              "Comment"
            )}
          </Button>
        </div>
      </div>

      {/* Sort Options */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="best">Best</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              postId={postId}
              postSlug={postSlug}
              depth={0}
              showContinueButton={true} // Enable continue button for main post view
            />
          ))}
        </div>
      )}
    </div>
  );
}
