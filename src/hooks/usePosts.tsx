import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "../integrations/supabase/client";
import { useToast } from "../hooks/use-toast";
import { createRealtimeChannel } from "@/lib/realtime";
import { fetchPostsPage } from "@/lib/fetchPostsPage";

const DEFAULT_PAGE_SIZE = 20;

interface UsePostsOptions {
  paginate?: boolean;
  pageSize?: number;
}

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

export function usePosts(
  tagFilter?: { tags: string[]; mode: "any" | "all" },
  limit?: number,
  options: UsePostsOptions = {},
  examFilter?: string[]
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const paginate = options.paginate ?? limit === undefined;
  const pageSize = paginate
    ? options.pageSize ?? DEFAULT_PAGE_SIZE
    : limit ?? options.pageSize ?? DEFAULT_PAGE_SIZE;

  const queryKey = useMemo(
    () => [
      "posts",
      tagFilter ? tagFilter.tags?.join(",") : "all",
      tagFilter?.mode || "any",
      examFilter ? examFilter.join(",") : "all-exams",
      paginate ? "cursor" : "single",
      pageSize,
    ],
    [tagFilter?.tags, tagFilter?.mode, examFilter, paginate, pageSize]
  );

  const buildQueryArgs = (cursor: string | null) => ({
    supabase,
    cursor,
    limit: pageSize,
    paginated: paginate,
    tagFilter,
    examFilter,
  });

  const infiniteQuery = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const { items, nextCursor } = await fetchPostsPage(
        buildQueryArgs((pageParam as string | null) ?? null)
      );
      const enriched = await enrichPosts(items);
      return { items: enriched, nextCursor };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      paginate ? lastPage?.nextCursor ?? undefined : undefined,
    staleTime: 1000 * 60 * 2,
  });

  useEffect(() => {
    const error = infiniteQuery.error;
    if (error) {
      toast({
        title: "Error",
        description: (error as any).message || "Failed to fetch posts",
        variant: "destructive",
      });
    }
  }, [infiniteQuery.error, toast]);

  useEffect(() => {
    const channel = createRealtimeChannel("realtime:posts_bundle");

    channel.onPostgresChange({ table: "posts", event: "*" }, () => {
      queryClient.invalidateQueries({ queryKey });
    });

    channel.onPostgresChange({ table: "post_tags", event: "*" }, () => {
      queryClient.invalidateQueries({ queryKey });
    });

    channel.onPostgresChange({ table: "post_views", event: "INSERT" }, (payload: any) => {
      const postId = payload.new?.post_id;
      if (!postId) return;

      queryClient.setQueryData(queryKey, (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            items: page.items.map((post: any) =>
              post.id === postId
                ? { ...post, views_count: (post.views_count || 0) + 1 }
                : post
            ),
          })),
        };
      });
    });

    channel.subscribe().catch((err: any) => {
      console.warn("Realtime subscription for posts failed (non-critical):", err?.message || err);
    });

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient, queryKey]);

  const posts = useMemo(() => {
    const seen = new Set<string>();
    const merged: any[] = [];
    infiniteQuery.data?.pages.forEach((page) => {
      page.items.forEach((item: any) => {
        const key = String(item.id);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      });
    });
    return merged;
  }, [infiniteQuery.data]);

  return {
    posts,
    loading: infiniteQuery.isLoading,
    fetchNextPage: paginate ? infiniteQuery.fetchNextPage : async () => undefined,
    hasNextPage: paginate ? infiniteQuery.hasNextPage : false,
    isFetchingNextPage: paginate ? infiniteQuery.isFetchingNextPage : false,
    refetch: infiniteQuery.refetch,
  };
}
