import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedCallback } from "use-debounce";

export function useCommentLike(commentId: string, userId: string | undefined) {
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const { toast } = useToast();

  // Check if this is a temporary ID (optimistic update)
  const isTempId = commentId?.toString().startsWith('temp-');

  const checkLikeStatus = useCallback(async () => {
    if (!userId || !commentId || isTempId) return;

    try {
      const { data } = await supabase
        .from("likes")
        .select("id")
        .eq("comment_id", commentId)
        .eq("user_id", userId)
        .maybeSingle();

      setHasLiked(!!data);
    } catch (error) {
      // Silent fail - will retry on next check
    }
  }, [commentId, userId, isTempId]);

  const fetchLikesCount = useCallback(async () => {
    if (!commentId) return;

    if (isTempId) {
      // For temp IDs, just set count to 0
      setLikesCount(0);
      return;
    }

    try {
      const { data } = await supabase
        .from("comments")
        .select("likes_count")
        .eq("id", commentId)
        .maybeSingle();

      setLikesCount(data?.likes_count || 0);
    } catch (error) {
      // Silent fail - will retry on next fetch
      setLikesCount(0);
    }
  }, [commentId, isTempId]);

  useEffect(() => {
    checkLikeStatus();
    fetchLikesCount();
  }, [checkLikeStatus, fetchLikesCount]);

  // Real-time subscription
  useEffect(() => {
    if (!commentId || isTempId) return;

    const channel = supabase
      .channel(`comment-likes-${commentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "comments",
          filter: `id=eq.${commentId}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).likes_count !== undefined) {
            setLikesCount((payload.new as any).likes_count);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [commentId, isTempId]);

  const debouncedToggle = useDebouncedCallback(async (shouldLike: boolean) => {
    if (!userId || isTempId) return;

    try {
      if (shouldLike) {
        // Check if like already exists (handle race conditions)
        const { data: existingLike } = await supabase
          .from("likes")
          .select("id")
          .eq("comment_id", commentId)
          .eq("user_id", userId)
          .maybeSingle();

        if (existingLike) {
          // Like already exists, just refresh state
          await checkLikeStatus();
          await fetchLikesCount();
          return;
        }

        const { error } = await supabase
          .from("likes")
          .insert({ comment_id: commentId, user_id: userId });
        
        if (error) {
          // Handle specific error codes
          if (error.code === '23505') {
            // Unique constraint violation - like already exists
            await checkLikeStatus();
            await fetchLikesCount();
            return;
          }
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", userId);
        if (error) throw error;
      }
      
      // Refresh count after a brief delay to ensure trigger fired
      setTimeout(() => {
        fetchLikesCount();
      }, 500);
    } catch (error: any) {
      // Revert optimistic update on error
      setHasLiked(!shouldLike);
      setLikesCount((prev) => (shouldLike ? prev - 1 : prev + 1));

      toast({
        title: "Error",
        description: error.message || "Failed to update like",
        variant: "destructive",
      });
    }
  }, 300);

  const toggleLike = () => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please sign in to like comments",
        variant: "destructive",
      });
      return;
    }

    // Don't allow liking temp comments
    if (isTempId) {
      toast({
        title: "Please wait",
        description: "Comment is still being created. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    // Optimistic update
    const newLikedState = !hasLiked;
    setHasLiked(newLikedState);
    setLikesCount((prev) => (newLikedState ? prev + 1 : Math.max(0, prev - 1)));

    debouncedToggle(newLikedState);
  };

  return { hasLiked, likesCount, toggleLike };
}
