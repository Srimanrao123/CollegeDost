import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { createRealtimeChannel } from "@/lib/realtime";

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  likes_count: number;
  created_at: string;
  updated_at: string;
  parent_id?: string | null;
  profiles?: {
    username: string;
    avatar_url?: string;
  };
  replies?: Comment[];
  __isTemp?: boolean;
  // NEW: optional replies counter if your schema provides it
  replies_count?: number;
}

export type CommentSort = 'best' | 'newest' | 'oldest';

export function useComments(postId: string | null) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<CommentSort>('best');
  const { toast } = useToast();
  const channelRef = useRef<ReturnType<typeof createRealtimeChannel> | null>(null);

  // Recursively insert a reply under its parent
  // bumpCount: when true, increment parent.replies_count optimistically (client-only)
  function insertReply(tree: Comment[], newComment: Comment, bumpCount = false): Comment[] {
    return tree.map((c) => {
      if (c.id === newComment.parent_id) {
        return {
          ...c,
          replies: [...(c.replies || []), { ...newComment, replies: [] }],
          replies_count: bumpCount
            ? (typeof c.replies_count === 'number'
                ? c.replies_count + 1
                : ((c.replies?.length || 0) + 1))
            : c.replies_count,
        };
      }
      if (c.replies?.length) {
        return { ...c, replies: insertReply(c.replies, newComment, bumpCount) };
      }
      return c;
    });
  }

  // Remove a comment by id; if parentId provided, decrement parent's replies_count
  function removeById(tree: Comment[], targetId: string, parentId?: string | null): Comment[] {
    return tree
      .filter(c => c.id !== targetId)
      .map(c => {
        const updated: Comment = {
          ...c,
          replies: c.replies ? removeById(c.replies, targetId, parentId) : [],
        };
        if (parentId && c.id === parentId && typeof c.replies_count === 'number') {
          // decrement if child removed
          updated.replies_count = Math.max(0, c.replies_count - 1);
        }
        return updated;
      });
  }

  // Replace temporary comment with real comment
  function replaceTempComment(
    tree: Comment[],
    tempMatch: { content: string; parent_id: string | null; user_id: string },
    realComment: Comment
  ): { updated: Comment[]; replaced: boolean } {
    let replaced = false;
    
    function replaceInTree(list: Comment[]): Comment[] {
      return list.map(c => {
        if (!replaced && c.__isTemp &&
            c.content === tempMatch.content &&
            c.user_id === tempMatch.user_id &&
            c.parent_id === tempMatch.parent_id) {
          replaced = true;
          return { ...realComment, replies: c.replies || [] };
        }
        if (c.replies?.length) {
          return { ...c, replies: replaceInTree(c.replies) };
        }
        return c;
      });
    }
    
    return { updated: replaceInTree(tree), replaced };
  }

  // Build tree from flat array
  function buildTree(flat: Comment[]): Comment[] {
    const map = new Map<string, Comment>();
    const roots: Comment[] = [];
    
    for (const r of flat) {
      map.set(r.id, { ...r, replies: [] });
    }
    
    for (const r of flat) {
      if (r.parent_id) {
        const parent = map.get(r.parent_id);
        if (parent) parent.replies!.push(map.get(r.id)!);
        else roots.push(map.get(r.id)!);
      } else {
        roots.push(map.get(r.id)!);
      }
    }
    
    return roots;
  }

  // Sort comments recursively
  function sortCommentsRecursive(comments: Comment[], sort: CommentSort): Comment[] {
    const sorted = [...comments];
    
    switch (sort) {
      case 'best':
        sorted.sort((a, b) => b.likes_count - a.likes_count);
        break;
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
    }

    sorted.forEach(comment => {
      if (comment.replies && comment.replies.length > 0) {
        comment.replies = sortCommentsRecursive(comment.replies, sort);
      }
    });

    return sorted;
  }

  // Initial fetch
  async function fetchComments() {
    if (!postId) return;

    try {
      setLoading(true);
      
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (commentsError) throw commentsError;

      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", userIds);

        const commentsWithProfiles = commentsData.map(comment => ({
          ...comment,
          profiles: profilesData?.find(p => p.id === comment.user_id) || null
        }));

        const tree = buildTree(commentsWithProfiles);
        const sorted = sortCommentsRecursive(tree, sortBy);
        setComments(sorted);
      } else {
        setComments([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch comments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Add comment with optimistic update
  async function addComment(content: string, userId: string, parentId?: string | null, userProfile?: any) {
    if (!postId || !content.trim()) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempComment: Comment = {
      id: tempId,
      post_id: postId,
      user_id: userId,
      content: content.trim(),
      likes_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      parent_id: parentId || null,
      profiles: userProfile || { username: 'You', avatar_url: null },
      replies: [],
      __isTemp: true
    };

    // Optimistic update (bump parent replies_count only here)
    setComments(prev => {
      if (!parentId) {
        return sortCommentsRecursive([...prev, tempComment], sortBy);
      }
      return sortCommentsRecursive(insertReply(prev, tempComment, true), sortBy);
    });

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          post_id: postId,
          user_id: userId,
          content: content.trim(),
          parent_id: parentId || null,
        })
        .select()
        .single();

      if (error) throw error;

      const realComment: Comment = { ...data, profiles: userProfile, replies: [] };

      // Replace temp with real (do not bump replies_count again)
      setComments(prev => {
        const { updated, replaced } = replaceTempComment(prev, {
          content: content.trim(),
          parent_id: parentId || null,
          user_id: userId
        }, realComment);

        if (replaced) return sortCommentsRecursive(updated, sortBy);

        // Fallback: insert real if temp not found (avoid duplicates)
        if (!realComment.parent_id) {
          if (prev.some(c => c.id === realComment.id)) return prev;
          return sortCommentsRecursive([...prev, realComment], sortBy);
        }
        return sortCommentsRecursive(insertReply(prev, realComment, false), sortBy);
      });

      toast({
        title: "Success",
        description: parentId ? "Reply added" : "Comment added",
      });

      return realComment;
    } catch (error: any) {
      // Rollback: remove temp and reduce parent's replies_count back
      setComments(prev => {
        return sortCommentsRecursive(
          removeById(prev, tempId, parentId || undefined),
          sortBy
        );
      });

      toast({
        title: "Error",
        description: error.message || "Failed to add comment",
        variant: "destructive",
      });
      throw error;
    }
  }

  const updateComment = async (commentId: string, content: string) => {
    if (!content.trim()) return;

    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: content.trim() })
        .eq('id', commentId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Comment updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update comment",
        variant: "destructive",
      });
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete comment",
        variant: "destructive",
      });
    }
  };

  // Initial fetch effect
  useEffect(() => {
    fetchComments();
  }, [postId, sortBy]);

  // Realtime subscription: listen to ALL INSERT/UPDATE/DELETE for comments
  useEffect(() => {
    if (!postId) return;
    if (typeof window === "undefined") return; // SSR guard

    const rt = createRealtimeChannel(`realtime:comments:${postId}`);
    const filter = `post_id=eq.${postId}`;

    rt.onPostgresChange(
      { table: "comments", event: "INSERT", filter },
      async (payload) => {
        const newCommentData = payload.new as any;

          // Fetch profile for the new comment
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .eq("id", newCommentData.user_id)
            .single();

          const newComment: Comment = { ...newCommentData, profiles: profileData, replies: [] };

          setComments(prev => {
            // If similar optimistic exists, replace (avoid duplication)
            // ...existing code to detect/replace temp...
            function findSimilarTemp(list: Comment[]): boolean {
              let found = false;
              (function walk(arr: Comment[]) {
                for (const c of arr) {
                  if (c.__isTemp &&
                      c.content === newComment.content &&
                      c.user_id === newComment.user_id &&
                      c.parent_id === newComment.parent_id) {
                    found = true;
                    return;
                  }
                  if (c.replies?.length) walk(c.replies);
                }
              })(list);
              return found;
            }
            function replaceTemp(list: Comment[]): Comment[] {
              let replaced = false;
              function walk(arr: Comment[]): Comment[] {
                return arr.map(c => {
                  if (!replaced && c.__isTemp &&
                      c.content === newComment.content &&
                      c.user_id === newComment.user_id &&
                      c.parent_id === newComment.parent_id) {
                    replaced = true;
                    return { ...newComment, replies: c.replies || [] };
                  }
                  if (c.replies?.length) {
                    return { ...c, replies: walk(c.replies) };
                  }
                  return c;
                });
              }
              return walk(list);
            }

            if (findSimilarTemp(prev)) {
              const updated = replaceTemp(prev);
              return sortCommentsRecursive(updated, sortBy);
            }

            // Else append properly (no bumpCount on realtime path)
            const exists = (() => {
              let f = false;
              (function walk(arr: Comment[]) {
                for (const c of arr) {
                  if (c.id === newComment.id) { f = true; return; }
                  if (c.replies?.length) walk(c.replies);
                }
              })(prev);
              return f;
            })();
            if (exists) return prev;

            if (!newComment.parent_id) {
              return sortCommentsRecursive([...prev, newComment], sortBy);
            }
            return sortCommentsRecursive(insertReply(prev, newComment, false), sortBy);
          });
        }
    );

    rt.onPostgresChange(
      { table: "comments", event: "UPDATE", filter },
      (payload) => {
        const updated = payload.new as any;

          setComments(prev => {
            function updateInTree(list: Comment[]): Comment[] {
              return list.map(c => {
                if (c.id === updated.id) {
                  // Merge likes_count, content edits, and replies_count if present
                  return { ...c, ...updated };
                }
                if (c.replies?.length) {
                  return { ...c, replies: updateInTree(c.replies) };
                }
                return c;
              });
            }
            return sortCommentsRecursive(updateInTree(prev), sortBy);
          });
        }
    );

    rt.onPostgresChange(
      { table: "comments", event: "DELETE", filter },
      (payload) => {
        const deleted = payload.old as any;

          setComments(prev => {
            // Remove and decrement parent's replies_count if available
            const updated = removeById(prev, deleted.id, deleted.parent_id);
            return updated;
          });
        }
    );

    rt.subscribe().catch((err: any) => {
      console.error("Failed to subscribe to comments realtime:", err);
    });

    channelRef.current = rt;
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [postId, sortBy]);

  return {
    comments,
    loading,
    addComment,
    updateComment,
    deleteComment,
    sortBy,
    setSortBy,
    refetch: fetchComments
  };
}
