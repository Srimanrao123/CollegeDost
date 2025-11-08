import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePostDetail(postId: string) {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    if (!postId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch post
      const { data: postData, error: fetchError } = await supabase
        .from("posts")
        .select("*")
        .eq("id", postId)
        .single();

      if (fetchError) throw fetchError;

      // Fetch profile separately
      if (postData) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .eq("id", postData.user_id)
          .single();

        setPost({
          ...postData,
          profiles: profileData,
        });
      }
    } catch (err: any) {
      console.error("Error fetching post:", err);
      setError(err.message || "Failed to fetch post");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // Real-time subscription for post updates
  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`post-detail-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "posts",
          filter: `id=eq.${postId}`,
        },
        (payload) => {
          setPost((prev: any) => (prev ? { ...prev, ...payload.new } : payload.new));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  return { post, loading, error, refetch: fetchPost };
}
