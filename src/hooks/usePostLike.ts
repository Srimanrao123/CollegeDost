import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedCallback } from "use-debounce";

export function usePostLike(postId: string, userId: string | undefined) {
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const checkLikeStatus = useCallback(async () => {
    if (!userId || !postId) return;

    try {
      const { data } = await supabase
        .from("likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();

      setHasLiked(!!data);
    } catch (error) {
      console.error("Error checking like status:", error);
    }
  }, [postId, userId]);

  const fetchLikesCount = useCallback(async () => {
    if (!postId) return;

    try {
      const { data } = await supabase
        .from("posts")
        .select("likes_count")
        .eq("id", postId)
        .single();

      setLikesCount(data?.likes_count || 0);
    } catch (error) {
      console.error("Error fetching likes count:", error);
    }
  }, [postId]);

  useEffect(() => {
    checkLikeStatus();
    fetchLikesCount();
  }, [checkLikeStatus, fetchLikesCount]);

  // Real-time subscription
  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`post-likes-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "posts",
          filter: `id=eq.${postId}`,
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
  }, [postId]);

  const debouncedToggle = useDebouncedCallback(async (shouldLike: boolean) => {
    if (!userId) return;

    try {
      setIsUpdating(true);

      if (shouldLike) {
        const { error } = await supabase
          .from("likes")
          .insert({ post_id: postId, user_id: userId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
        if (error) throw error;
      }
    } catch (error: any) {
      // Revert optimistic update
      setHasLiked(!shouldLike);
      setLikesCount((prev) => (shouldLike ? prev - 1 : prev + 1));

      toast({
        title: "Error",
        description: error.message || "Failed to update like",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }, 300);

  const toggleLike = () => {
    if (!userId) {
      // Redirect will be handled by the component calling this
      return;
    }

    // Optimistic update
    const newLikedState = !hasLiked;
    setHasLiked(newLikedState);
    setLikesCount((prev) => (newLikedState ? prev + 1 : Math.max(0, prev - 1)));

    debouncedToggle(newLikedState);
  };

  return { hasLiked, likesCount, toggleLike, isUpdating };
}
