import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type CommentSort = "best" | "newest" | "oldest";

interface Comment {
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
  };
  replies?: Comment[];
}

export function useCommentsList(postId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<CommentSort>("best");
  const { toast } = useToast();

  const buildCommentTree = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // First pass: create map
    flatComments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: build tree
    flatComments.forEach((comment) => {
      const commentWithReplies = commentMap.get(comment.id)!;
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies!.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    return rootComments;
  };

  const sortComments = (comments: Comment[], sort: CommentSort): Comment[] => {
    const sorted = [...comments];

    switch (sort) {
      case "best":
        sorted.sort((a, b) => b.likes_count - a.likes_count);
        break;
      case "newest":
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "oldest":
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
    }

    // Recursively sort replies
    sorted.forEach((comment) => {
      if (comment.replies && comment.replies.length > 0) {
        comment.replies = sortComments(comment.replies, sort);
      }
    });

    return sorted;
  };

  const fetchComments = useCallback(async () => {
    if (!postId) return;

    try {
      setLoading(true);
      
      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (commentsError) throw commentsError;

      // Fetch profiles for all comment authors
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", userIds);

        // Merge comments with profiles
        const commentsWithProfiles = commentsData.map(comment => ({
          ...comment,
          profiles: profilesData?.find(p => p.id === comment.user_id) || null
        }));

        const tree = buildCommentTree(commentsWithProfiles);
        const sorted = sortComments(tree, sortBy);
        setComments(sorted);
      } else {
        setComments([]);
      }
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch comments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [postId, sortBy, toast]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Real-time subscriptions
  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`comments-realtime-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        (payload: any) => {
          // Apply incremental updates for snappier UX
          try {
            if (payload.eventType === 'INSERT') {
              const inserted = payload.new as any;
              setComments((prev) => {
                const newNode: Comment = {
                  id: inserted.id,
                  content: inserted.content,
                  user_id: inserted.user_id,
                  post_id: inserted.post_id,
                  parent_id: inserted.parent_id,
                  created_at: inserted.created_at,
                  likes_count: inserted.likes_count || 0,
                  profiles: undefined,
                  replies: [],
                } as any;

                const addToTree = (nodes: Comment[]): Comment[] => {
                  if (!inserted.parent_id) {
                    return [newNode, ...nodes];
                  }
                  return nodes.map((n) => {
                    if (n.id === inserted.parent_id) {
                      const existing = n.replies || [];
                      return { ...n, replies: [newNode, ...existing] } as Comment;
                    }
                    const childReplies = n.replies && n.replies.length > 0 ? addToTree(n.replies) : n.replies;
                    return { ...n, replies: childReplies } as Comment;
                  });
                };

                return addToTree(prev);
              });
            } else if (payload.eventType === 'DELETE') {
              const deletedId = (payload.old as any).id;
              const removeFromTree = (nodes: Comment[]): Comment[] => {
                return nodes
                  .filter((n) => n.id !== deletedId)
                  .map((n) => ({
                    ...n,
                    replies: n.replies ? removeFromTree(n.replies) : n.replies,
                  } as Comment));
              };
              setComments((prev) => removeFromTree(prev));
            } else {
              // For updates or others, refetch to ensure profiles/totals stay in sync
              fetchComments();
            }
          } catch {
            fetchComments();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, fetchComments]);

  const addComment = async (content: string, userId: string, parentId?: string | null) => {
    if (!content.trim()) return;

    try {
      // Optimistic insert
      const tempId = `temp-${Date.now()}`;
      const optimistic: Comment = {
        id: tempId,
        content: content.trim(),
        user_id: userId,
        post_id: postId,
        parent_id: parentId || null,
        created_at: new Date().toISOString(),
        likes_count: 0,
        profiles: undefined,
        replies: [],
      } as any;

      setComments((prev) => {
        const insertNode = (nodes: Comment[]): Comment[] => {
          if (!parentId) {
            return [optimistic, ...nodes];
          }
          return nodes.map((n) => {
            if (n.id === parentId) {
              const existing = n.replies || [];
              return { ...n, replies: [optimistic, ...existing] } as Comment;
            }
            const childReplies = n.replies && n.replies.length > 0 ? insertNode(n.replies) : n.replies;
            return { ...n, replies: childReplies } as Comment;
          });
        };
        return insertNode(prev);
      });

      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        user_id: userId,
        content: content.trim(),
        parent_id: parentId || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: parentId ? "Reply added" : "Comment added",
      });
      // Refetch to reconcile temp node with real data/profiles
      fetchComments();
    } catch (error: any) {
      // Rollback optimistic insert
      setComments((prev) => {
        const removeTemp = (nodes: Comment[]): Comment[] =>
          nodes
            .filter((n) => !n.id.startsWith('temp-'))
            .map((n) => ({
              ...n,
              replies: n.replies ? removeTemp(n.replies) : n.replies,
            } as Comment));
        return removeTemp(prev);
      });
      toast({
        title: "Error",
        description: error.message || "Failed to add comment",
        variant: "destructive",
      });
    }
  };

  return {
    comments,
    loading,
    sortBy,
    setSortBy,
    addComment,
    refetch: fetchComments,
  };
}
