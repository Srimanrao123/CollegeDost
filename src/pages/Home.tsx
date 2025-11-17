import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { PostCard } from "@/components/posts/PostCard";
import { PostCardSkeleton } from "@/components/posts/PostCardSkeleton";
import { Button } from "@/components/ui/button";
import { useHomePosts } from "@/hooks/useHomePosts";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { createRealtimeChannel } from "@/lib/realtime";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { ProfileService } from "@/services/profileService";
import { deriveProfileHandle, getAvatarUrl, type ProfileHandleSource } from "@/lib/profileDisplay";
import { buildImageUrl } from "@/lib/images";

// PERFORMANCE: Lazy load CreatePost and notifications (not critical for first paint)
const CreatePost = lazy(() => import("@/components/posts/CreatePost").then(m => ({ default: m.CreatePost })));
const ProfileUpdateNotification = lazy(() => import("@/components/notifications/ProfileUpdateNotification").then(m => ({ default: m.ProfileUpdateNotification })));
const PushNotificationConsent = lazy(() => import("@/components/notifications/PushNotificationConsent").then(m => ({ default: m.PushNotificationConsent })));

const Home = () => {
  const [sortBy, setSortBy] = useState("best");
  const { user, isAuthenticated } = useAuth();
  const [interestedExams, setInterestedExams] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'any' | 'all'>('any');
  const [loopMode, setLoopMode] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10); // Initial visible posts count

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
  
  // TWO-STAGE FETCHING: 
  // Stage 1: Fetch 2 posts immediately (eager image loading)
  // Stage 2: Fetch remaining posts in background (lazy image loading)
  const { posts, initialPosts, remainingPosts, loading, loadingRemaining } = useHomePosts(
    tagFilter,
    examFilter
  );

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // PERFORMANCE: Initialize notification triggers (lightweight, doesn't block render)
  useNotificationTriggers();

  // Preload first post image for faster LCP (Largest Contentful Paint)
  // This significantly improves LCP, FCP, and SI metrics
  useEffect(() => {
    if (initialPosts && initialPosts.length > 0) {
      const firstPost = initialPosts[0];
      if (firstPost && firstPost.image_r2_key) {
        const imageUrl = buildImageUrl({
          r2Key: firstPost.image_r2_key,
          isLcp: true, // First post is LCP
        });
        
        if (imageUrl) {
          // Extract domain for preconnect
          try {
            const url = new URL(imageUrl);
            const domain = url.origin;
            
            // Add preconnect for CDN domain if not already present
            const existingPreconnect = document.querySelector(`link[rel="preconnect"][href="${domain}"]`);
            if (!existingPreconnect) {
              const preconnectLink = document.createElement('link');
              preconnectLink.rel = 'preconnect';
              preconnectLink.href = domain;
              preconnectLink.setAttribute('crossorigin', 'anonymous');
              document.head.appendChild(preconnectLink);
            }
          } catch (e) {
            // URL parsing failed, skip preconnect
          }
          
          // Preload first post image (highest priority)
          const existingLink = document.querySelector(`link[data-preload="first-post-image"]`);
          if (existingLink) {
            existingLink.remove();
          }
          
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'image';
          link.href = imageUrl;
          link.setAttribute('fetchpriority', 'high');
          link.setAttribute('data-preload', 'first-post-image');
          document.head.appendChild(link);
        }
      }
    }
  }, [initialPosts]);

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

  // PERFORMANCE: Defer fetching interested exams (non-critical for first paint)
  // This reduces initial data fetching and improves FCP
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

    // Fetch after initial render to avoid blocking first paint
    const examTimer = setTimeout(() => {
      fetchInterestedExams();
    }, 200); // Small delay to prioritize post loading

    // PERFORMANCE: Defer realtime subscription (non-critical for first paint)
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

    // Setup realtime after a delay to avoid blocking initial render
    const realtimeTimer = setTimeout(() => {
      setupRealtime();
    }, 500);

    return () => {
      clearTimeout(examTimer);
      clearTimeout(realtimeTimer);
    };
  }, [user]);

  // Reset state when filters change
  useEffect(() => {
    setLoopMode(false);
    setVisibleCount(10);
  }, [tagFilter, examFilter]);

  // PERFORMANCE: Memoize sort function to prevent recalculation on every render
  const sortPosts = useMemo(() => {
    return (postsToSort: any[]) => {
      switch (sortBy) {
        case "new":
          return [...postsToSort].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "top":
          return [...postsToSort].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
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
  }, [sortBy]);

  // PERFORMANCE: Memoize sorted posts to prevent unnecessary re-sorting
  const sortedPosts = useMemo(() => sortPosts(posts), [posts, sortPosts]);
  
  // PERFORMANCE: Limit initial DOM size to improve rendering performance
  // Show all posts, but limit to reasonable number for initial render
  // This prevents enormous DOM size that slows down rendering
  const displayedPosts = useMemo(() => {
    if (loopMode && sortedPosts.length > 8) {
      // Create array of visible indices using modulo
      return Array.from({ length: visibleCount }, (_, i) => 
        sortedPosts[i % sortedPosts.length]
      );
    }
    // Normal mode: show all sorted posts (already limited by two-stage fetching)
    // Maximum ~22 posts (2 initial + 20 remaining) which is reasonable for DOM size
    return sortedPosts;
  }, [sortedPosts, loopMode, visibleCount]);

  // PERFORMANCE: Simple time ago calculation (lightweight, no memoization needed)
  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const seconds = Math.floor((now.getTime() - created.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // PERFORMANCE: Show exactly 2 skeleton loaders matching the 2-post limit
  // Fixed heights prevent CLS (Cumulative Layout Shift)
  if (loading && posts.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <CreatePost />
        <div className="flex items-center justify-between mb-4 mt-6">
          <h2 className="text-xl font-semibold">Posts For You</h2>
        </div>
        <div className="space-y-4">
          <PostCardSkeleton isFirstPost={true} />
          <PostCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* PERFORMANCE: Lazy load notifications (non-critical for first paint) */}
      <Suspense fallback={null}>
        <ProfileUpdateNotification />
        <PushNotificationConsent />
      </Suspense>
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {/* PERFORMANCE: Lazy load CreatePost (not needed for initial render) */}
        <Suspense fallback={<div className="h-20 mb-4" />}>
          <CreatePost />
        </Suspense>

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
          {displayedPosts.length === 0 ? (
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
              {/* TWO-STAGE RENDERING:
                  - First 2 posts: Eager image loading (immediate render)
                  - Remaining posts: Lazy image loading (loaded in background) */}
              {displayedPosts.map((post, index) => {
                const isFirstPost = index === 0;
                // Check if post is in initialPosts array (first 2 posts) for eager loading
                // This ensures eager loading works even after remaining posts are appended
                const isEager = initialPosts.some(p => p.id === post.id);
                
                return (
                  <PostCard 
                    key={post.id}
                    id={post.id}
                    slug={post.slug}
                    authorId={post.user_id}
                    author={deriveProfileHandle(post.profiles as ProfileHandleSource | null, 'anonymous')}
                    timeAgo={getTimeAgo(post.created_at)}
                    title={post.title || post.content?.substring(0, 100) || 'Untitled'}
                    content={post.content || ''}
                    imageR2Key={post.image_r2_key || null}
                    category={post.category}
                    examType={post.exam_type || ''}
                    comments={post.comments_count || 0}
                    views={post.views_count || 0}
                    tags={post.tags || []}
                    avatarUrl={getAvatarUrl(post.profiles, 40) || undefined}
                    isFirstPost={isFirstPost}
                    eager={isEager} // Force eager loading for first 2 posts (from initialPosts)
                  />
                );
              })}
              
              {/* Show loading indicator while fetching remaining posts */}
              {loadingRemaining && (
                <div className="flex justify-center py-4">
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
