import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useCommentLikes(commentId: string, userId: string | undefined) {
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const { toast } = useToast();

  // Check if this is a temporary ID (optimistic update)
  const isTempId = commentId?.toString().startsWith('temp-');

  const checkIfLiked = useCallback(async () => {
    if (!userId || isTempId) return;
    
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setHasLiked(!!data);
    } catch (error: any) {
      // Silent fail - will retry on next check
    }
  }, [commentId, userId, isTempId]);

  const fetchLikesCount = useCallback(async () => {
    if (isTempId) {
      // For temp IDs, just set count to 0
      setLikesCount(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('comments')
        .select('likes_count')
        .eq('id', commentId)
        .maybeSingle();

      if (error) throw error;
      setLikesCount(data?.likes_count || 0);
    } catch (error: any) {
      // Silent fail - will retry on next fetch
      setLikesCount(0);
    }
  }, [commentId, isTempId]);

  useEffect(() => {
    if (userId) {
      checkIfLiked();
    }
    fetchLikesCount();
  }, [commentId, userId, checkIfLiked, fetchLikesCount]);

  // Set up real-time subscription for likes_count changes
  useEffect(() => {
    if (isTempId) return; // Skip realtime for temp IDs

    const channel = supabase
      .channel(`comment-likes-${commentId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comments',
          filter: `id=eq.${commentId}`
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

  const toggleLike = async () => {
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
    const previousLiked = hasLiked;
    const previousCount = likesCount;

    if (hasLiked) {
      setHasLiked(false);
      setLikesCount(prev => Math.max(0, prev - 1));
    } else {
      setHasLiked(true);
      setLikesCount(prev => prev + 1);
    }

    try {
      if (previousLiked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Check if like already exists (handle race conditions)
        const { data: existingLike } = await supabase
          .from('likes')
          .select('id')
          .eq('comment_id', commentId)
          .eq('user_id', userId)
          .maybeSingle();

        if (existingLike) {
          // Like already exists, just refresh state
          await checkIfLiked();
          await fetchLikesCount();
          return;
        }

        const { error } = await supabase
          .from('likes')
          .insert({ comment_id: commentId, user_id: userId });

        if (error) {
          // Handle specific error codes
          if (error.code === '23505') {
            // Unique constraint violation - like already exists
            await checkIfLiked();
            await fetchLikesCount();
            return;
          }
          throw error;
        }
      }
      
      // Refresh count after a brief delay to ensure trigger fired
      setTimeout(() => {
        fetchLikesCount();
      }, 500);
    } catch (error: any) {
      // Revert optimistic update on error
      setHasLiked(previousLiked);
      setLikesCount(previousCount);
      
      toast({
        title: "Error",
        description: error.message || "Failed to update like",
        variant: "destructive",
      });
    }
  };

  return { hasLiked, likesCount, toggleLike };
}
