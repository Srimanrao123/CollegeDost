import { useState, useEffect } from "react";
import { supabase } from "../integrations/supabase/client";
import { fetchPostsPage } from "@/lib/fetchPostsPage";
import { encodeCursor } from "@/lib/pagination";

// Copy enrichPosts function to avoid circular dependency
const enrichPosts = async (posts: any[]) => {
  if (!posts.length) return [];

  const userIds = [...new Set(posts.map((p) => p.user_id))];
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, username, avatar_r2_key, avatar_url")
    .in("id", userIds);

  const postIds = posts.map((p) => p.id);
  const { data: postTagsData } = await (supabase as any)
    .from("post_tags")
    .select("post_id, tag_id, tags(name)")
    .in("post_id", postIds);

  const tagsMap: Record<string, string[]> = {};
  if (postTagsData) {
    postTagsData.forEach((pt: any) => {
      if (!tagsMap[pt.post_id]) tagsMap[pt.post_id] = [];
      if (pt.tags?.name) tagsMap[pt.post_id].push(pt.tags.name);
    });
  }

  const viewsMap: Record<string, number> = {};
  if (postIds.length > 0) {
    try {
      const { data: viewsData } = await (supabase as any)
        .from("post_views")
        .select("post_id")
        .in("post_id", postIds);

      if (viewsData && Array.isArray(viewsData)) {
        viewsData.forEach((view: any) => {
          if (view && view.post_id) {
            viewsMap[view.post_id] = (viewsMap[view.post_id] || 0) + 1;
          }
        });
      }
    } catch (error) {
      console.error("Error fetching view counts:", error);
    }
  }

  postIds.forEach((postId: string) => {
    if (!viewsMap[postId]) {
      viewsMap[postId] = 0;
    }
  });

  return posts.map((post) => ({
    ...post,
    profiles: profilesData?.find((p) => p.id === post.user_id) || null,
    tags: tagsMap[post.id] || [],
    views_count: viewsMap[post.id] || 0,
  }));
};

/**
 * Two-stage fetching hook for home page:
 * 1. First: Fetch 2 posts immediately (eager image loading)
 * 2. Then: Fetch remaining posts in background (lazy image loading)
 */
export function useHomePosts(
  tagFilter?: { tags: string[]; mode: "any" | "all" },
  examFilter?: string[]
) {
  const [initialPosts, setInitialPosts] = useState<any[]>([]);
  const [remainingPosts, setRemainingPosts] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingRemaining, setLoadingRemaining] = useState(false);

  // Stage 1: Fetch first 2 posts immediately
  useEffect(() => {
    let cancelled = false;

    const fetchInitial = async () => {
      setLoadingInitial(true);
      try {
        const { items } = await fetchPostsPage({
          supabase,
          cursor: null,
          limit: 2, // Only fetch 2 posts initially
          paginated: false,
          tagFilter,
          examFilter,
        });

        const enriched = await enrichPosts(items);

        if (!cancelled) {
          setInitialPosts(enriched);
          setLoadingInitial(false);
        }
      } catch (error) {
        console.error("Error fetching initial posts:", error);
        if (!cancelled) {
          setLoadingInitial(false);
        }
      }
    };

    fetchInitial();

    return () => {
      cancelled = true;
    };
  }, [tagFilter, examFilter]);

  // Stage 2: After initial posts are loaded, fetch the rest in background
  useEffect(() => {
    if (loadingInitial || initialPosts.length === 0) return;

    let cancelled = false;

    const fetchRemaining = async () => {
      setLoadingRemaining(true);
      try {
        // Use cursor from the last initial post to fetch the rest
        const lastPost = initialPosts[initialPosts.length - 1];
        const cursor = lastPost
          ? encodeCursor({
              createdAt: lastPost.created_at,
              id: String(lastPost.id),
            })
          : null;

        // Fetch remaining posts (starting from index 2)
        const { items } = await fetchPostsPage({
          supabase,
          cursor,
          limit: 20, // Fetch more posts in background
          paginated: true, // Use pagination to get cursor-based results
          tagFilter,
          examFilter,
        });

        const enriched = await enrichPosts(items);

        if (!cancelled) {
          setRemainingPosts(enriched);
          setLoadingRemaining(false);
        }
      } catch (error) {
        console.error("Error fetching remaining posts:", error);
        if (!cancelled) {
          setLoadingRemaining(false);
        }
      }
    };

    // Small delay to ensure initial posts are rendered first
    const timer = setTimeout(() => {
      fetchRemaining();
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [initialPosts, tagFilter, examFilter, loadingInitial]);

  // Combine all posts
  const allPosts = [...initialPosts, ...remainingPosts];

  return {
    posts: allPosts,
    initialPosts,
    remainingPosts,
    loading: loadingInitial,
    loadingRemaining,
  };
}

