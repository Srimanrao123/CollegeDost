import { useState, useEffect, useMemo, useRef } from "react";
import { CreatePost } from "@/components/posts/CreatePost";
import { PostCard } from "@/components/posts/PostCard";
import { PostCardSkeleton } from "@/components/posts/PostCardSkeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePosts } from "@/hooks/usePosts";
import { ProfileUpdateNotification } from "@/components/notifications/ProfileUpdateNotification";
import { PushNotificationConsent } from "@/components/notifications/PushNotificationConsent";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { createRealtimeChannel } from "@/lib/realtime";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { ProfileService } from "@/services/profileService";
import { deriveProfileHandle, type ProfileHandleSource } from "@/lib/profileDisplay";

const Home = () => {
  const [sortBy, setSortBy] = useState("best");
  const { user, isAuthenticated } = useAuth();
  const [interestedExams, setInterestedExams] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'any' | 'all'>('any');

  // Use tag filter in usePosts hook - use useMemo to prevent unnecessary re-renders
  const tagFilter = useMemo(() => {
    if (selectedTags.length > 0) {
      return { tags: selectedTags, mode: tagFilterMode };
    }
    return undefined;
  }, [selectedTags, tagFilterMode]);
  
  // Determine exam filter: only apply when no tags are selected and user has interested exams
  const examFilter = useMemo(() => {
    if (selectedTags.length > 0) {
      // If tags are selected, don't filter by exams (tags take priority)
      return undefined;
    }
    const hasUser = user || localStorage.getItem("phoneAuth");
    if (hasUser && interestedExams.length > 0) {
      return interestedExams;
    }
    return undefined;
  }, [selectedTags, user, interestedExams]);
  
  // Enable pagination for authenticated users, limit for non-authenticated
  const paginate = !!isAuthenticated;
  const limit = paginate ? undefined : 10;
  const { posts, loading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePosts(
    tagFilter,
    limit,
    { paginate, pageSize: 10 },
    examFilter
  );

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Notification triggers
  useNotificationTriggers();

  // Listen for tag selection from sidebar
  useEffect(() => {
    const handleTagsSelected = (event: any) => {
      const tags = event.detail?.tags || [];
      const mode = event.detail?.mode || 'any';
      
      setSelectedTags(tags);
      setTagFilterMode(mode);
    };

    window.addEventListener('tagsSelected', handleTagsSelected);
    return () => window.removeEventListener('tagsSelected', handleTagsSelected);
  }, []);

  // Fetch user's interested exams (supports both Supabase auth and phone auth)
  useEffect(() => {
    const fetchInterestedExams = async () => {
      const userId = await ProfileService.getUserId();
      if (!userId) return;
      
      try {
        const profile = await ProfileService.getProfile(userId);
        if (profile?.interested_exams && profile.interested_exams.length > 0) {
          setInterestedExams(profile.interested_exams);
        }
      } catch (error) {
        console.error('Error fetching interested exams:', error);
      }
    };

    fetchInterestedExams();

    // Real-time subscription for profile updates using realtime helper
    const setupRealtime = async () => {
      const userId = await ProfileService.getUserId();
      if (!userId || typeof window === "undefined") return; // SSR guard

      const rt = createRealtimeChannel(`realtime:profile:${userId}`);

      rt.onPostgresChange(
        { table: "profiles", event: "UPDATE", filter: `id=eq.${userId}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.interested_exams) {
            setInterestedExams(updated.interested_exams);
          }
        }
      );

      rt.subscribe().catch((err: any) => {
        console.error("Failed to subscribe to profile realtime:", err);
      });

      return () => {
        rt.unsubscribe();
      };
    };

    const cleanup = setupRealtime();
    return () => {
      cleanup.then(cleanupFn => cleanupFn && cleanupFn());
    };
  }, [user]);

  // Infinite scroll setup
  useEffect(() => {
    if (!paginate) return;

    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: null,
        rootMargin: "200px",
        threshold: 0,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, posts.length, paginate]);

  const sortPosts = (postsToSort: any[]) => {
    switch (sortBy) {
      case "new":
        return [...postsToSort].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case "top":
        return [...postsToSort].sort((a, b) => b.likes_count - a.likes_count);
      case "trending":
        return [...postsToSort].sort((a, b) => {
          const scoreB = (b.likes_count || 0) + ((b.comments_count || 0) * 2);
          const scoreA = (a.likes_count || 0) + ((a.comments_count || 0) * 2);
          return scoreB - scoreA;
        });
      case "best":
      default:
        return [...postsToSort].sort((a, b) => {
          const scoreB = (b.likes_count || 0) + ((b.comments_count || 0) * 2);
          const scoreA = (a.likes_count || 0) + ((a.comments_count || 0) * 2);
          return scoreB - scoreA;
        });
    }
  };

  const sortedPosts = sortPosts(posts);
  
  // Posts are already filtered by usePosts hook (tags and exams) and limited for non-authenticated users
  const displayedPosts = sortedPosts;

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const seconds = Math.floor((now.getTime() - created.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <ProfileUpdateNotification />
      <PushNotificationConsent />
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <CreatePost />

        <div className="flex items-center justify-between mb-4 mt-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">
             Posts For You
            </h2>
          </div>
          
        </div>

        {/* Tag filter info */}
        {selectedTags.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium mb-2">
                  Showing posts matching {tagFilterMode === 'all' ? 'ALL' : 'ANY'} of these tags: ({posts.length} posts)
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <Badge key={tag} variant="default" className="text-xs">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}


        <div className="space-y-4">
          {loading && posts.length === 0 ? (
            <>
              {[...Array(3)].map((_, i) => (
                <PostCardSkeleton key={i} />
              ))}
            </>
          ) : displayedPosts.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4">
                <p className="text-2xl mb-2">🔍</p>
                <p className="text-muted-foreground mb-4">
                  {selectedTags.length > 0
                    ? `No posts found with ${tagFilterMode === 'all' ? 'all' : 'any'} of the selected tags.`
                    : examFilter && examFilter.length > 0
                    ? "No posts found for your interested exams."
                    : "No posts yet. Be the first to create one!"}
                </p>
              </div>
              {selectedTags.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedTags([]);
                    window.dispatchEvent(new CustomEvent('tagsSelected', { 
                      detail: { tags: [], mode: tagFilterMode } 
                    }));
                  }}
                >
                  Clear Tag Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {displayedPosts.map((post) => (
                <PostCard 
                  key={post.id}
                  id={post.id}
                  slug={post.slug}
                  authorId={post.user_id}
                  author={deriveProfileHandle(post.profiles as ProfileHandleSource | null, 'anonymous')}
                  timeAgo={getTimeAgo(post.created_at)}
                  title={post.title || post.content?.substring(0, 100) || 'Untitled'}
                  content={post.content || ''}
                  image={post.image_url || ''}
                  category={post.category}
                  examType={post.exam_type || ''}
                  comments={post.comments_count || 0}
                  views={post.views_count || 0}
                  tags={post.tags || []}
                  avatarUrl={post.profiles?.avatar_url}
                />
              ))}

              {isFetchingNextPage && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
          )}
        </div>

        <div ref={loadMoreRef} className="h-1" aria-hidden />
      </div>
    </>
  );
};

export default Home;
