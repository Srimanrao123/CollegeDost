import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CommentItem {
  id: string;
  content: string;
  user_id: string;
  post_id: string;
  parent_id: string | null;
  created_at: string;
  likes_count: number;
  profiles?: {
    username: string;
    avatar_url?: string;
  } | null;
  pending?: boolean;
}

type CommentMap = Record<string, CommentItem>;
type ChildrenMap = Record<string, string[]>; // parentId -> child ids

interface CommentStoreValue {
  commentsById: CommentMap;
  childrenByParent: ChildrenMap;
  setAll: (flat: CommentItem[]) => void;
  upsertComment: (c: CommentItem) => void;
  removeComment: (id: string) => void;
  getChildren: (parentId: string | null) => CommentItem[];
  addReplyOptimistic: (args: { postId: string; parentId: string | null; userId: string; content: string }) => Promise<void>;
  subscribeGlobal: (postId?: string) => void;
}

const CommentStoreCtx = createContext<CommentStoreValue | null>(null);

export function CommentStoreProvider({ children }: { children: React.ReactNode }) {
  const [commentsById, setCommentsById] = useState<CommentMap>({});
  const [childrenByParent, setChildrenByParent] = useState<ChildrenMap>({});
  const subscribedGlobal = useRef(false);
  const subscribedPostIds = useRef<Set<string>>(new Set());

  const indexChildren = (items: CommentItem[]) => {
    const map: ChildrenMap = {};
    items.forEach((c) => {
      const key = c.parent_id || "root";
      if (!map[key]) map[key] = [];
      map[key].push(c.id);
    });
    return map;
  };

  const setAll = (flat: CommentItem[]) => {
    const byId: CommentMap = {};
    flat.forEach((c) => (byId[c.id] = c));
    setCommentsById(byId);
    setChildrenByParent(indexChildren(flat));
  };

  const upsertComment = (c: CommentItem) => {
    setCommentsById((prev) => ({ ...prev, [c.id]: c }));
    setChildrenByParent((prev) => {
      const key = c.parent_id || "root";
      const existing = prev[key] || [];
      if (!existing.includes(c.id)) {
        return { ...prev, [key]: [c.id, ...existing] };
      }
      return prev;
    });
  };

  const removeComment = (id: string) => {
    setCommentsById((prev) => {
      const clone = { ...prev };
      delete clone[id];
      return clone;
    });
    setChildrenByParent((prev) => {
      const next: ChildrenMap = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = v.filter((cid) => cid !== id);
      }
      return next;
    });
  };

  const getChildren = (parentId: string | null) => {
    const key = parentId || "root";
    const ids = childrenByParent[key] || [];
    return ids.map((id) => commentsById[id]).filter(Boolean);
  };

  const addReplyOptimistic = async ({ postId, parentId, userId, content }: { postId: string; parentId: string | null; userId: string; content: string }) => {
    const tempId = `temp-${Date.now()}`;
    const optimistic: CommentItem = {
      id: tempId,
      content: content.trim(),
      user_id: userId,
      post_id: postId,
      parent_id: parentId,
      created_at: new Date().toISOString(),
      likes_count: 0,
      profiles: null,
      pending: true,
    };
    upsertComment(optimistic);
    try {
      const { data, error } = await (supabase as any)
        .from("comments")
        .insert({ post_id: postId, user_id: userId, content: content.trim(), parent_id: parentId })
        .select("*")
        .single();
      if (error) throw error;
      removeComment(tempId);
      upsertComment({ ...(data as CommentItem), pending: false });
    } catch (e) {
      removeComment(tempId);
      throw e;
    }
  };

  const subscribeGlobal = (postId?: string) => {
    // If no postId, set up a single global listener once
    if (!postId) {
      if (subscribedGlobal.current) return;
      subscribedGlobal.current = true;
      supabase
        .channel("comments-global")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "comments" },
          (payload: any) => {
            const row = (payload.new || payload.old) as any;
            if (payload.eventType === "DELETE") {
              removeComment(row.id);
            } else {
              upsertComment(row as CommentItem);
            }
          }
        )
        .subscribe();
      return;
    }

    // For a specific post, subscribe once per postId
    if (subscribedPostIds.current.has(postId)) return;
    subscribedPostIds.current.add(postId);
    supabase
      .channel(`comments-post-${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comments", filter: `post_id=eq.${postId}` },
        (payload: any) => {
          const row = (payload.new || payload.old) as any;
          if (payload.eventType === "DELETE") {
            removeComment(row.id);
          } else {
            upsertComment(row as CommentItem);
          }
        }
      )
      .subscribe();
  };

  const value: CommentStoreValue = useMemo(() => ({
    commentsById,
    childrenByParent,
    setAll,
    upsertComment,
    removeComment,
    getChildren,
    addReplyOptimistic,
    subscribeGlobal,
  }), [commentsById, childrenByParent]);

  return (
    <CommentStoreCtx.Provider value={value}>{children}</CommentStoreCtx.Provider>
  );
}

export function useCommentStore() {
  const ctx = useContext(CommentStoreCtx);
  if (!ctx) throw new Error("useCommentStore must be used within CommentStoreProvider");
  return ctx;
}


