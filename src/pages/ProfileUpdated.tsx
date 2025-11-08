import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Loader2, Share2, Plus, Eye, Image as ImageIcon, MoreVertical, Edit } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFollows } from "@/hooks/useFollows";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/posts/PostCard";
import { FollowButton } from "@/components/profile/FollowButton";
import { FollowersModal } from "@/components/profile/FollowersModal";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { EditBannerModal } from "@/components/profile/EditBannerModal";
import { CreatePostDialog } from "@/components/posts/CreatePostDialog";
import { formatDistanceToNow } from "date-fns";
import {
  deriveProfileDisplayName,
  deriveProfileHandle,
  deriveProfileInitial,
  type ProfileHandleSource,
} from "@/lib/profileDisplay";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  state?: string | null;
  entrance_exam?: string[] | null;
  followers_count: number;
  following_count: number;
}

type PostAuthorProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
} | null;

const ProfileUpdated = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);

  const profileId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;
  
  // Use optimized React Query hook for profile data
  const { profile, isLoading: profileLoading } = useProfile(profileId);

  const targetProfileId = profile?.id || profileId;

  const profileHandle = useMemo(() => {
    if (!profile) return "user";
    return deriveProfileHandle(
      {
        full_name: profile.full_name ?? undefined,
        id: profile.id,
      },
      "user"
    );
  }, [profile?.full_name, profile?.id]);

  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [commentedPosts, setCommentedPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [likedPostsLoading, setLikedPostsLoading] = useState(false);
  const [commentedPostsLoading, setCommentedPostsLoading] = useState(false);
  const { followers, following, refetch: refetchFollows, loading: followsLoading } = useFollows(targetProfileId);
  const syncedProfileIdRef = useRef<string | null>(null);
  
  const loading = profileLoading || postsLoading;

  const handleShareProfile = useCallback(async () => {
    if (typeof window === "undefined") return;

    const shareUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      toast({
        title: "Profile link copied!",
        description: "Share it with your friends.",
      });
    } catch (error) {
      console.error("Failed to copy profile link:", error);
      toast({
        title: "Unable to copy link",
        description: shareUrl,
        variant: "destructive",
      });
    }
  }, [toast]);

  // Reset sync ref when profile changes
  useEffect(() => {
    if (targetProfileId && syncedProfileIdRef.current !== targetProfileId) {
      syncedProfileIdRef.current = null;
    }
  }, [targetProfileId]);

  // Sync profile counts with actual follows table counts when profile loads
  useEffect(() => {
    const syncCounts = async () => {
      if (!targetProfileId || !profile || syncedProfileIdRef.current === targetProfileId) return;

      try {
        // Get actual counts from follows table
        const [followersCountResult, followingCountResult] = await Promise.all([
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', targetProfileId),
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', targetProfileId),
        ]);

        const actualFollowersCount = followersCountResult.count ?? 0;
        const actualFollowingCount = followingCountResult.count ?? 0;

        // Update profile counts if they don't match
        if (
          profile.followers_count !== actualFollowersCount ||
          profile.following_count !== actualFollowingCount
        ) {
          await supabase
            .from('profiles')
            .update({
              followers_count: actualFollowersCount,
              following_count: actualFollowingCount,
            })
            .eq('id', targetProfileId);

          // Trigger profile refresh
          window.dispatchEvent(new CustomEvent('profileUpdated'));
        }

        syncedProfileIdRef.current = targetProfileId;
      } catch (error) {
        console.error('Error syncing follower counts:', error);
      }
    };

    // Sync when profile is loaded
    if (profile && targetProfileId) {
      syncCounts();
    }
  }, [targetProfileId, profile]);

  // Refresh follows when modal opens
  useEffect(() => {
    if (showFollowersModal || showFollowingModal) {
      refetchFollows();
    }
  }, [showFollowersModal, showFollowingModal, refetchFollows]);

  // Fetch user posts (profile is now handled by useProfile hook)
  useEffect(() => {
    const fetchPosts = async () => {
      if (!targetProfileId) {
        setPostsLoading(false);
        return;
      }

      try {
        setPostsLoading(true);

        const postsResult = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', targetProfileId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (postsResult.error) {
          console.error('Error fetching posts:', postsResult.error);
          setUserPosts([]);
        } else {
          let postsWithProfiles = postsResult.data || [];

          if (postsWithProfiles.length > 0) {
            const userIds = [...new Set(postsWithProfiles.map((post) => post.user_id))];
            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('id, username, avatar_url, full_name')
              .in('id', userIds);

            if (profilesError) {
              console.error('Error fetching post authors:', profilesError);
            }

            postsWithProfiles = postsWithProfiles.map((post) => ({
              ...post,
              profiles: profilesData?.find((p) => p.id === post.user_id) || null,
            }));
          }

          setUserPosts(postsWithProfiles);
        }
      } catch (error) {
        console.error('Error fetching posts:', error);
        setUserPosts([]);
      } finally {
        setPostsLoading(false);
      }
    };

    fetchPosts();
  }, [profileId, targetProfileId]);

  // Fetch liked posts (only for own profile)
  useEffect(() => {
    const fetchLikedPosts = async () => {
      if (!isOwnProfile || !user?.id) {
        setLikedPosts([]);
        setLikedPostsLoading(false);
        return;
      }

      try {
        setLikedPostsLoading(true);
        
        // Get post IDs that user has liked (where comment_id is null for post likes)
        const { data: likesData, error: likesError } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user.id)
          .is('comment_id', null)
          .not('post_id', 'is', null);

        if (likesError) {
          console.error('Error fetching liked posts:', likesError);
          setLikedPosts([]);
          return;
        }

        if (!likesData || likesData.length === 0) {
          setLikedPosts([]);
          return;
        }

        const postIds = [...new Set(likesData.map(like => like.post_id).filter(Boolean))];

        if (postIds.length === 0) {
          setLikedPosts([]);
          return;
        }

        // Fetch posts
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .in('id', postIds)
          .order('created_at', { ascending: false });

        if (postsError) {
          console.error('Error fetching liked posts data:', postsError);
          setLikedPosts([]);
          return;
        }

        // Fetch author profiles, tags, and views
        if (postsData && postsData.length > 0) {
          const userIds = [...new Set(postsData.map((post) => post.user_id))];
          const postIds = postsData.map((post) => post.id);
          
          // Fetch profiles
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, full_name')
            .in('id', userIds);

          // Fetch tags
          const { data: postTagsData } = await (supabase as any)
            .from('post_tags')
            .select('post_id, tag_id, tags(name)')
            .in('post_id', postIds);

          const tagsMap: Record<string, string[]> = {};
          if (postTagsData) {
            postTagsData.forEach((pt: any) => {
              if (!tagsMap[pt.post_id]) tagsMap[pt.post_id] = [];
              if (pt.tags?.name) tagsMap[pt.post_id].push(pt.tags.name);
            });
          }

          // Fetch view counts
          const { data: viewsData } = await (supabase as any)
            .from('post_views')
            .select('post_id')
            .in('post_id', postIds);

          const viewsMap: Record<string, number> = {};
          if (viewsData) {
            viewsData.forEach((view: any) => {
              if (view && view.post_id) {
                viewsMap[view.post_id] = (viewsMap[view.post_id] || 0) + 1;
              }
            });
          }

          const postsWithData = postsData.map((post) => ({
            ...post,
            profiles: profilesData?.find((p) => p.id === post.user_id) || null,
            tags: tagsMap[post.id] || [],
            views_count: viewsMap[post.id] || 0,
          }));

          setLikedPosts(postsWithData);
        } else {
          setLikedPosts([]);
        }
      } catch (error) {
        console.error('Error fetching liked posts:', error);
        setLikedPosts([]);
      } finally {
        setLikedPostsLoading(false);
      }
    };

    fetchLikedPosts();
  }, [isOwnProfile, user?.id]);

  // Fetch posts user has commented on (only for own profile)
  useEffect(() => {
    const fetchCommentedPosts = async () => {
      if (!isOwnProfile || !user?.id) {
        setCommentedPosts([]);
        setCommentedPostsLoading(false);
        return;
      }

      try {
        setCommentedPostsLoading(true);
        
        // Get unique post IDs that user has commented on
        const { data: commentsData, error: commentsError } = await supabase
          .from('comments')
          .select('post_id')
          .eq('user_id', user.id)
          .not('post_id', 'is', null);

        if (commentsError) {
          console.error('Error fetching commented posts:', commentsError);
          setCommentedPosts([]);
          return;
        }

        if (!commentsData || commentsData.length === 0) {
          setCommentedPosts([]);
          return;
        }

        const postIds = [...new Set(commentsData.map(comment => comment.post_id).filter(Boolean))];

        if (postIds.length === 0) {
          setCommentedPosts([]);
          return;
        }

        // Fetch posts
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .in('id', postIds)
          .order('created_at', { ascending: false });

        if (postsError) {
          console.error('Error fetching commented posts data:', postsError);
          setCommentedPosts([]);
          return;
        }

        // Fetch author profiles, tags, and views
        if (postsData && postsData.length > 0) {
          const userIds = [...new Set(postsData.map((post) => post.user_id))];
          const postIds = postsData.map((post) => post.id);
          
          // Fetch profiles
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, full_name')
            .in('id', userIds);

          // Fetch tags
          const { data: postTagsData } = await (supabase as any)
            .from('post_tags')
            .select('post_id, tag_id, tags(name)')
            .in('post_id', postIds);

          const tagsMap: Record<string, string[]> = {};
          if (postTagsData) {
            postTagsData.forEach((pt: any) => {
              if (!tagsMap[pt.post_id]) tagsMap[pt.post_id] = [];
              if (pt.tags?.name) tagsMap[pt.post_id].push(pt.tags.name);
            });
          }

          // Fetch view counts
          const { data: viewsData } = await (supabase as any)
            .from('post_views')
            .select('post_id')
            .in('post_id', postIds);

          const viewsMap: Record<string, number> = {};
          if (viewsData) {
            viewsData.forEach((view: any) => {
              if (view && view.post_id) {
                viewsMap[view.post_id] = (viewsMap[view.post_id] || 0) + 1;
              }
            });
          }

          const postsWithData = postsData.map((post) => ({
            ...post,
            profiles: profilesData?.find((p) => p.id === post.user_id) || null,
            tags: tagsMap[post.id] || [],
            views_count: viewsMap[post.id] || 0,
          }));

          setCommentedPosts(postsWithData);
        } else {
          setCommentedPosts([]);
        }
      } catch (error) {
        console.error('Error fetching commented posts:', error);
        setCommentedPosts([]);
      } finally {
        setCommentedPostsLoading(false);
      }
    };

    fetchCommentedPosts();
  }, [isOwnProfile, user?.id]);

  // Listen for new posts from this user (realtime)
  useEffect(() => {
    const realtimeProfileId = profile?.id || profileId;
    if (!realtimeProfileId || typeof window === "undefined") return;

    const channel = supabase
      .channel(`profile-posts-${realtimeProfileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: `user_id=eq.${realtimeProfileId}`,
        },
        async (payload) => {
          const newPost = payload.new;
          let authorProfileData: PostAuthorProfile = profile
            ? {
                id: profile.id,
                username: deriveProfileHandle(profile as ProfileHandleSource, "anonymous"),
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
              }
            : null;

          if (!authorProfileData) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('id, username, avatar_url, full_name')
              .eq('id', newPost.user_id)
              .maybeSingle();
            authorProfileData = profileData
              ? {
                  id: profileData.id,
                  username: deriveProfileHandle(profileData as ProfileHandleSource, "anonymous"),
                  full_name: profileData.full_name,
                  avatar_url: profileData.avatar_url,
                }
              : null;
          }
 
          setUserPosts((prev) => [
            {
              ...newPost,
              profiles: authorProfileData,
              tags: [],
              views_count: 0,
            },
            ...prev,
          ]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
          filter: `user_id=eq.${realtimeProfileId}`,
        },
        (payload) => {
          setUserPosts(prev => prev.map(post => 
            post.id === payload.new.id ? { ...post, ...payload.new } : post
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'posts',
          filter: `user_id=eq.${realtimeProfileId}`,
        },
        (payload) => {
          setUserPosts(prev => prev.filter(post => post.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profileId]);

  // Listen for openEditProfile event from Update Profile button
  useEffect(() => {
    const handleOpenEditProfile = () => {
      if (isOwnProfile) {
        setIsEditModalOpen(true);
      }
    };

    window.addEventListener('openEditProfile', handleOpenEditProfile);
    return () => window.removeEventListener('openEditProfile', handleOpenEditProfile);
  }, [isOwnProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-6 w-full overflow-hidden">
        <Card className="p-4 md:p-6">
          <p className="text-center">Profile not found</p>
        </Card>
      </div>
    );
  }

  // userPosts is now fetched directly, no need to filter

  return (
    <div className="w-full overflow-hidden">
      {/* Clean Profile Banner - Cover Photo Only */}
      <div className="relative w-full h-48 md:h-64 overflow-hidden">
        {profile.banner_url ? (
          <>
            <img
              src={profile.banner_url}
              alt="Profile banner"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-black/10 to-black/20 pointer-events-none" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 pointer-events-none" />
        )}
        {isOwnProfile && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 bg-background/80 hover:bg-background/90 backdrop-blur-sm"
            onClick={() => setIsBannerModalOpen(true)}
            aria-label="Edit banner"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Profile Content Container */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-6">
        {/* New Profile Header Wrapper */}
        <div className="profile-header flex flex-col md:flex-row md:justify-between md:items-start gap-4 md:gap-6 pb-6 border-b">
          {/* Header Left Group */}
          <div className="header-left-group flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 min-w-0">
            {/* Profile Picture with Negative Margin */}
            <div className="relative -mt-12 md:-mt-16 flex-shrink-0">
              <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background shadow-lg">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-3xl md:text-4xl bg-primary/10 text-primary font-semibold">
                  {deriveProfileInitial(profile as ProfileHandleSource)}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-0 right-0 h-8 w-8 rounded-full border-2 border-background shadow-md"
                  onClick={() => {
                    setIsEditModalOpen(true);
                  }}
                  aria-label="Edit avatar"
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Info Block */}
            <div className="info-block flex-1 min-w-0 w-full mt-0 sm:mt-8">
              {/* Full Name or Username and Handle */}
              <h1 className="text-2xl md:text-3xl font-bold mb-1 truncate">
                {deriveProfileDisplayName(profile as ProfileHandleSource)}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mb-3">
                @{deriveProfileHandle(profile as ProfileHandleSource, "anonymous")}
              </p>

              {/* Stats */}
              <div className="flex items-center gap-4 sm:gap-6 text-sm mb-3 flex-wrap">
                <span className="whitespace-nowrap">
                  <strong className="font-semibold">{userPosts.length}</strong> posts
                </span>
                <button 
                  className="hover:underline whitespace-nowrap"
                  onClick={() => setShowFollowersModal(true)}
                >
                  <strong className="font-semibold">
                    {!followsLoading ? followers.length : profile.followers_count}
                  </strong> followers
                </button>
                <button 
                  className="hover:underline whitespace-nowrap"
                  onClick={() => setShowFollowingModal(true)}
                >
                  <strong className="font-semibold">
                    {!followsLoading ? following.length : profile.following_count}
                  </strong> following
                </button>
              </div>

              {/* Bio and Details */}
              <div className="space-y-2 break-words">
                {profile.bio && (
                  <p className="text-sm text-foreground break-words">{profile.bio}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {profile.state && (
                    <span className="whitespace-nowrap">📍 {profile.state}</span>
                  )}
                  {profile.entrance_exam && profile.entrance_exam.length > 0 && (
                    <span className="break-words">🎓 {profile.entrance_exam.join(", ")}</span>
                  )}
                </div>
              </div>

              {/* Add Social Link Button */}
              {isOwnProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    // Handle add social link
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Social Link
                </Button>
              )}
            </div>
          </div>

          {/* Header Right Group - Action Buttons */}
          <div className="header-right-group flex items-center gap-2 flex-shrink-0 mt-0 sm:mt-8">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={handleShareProfile}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleShareProfile}
              className="sm:hidden"
              aria-label="Share profile"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            {isOwnProfile ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(true)}
                  className="hidden sm:inline-flex"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsEditModalOpen(true)}
                  className="sm:hidden"
                  aria-label="Edit Profile"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <FollowButton userId={profileId!} />
            )}
            <Button
              variant="outline"
              size="icon"
              className="hidden sm:inline-flex"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs - Positioned Below Profile Header */}
        <div className="mt-6">
          <Tabs defaultValue="posts" className="w-full">
            <div className="border-b">
              <TabsList className="h-auto p-0 bg-muted/30 border-b">
                <TabsTrigger 
                  value="posts" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-semibold px-4 py-3"
                >
                  Posts
                </TabsTrigger>
                {isOwnProfile && (
                  <>
                    <TabsTrigger 
                      value="liked"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-semibold px-4 py-3"
                    >
                      Liked
                    </TabsTrigger>
                    <TabsTrigger 
                      value="comments"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary font-semibold px-4 py-3"
                    >
                      Comments
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </div>

            {/* Content Filter Bar */}
            <div className="flex items-center justify-between py-3 px-4 bg-muted/30 border-b">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>Showing all content</span>
              </div>
              <div className="flex items-center gap-2">
                {isOwnProfile && (
                  <Button
                    size="sm"
                    onClick={() => setIsCreatePostOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Post
                  </Button>
                )}
              </div>
            </div>

            <TabsContent value="posts" className="mt-0 pt-6">
              {postsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : userPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="mb-4 text-muted-foreground">
                    <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">@{profileHandle} hasn't posted yet</h3>
                  {isOwnProfile && (
                    <Button
                      onClick={() => setIsCreatePostOpen(true)}
                      className="mt-4"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Post
                    </Button>
                  )}
                </div>
              ) : (
                <div className="w-full space-y-4">
                  {userPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      id={post.id}
                      authorId={post.user_id}
                      author={deriveProfileHandle(post.profiles as ProfileHandleSource | null, 'anonymous')}
                      timeAgo={formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      title={post.title}
                      content={post.content}
                      category={post.category}
                      examType={post.exam_type || ''}
                      image={post.image_url}
                      likes={post.likes_count}
                      dislikes={0}
                      comments={post.comments_count}
                      views={post.views_count || 0}
                      tags={post.tags || []}
                      avatarUrl={post.profiles?.avatar_url}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="liked" className="mt-0 pt-6">
              {likedPostsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : likedPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="mb-4 text-muted-foreground">
                    <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No liked posts yet</h3>
                  <p className="text-sm text-muted-foreground">Posts you like will appear here</p>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  {likedPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      id={post.id}
                      authorId={post.user_id}
                      author={deriveProfileHandle(post.profiles as ProfileHandleSource | null, 'anonymous')}
                      timeAgo={formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      title={post.title}
                      content={post.content}
                      category={post.category}
                      examType={post.exam_type || ''}
                      image={post.image_url}
                      likes={post.likes_count}
                      dislikes={0}
                      comments={post.comments_count}
                      views={post.views_count || 0}
                      tags={post.tags || []}
                      avatarUrl={post.profiles?.avatar_url}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="comments" className="mt-0 pt-6">
              {commentedPostsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : commentedPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="mb-4 text-muted-foreground">
                    <svg className="w-24 h-24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No comments yet</h3>
                  <p className="text-sm text-muted-foreground">Posts you've commented on will appear here</p>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  {commentedPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      id={post.id}
                      authorId={post.user_id}
                      author={deriveProfileHandle(post.profiles as ProfileHandleSource | null, 'anonymous')}
                      timeAgo={formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      title={post.title}
                      content={post.content}
                      category={post.category}
                      examType={post.exam_type || ''}
                      image={post.image_url}
                      likes={post.likes_count}
                      dislikes={0}
                      comments={post.comments_count}
                      views={post.views_count || 0}
                      tags={post.tags || []}
                      avatarUrl={post.profiles?.avatar_url}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <FollowersModal
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        followers={followers}
        title="Followers"
      />

      <FollowersModal
        isOpen={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
        followers={following}
        title="Following"
      />

      {isOwnProfile && (
        <>
          <EditBannerModal
            open={isBannerModalOpen}
            onOpenChange={setIsBannerModalOpen}
            profileId={profile.id}
            initialBannerUrl={profile.banner_url ?? undefined}
          />
          <EditProfileModal open={isEditModalOpen} onOpenChange={setIsEditModalOpen} />
          <CreatePostDialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen} />
        </>
      )}
    </div>
  );
};

export default ProfileUpdated;
