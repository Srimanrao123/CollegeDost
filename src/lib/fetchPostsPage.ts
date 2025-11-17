import { decodeCursor, encodeCursor, orForNext, type Cursor, type Post } from "./pagination";

type Args = {
  supabase: any;
  cursor?: string | null;
  limit?: number;
  paginated?: boolean;
  tagFilter?: { tags: string[]; mode: "any" | "all" };
  examFilter?: string[];
};

const clampLimit = (limit: number) => Math.max(1, Math.min(50, limit));

const dedupeById = (rows: Post[]) => {
  const map = new Map<string, Post>();
  for (const row of rows) {
    map.set(String(row.id), row);
  }
  return Array.from(map.values());
};

export async function fetchPostsPage({ supabase, cursor, limit = 20, paginated = true, tagFilter, examFilter }: Args) {
  const clamped = clampLimit(limit);
  const decoded: Cursor | null = cursor ? decodeCursor(cursor) : null;

  // Step 1: If we have exam filter, get all post IDs that match the exams
  let examFilteredPostIds: string[] | null = null;
  if (examFilter && examFilter.length > 0) {
    const normalizedExams = examFilter
      .map((exam) => exam.trim())
      .filter((exam) => exam.length > 0);

    if (normalizedExams.length > 0) {
      
      // Try exact match first (most common case)
      let { data: examPosts, error: examError } = await supabase
        .from("posts")
        .select("id, exam_type")
        .in("exam_type", normalizedExams);

      // If exact match returns no results, try case-insensitive matching
      if ((!examPosts || examPosts.length === 0) && !examError) {
        // Try each exam individually with case-insensitive matching
        const allPostIds = new Set<string>();
        
        for (const exam of normalizedExams) {
          // Try ilike with exact match (no wildcards)
          const { data: posts, error } = await supabase
            .from("posts")
            .select("id, exam_type")
            .ilike("exam_type", exam);
          
          if (!error && posts) {
            posts.forEach((p: any) => allPostIds.add(p.id));
          }
        }
        
        examPosts = Array.from(allPostIds).map(id => ({ id }));
      }

      if (examError) {
        throw examError;
      }
      
      examFilteredPostIds = (examPosts || []).map((p: any) => p.id);
      
      // If no posts match the exam filter, return empty result
      if (!examFilteredPostIds || examFilteredPostIds.length === 0) {
        console.warn("No posts found matching exam filter:", normalizedExams);
        return { items: [], nextCursor: null };
      }
      
    }
  }

  // Step 2: Build the main query
  // PERFORMANCE: Select only minimal required columns for home page
  // This reduces data transfer by ~70-80% and improves FCP/LCP significantly
  // For home page (limit=2), we only fetch fields needed for initial render
  // Only image_r2_key is used (image_url is no longer used)
  let query = supabase
    .from("posts")
    .select("id, user_id, title, content, image_r2_key, category, exam_type, likes_count, comments_count, created_at, slug")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  // Apply exam filter by post IDs (if we filtered by exams)
  if (examFilteredPostIds && examFilteredPostIds.length > 0) {
    query = query.in("id", examFilteredPostIds);
  }

  // Apply cursor pagination filter AFTER exam filter
  // Supabase will AND them: (id IN [exam_post_ids]) AND (cursor conditions)
  if (decoded) {
    query = query.or(orForNext(decoded));
  }

  if (tagFilter && tagFilter.tags.length > 0) {
    const normalizedTags = tagFilter.tags
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0);

    if (normalizedTags.length > 0) {
      const { data: filteredPostIds, error: rpcError } = await (supabase as any).rpc("get_posts_by_tags", {
        tag_names: normalizedTags,
        match_mode: tagFilter.mode || "any",
      });

      if (rpcError) throw rpcError;

      const postIds = (filteredPostIds || []).map((row: any) => row.post_id);
      if (postIds.length === 0) {
        return { items: [], nextCursor: null };
      }

      query = query.in("id", postIds);
    }
  }

  const fetchCount = paginated ? clamped + 1 : clamped;

  const { data, error } = await query.limit(fetchCount);

  if (error) {
    throw error;
  }

  const rows = dedupeById((data ?? []) as Post[]);

  if (!paginated) {
    return { items: rows.slice(0, clamped), nextCursor: null };
  }

  const hasMore = rows.length > clamped;
  const items = hasMore ? rows.slice(0, clamped) : rows;

  const nextCursor = hasMore
    ? encodeCursor({
        createdAt: items[items.length - 1].created_at,
        id: String(items[items.length - 1].id),
      })
    : null;

  return { items, nextCursor };
}
