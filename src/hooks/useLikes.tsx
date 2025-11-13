import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { createRealtimeChannel } from "@/lib/realtime";

export function useLikes(postId: string | null, userId: string | undefined) {
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const { toast } = useToast();

  const checkIfLiked = useCallback(async () => {
    if (!userId || !postId) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setHasLiked(!!data);
    } catch (error: any) {
      // Silent fail - will retry on next check
    }
  }, [postId, userId]);

  // Fetch likes count directly from likes table for accuracy
  // Helper function to manually update posts.likes_count (fallback if trigger is slow)
  // Note: This might fail due to RLS if user doesn't own the post, but that's OK - triggers will handle it
  const updatePostLikesCountManually = useCallback(async (delta: number) => {
    try {
      // Calculate new count from actual likes table count
      const { count } = await (supabase as any)
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)
        .is('comment_id', null);

      const actualCount = count || 0;
      
      // Try to sync posts table (might fail due to RLS, but triggers should handle it)
      const { error } = await (supabase as any)
        .from('posts')
        .update({ likes_count: actualCount })
        .eq('id', postId);

      // Silent sync - errors are expected if user doesn't own the post (triggers will handle it)
    } catch (error: any) {
      // Ignore errors - triggers should handle the update
    }
  }, [postId]);

  const fetchLikesCount = useCallback(async () => {
    if (!postId) return;
    
    try {
      // Get count directly from likes table - this is more accurate
      const { count, error: countError } = await (supabase as any)
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)
        .is('comment_id', null);

      if (!countError && count !== null) {
        const actualCount = count || 0;
        setLikesCount(actualCount);
        
        // Also sync it to posts table if different (silently)
        const { data: postData } = await (supabase as any)
          .from('posts')
          .select('likes_count')
          .eq('id', postId)
          .maybeSingle();
        
        if (postData && postData.likes_count !== actualCount) {
          // Sync silently without logging
          await (supabase as any)
            .from('posts')
            .update({ likes_count: actualCount })
            .eq('id', postId)
            .catch(() => {
              // Silent fail - triggers will handle it
            });
        }
        return;
      }

      // Fallback: Get from posts table
      const { data, error } = await (supabase as any)
        .from('posts')
        .select('likes_count')
        .eq('id', postId)
        .maybeSingle();

      if (error) throw error;
      setLikesCount(data?.likes_count || 0);
    } catch (error: any) {
      // Silent fail - will retry on next fetch
    }
  }, [postId]);

  useEffect(() => {
    if (userId) {
      checkIfLiked();
    }
    fetchLikesCount();
  }, [postId, userId, checkIfLiked, fetchLikesCount]);

  // Set up real-time subscriptions using the new realtime helper
  useEffect(() => {
    if (!postId || typeof postId !== 'string' || postId.trim() === "") return;
    if (typeof window === "undefined") return; // SSR guard

    let rt: ReturnType<typeof createRealtimeChannel> | null = null;
    let isMounted = true;

    const setupRealtime = async () => {
      try {
        rt = createRealtimeChannel(`realtime:likes:${postId}`);
        const filter = `post_id=eq.${postId}`;

        // Listen to likes table changes
        rt.onPostgresChange(
          { table: "likes", event: "*", filter },
          () => {
            if (isMounted) {
              fetchLikesCount();
            }
          }
        );

        // Listen to posts table updates for likes_count changes
        rt.onPostgresChange(
          { table: "posts", event: "UPDATE", filter: `id=eq.${postId}` },
          (payload) => {
            if (isMounted && payload.new && (payload.new as any).likes_count !== undefined) {
              setLikesCount((payload.new as any).likes_count);
            }
          }
        );

        // Subscribe with error handling - don't fail if subscription fails
        await rt.subscribe().catch(() => {
          // Silent fail - realtime is nice-to-have, not critical
          // Continue without realtime - polling will handle updates via fetchLikesCount
        });
      } catch (error: any) {
        // Silent fail - continue without realtime
      }
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (rt) {
        try {
          rt.unsubscribe();
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    };
  }, [postId, fetchLikesCount]);

  const toggleLike = async () => {
    if (!userId) {
      // Redirect will be handled by the component calling this
      return;
    }

    // Get the current authenticated user ID to ensure we're using the correct ID
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || authUser.id !== userId) {
      toast({
        title: "Authentication error",
        description: "User authentication mismatch. Please sign in again.",
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
        // Unlike: Delete the like
        const { data, error } = await (supabase as any)
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId)
          .select();

        if (error) {
          throw error;
        }
        
        // Refresh count immediately from likes table
        await fetchLikesCount();
        
        // Try to sync posts table (non-blocking - triggers should handle it)
        updatePostLikesCountManually(0).catch(() => {
          // Ignore errors - triggers will handle it
        });
      } else {
        // Like: Insert the like
        // First check if like already exists (handle race conditions)
        const { data: existingLike } = await (supabase as any)
          .from('likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', userId)
          .maybeSingle();

        if (existingLike) {
          // Like already exists, just refresh state
          await checkIfLiked();
          await fetchLikesCount();
          return;
        }

        const { data, error } = await (supabase as any)
          .from('likes')
          .insert({ 
            post_id: postId, 
            user_id: userId,
            comment_id: null // Explicitly set to null for post likes
          })
          .select();

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
        
        // Refresh count immediately from likes table
        await fetchLikesCount();
        
        // Try to sync posts table (non-blocking - triggers should handle it)
        updatePostLikesCountManually(0).catch(() => {
          // Ignore errors - triggers will handle it
        });
      }
      
      // Refresh the like status after successful operation
      await checkIfLiked();
      
      // Double-check count after a brief delay to ensure trigger fired
      setTimeout(() => {
        fetchLikesCount();
      }, 500);
    } catch (error: any) {
      // Revert optimistic update on error
      setHasLiked(previousLiked);
      setLikesCount(previousCount);
      
      toast({
        title: "Error",
        description: error.message || "Failed to update like. Please try again.",
        variant: "destructive",
      });
    }
  };

  return { hasLiked, likesCount, toggleLike };
}
