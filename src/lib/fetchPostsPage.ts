import { decodeCursor, encodeCursor, orForNext, type Cursor, type Post } from "./pagination";

type Args = {
  supabase: any;
  cursor?: string | null;
  limit?: number;
  paginated?: boolean;
  tagFilter?: { tags: string[]; mode: "any" | "all" };
};

const clampLimit = (limit: number) => Math.max(1, Math.min(50, limit));

const dedupeById = (rows: Post[]) => {
  const map = new Map<string, Post>();
  for (const row of rows) {
    map.set(String(row.id), row);
  }
  return Array.from(map.values());
};

export async function fetchPostsPage({ supabase, cursor, limit = 20, paginated = true, tagFilter }: Args) {
  const clamped = clampLimit(limit);
  const decoded: Cursor | null = cursor ? decodeCursor(cursor) : null;

  let query = supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

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
