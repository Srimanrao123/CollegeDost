import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { createRealtimeChannel } from "@/lib/realtime";

export interface TrendingPost {
  id: string;
  user_id: string;
  title?: string;
  content: string;
  image_r2_key?: string | null;
  category?: string; // ADD THIS
  exam_type?: string | null;
  likes_count: number;
  comments_count: number;
  trend_score: number;
  created_at: string;
  slug?: string | null;
  profiles?: {
    username: string;
    avatar_r2_key?: string | null;
    avatar_url?: string;
  };
  tags?: string[];
  views_count?: number;
}

export function useTrendingPosts(limit: number = 10) {
  const [posts, setPosts] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const channelRef = useRef<ReturnType<typeof createRealtimeChannel> | null>(null);

  const fetchTrendingPosts = async () => {
    try {
      setLoading(true);

      const DAY_MS = 24 * 60 * 60 * 1000;
      const recentThreshold = new Date(Date.now() - 14 * DAY_MS).toISOString();
      const fallbackThreshold = new Date(Date.now() - 90 * DAY_MS).toISOString();

      let candidatePosts: any[] = [];

      // Primary dataset: recent posts (last 14 days)
      // Optimized query:
      // 1. Only selects columns needed for trending calculation (reduces data transfer)
      // 2. Uses index on created_at DESC for efficient filtering and sorting
      // 3. Filters first (gte), then orders, then limits (optimal query pattern)
      // 4. Limit of 500 provides enough candidates for trending score calculation
      const { data: recentPosts, error: recentError } = await (supabase as any)
        .from('posts')
        .select('id, user_id, title, content, image_r2_key, category, exam_type, likes_count, comments_count, trend_score, created_at, slug')
        .gte('created_at', recentThreshold)
        .order('created_at', { ascending: false })
        .limit(500);

      if (recentError) throw recentError;
      if (recentPosts) {
        candidatePosts = [...recentPosts];
      }

      const ensureCapacity = async () => {
        if (candidatePosts.length >= limit || candidatePosts.length >= 500) {
          return;
        }

        const existingIds = new Set(candidatePosts.map((post) => post.id));
        const desiredAdditional = Math.max(limit * 3, 30);

        // Fallback 1: highly liked posts
        const { data: likedPosts, error: likedError } = await (supabase as any)
          .from('posts')
          .select('id, user_id, title, content, image_r2_key, category, exam_type, likes_count, comments_count, trend_score, created_at, slug')
          .gte('created_at', fallbackThreshold)
          .lt('created_at', recentThreshold)
          .order('likes_count', { ascending: false, nullsFirst: false })
          .limit(desiredAdditional);

        if (!likedError && likedPosts) {
          likedPosts.forEach((post: any) => {
            if (!existingIds.has(post.id)) {
              existingIds.add(post.id);
              candidatePosts.push(post);
            }
          });
        }

        if (candidatePosts.length >= limit) {
          return;
        }

        // Fallback 2: highly commented posts
        const { data: commentedPosts, error: commentedError } = await (supabase as any)
          .from('posts')
          .select('id, user_id, title, content, image_r2_key, category, exam_type, likes_count, comments_count, trend_score, created_at, slug')
          .order('comments_count', { ascending: false, nullsFirst: false })
          .limit(desiredAdditional);

        if (!commentedError && commentedPosts) {
          commentedPosts.forEach((post: any) => {
            if (!existingIds.has(post.id)) {
              existingIds.add(post.id);
              candidatePosts.push(post);
            }
          });
        }

        if (candidatePosts.length >= limit) {
          return;
        }

        // Fallback 3: most recent posts overall
        const { data: recentFallback, error: recentFallbackError } = await (supabase as any)
          .from('posts')
          .select('id, user_id, title, content, image_r2_key, category, exam_type, likes_count, comments_count, trend_score, created_at, slug')
          .order('created_at', { ascending: false })
          .limit(desiredAdditional);

        if (!recentFallbackError && recentFallback) {
          recentFallback.forEach((post: any) => {
            if (!existingIds.has(post.id)) {
              existingIds.add(post.id);
              candidatePosts.push(post);
            }
          });
        }
      };

      await ensureCapacity();

      if (candidatePosts.length > 0) {
        // Fetch profiles for candidates
        const userIds = [...new Set(candidatePosts.map(p => p.user_id))];
        const { data: profilesData } = await (supabase as any)
          .from('profiles')
          .select('id, username, avatar_r2_key, avatar_url')
          .in('id', userIds);

        // Fetch tags for all posts
        const postIds = candidatePosts.map(p => p.id);
        const { data: postTagsData } = await (supabase as any)
          .from('post_tags')
          .select('post_id, tag_id, tags(name)')
          .in('post_id', postIds);

        // Build tags map
        const tagsMap: Record<string, string[]> = {};
        if (postTagsData) {
          postTagsData.forEach((pt: any) => {
            if (!tagsMap[pt.post_id]) tagsMap[pt.post_id] = [];
            if (pt.tags?.name) tagsMap[pt.post_id].push(pt.tags.name);
          });
        }

        // Fetch view counts efficiently via direct query
        let viewsMap: Record<string, number> = {};
        try {
          const { data: viewsData } = await (supabase as any)
            .from('post_views')
            .select('post_id')
            .in('post_id', postIds);
          
          if (viewsData && Array.isArray(viewsData)) {
            viewsData.forEach((view: any) => {
              if (view && view.post_id) {
                viewsMap[view.post_id] = (viewsMap[view.post_id] || 0) + 1;
              }
            });
          }
        } catch (error) {
          console.error('Error fetching view counts:', error);
          // Continue with empty viewsMap
        }

        // Compute trending score with time decay if trend_score not present
        const now = Date.now();
        const decay = (createdAt: string) => {
          const hours = Math.max(1, (now - new Date(createdAt).getTime()) / 3600000);
          return Math.pow(hours + 2, 1.5);
        };

        // Merge and score with views
        const scored = (candidatePosts as any[]).map((post: any) => {
          const postWithTrend = post as any as { trend_score?: number | null; [k: string]: any };
          const baseLikes = postWithTrend.likes_count || 0;
          const baseComments = postWithTrend.comments_count || 0;
          const views = viewsMap[postWithTrend.id] || 0;
          const raw = (baseLikes * 1) + (baseComments * 2) + (views * 0.2);
          const computedScore = raw / decay(postWithTrend.created_at);
          const score = (typeof postWithTrend.trend_score === 'number' && !Number.isNaN(postWithTrend.trend_score))
            ? postWithTrend.trend_score!
            : computedScore;
          const merged: TrendingPost = {
            id: postWithTrend.id,
            user_id: postWithTrend.user_id,
            title: postWithTrend.title,
            content: postWithTrend.content,
            image_r2_key: postWithTrend.image_r2_key || null,
            category: postWithTrend.category, // NOW INCLUDED
            exam_type: postWithTrend.exam_type ?? null,
            likes_count: postWithTrend.likes_count || 0,
            comments_count: postWithTrend.comments_count || 0,
            trend_score: score,
            created_at: postWithTrend.created_at,
            slug: postWithTrend.slug || null,
            profiles: profilesData?.find((p: any) => p.id === postWithTrend.user_id) || undefined,
            tags: tagsMap[postWithTrend.id] || [],
            views_count: views,
          };
          return merged;
        });

        // Sort by score desc and limit
        scored.sort((a, b) => (b.trend_score || 0) - (a.trend_score || 0));

        const engaged = scored.filter((post) => {
          const engagement =
            (post.likes_count || 0) +
            (post.comments_count || 0) +
            (post.views_count || 0);
          return engagement > 0;
        });

        const dedupe = (items: TrendingPost[]) => {
          const seen = new Set<string>();
          const result: TrendingPost[] = [];
          items.forEach((item) => {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              result.push(item);
            }
          });
          return result;
        };

        let finalPosts = dedupe(engaged).slice(0, limit);

        if (finalPosts.length < limit) {
          const remaining = dedupe(scored.filter((post) => !finalPosts.some((fp) => fp.id === post.id)));
          finalPosts = [...finalPosts, ...remaining.slice(0, limit - finalPosts.length)];
        }

        setPosts(finalPosts.slice(0, limit));
      } else {
        setPosts([]);
      }
    } catch (error: any) {
      console.error("Error fetching trending posts:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch trending posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendingPosts();

    if (typeof window === "undefined") return; // SSR guard

    // Real-time subscription with debouncing
    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchTrendingPosts();
      }, 300);
    };

    const rt = createRealtimeChannel("realtime:trending");
    
    rt.onPostgresChange({ table: "posts", event: "*" }, () => {
      debouncedRefetch();
    });
    
    rt.onPostgresChange({ table: "post_views", event: "INSERT" }, () => {
      debouncedRefetch();
    });

    rt.subscribe().catch((err: any) => {
      console.error("Failed to subscribe to trending realtime:", err);
    });

    channelRef.current = rt;

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [limit]);

  return { posts, loading, refetch: fetchTrendingPosts };
}
