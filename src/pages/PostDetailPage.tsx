import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, ThumbsUp, Share2, Loader2 } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useLikes } from "@/hooks/useLikes";
import { supabase } from "@/integrations/supabase/client";
import { CommentSection } from "@/components/posts/CommentSection";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { usePostView } from "@/hooks/usePostView";
import { createRealtimeChannel } from "@/lib/realtime";
import { removeTagsFromContent } from "@/lib/utils";
import { deriveProfileHandle, deriveProfileInitial, getAvatarUrl, type ProfileHandleSource } from "@/lib/profileDisplay";
import { useNotificationTriggers } from "@/hooks/useNotificationTriggers";
import { toast } from "sonner";
import { buildImageUrl } from "@/lib/images";

// Helper to check if string is UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export default function PostDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only call useLikes when we have a post ID
  const { hasLiked, likesCount, toggleLike } = useLikes(post?.id || null, user?.id);

  
  const handleLike = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    toggleLike();
  };

  const handleSharePost = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    // Use slug if available, otherwise fallback to ID
    const postIdentifier = post?.slug || post?.id || slug || "";
    const shareUrl = `${window.location.origin}/post/${postIdentifier}`;
    navigator.clipboard.writeText(shareUrl);
    toast( "Post link copied to your clipboard");
  };
  const { startTrackingPostView, stopTrackingPostView } = useNotificationTriggers();

  // Track post view
  usePostView(post?.id);

  // Start tracking post view time for follow-up notifications
  useEffect(() => {
    if (post?.id && user) {
      startTrackingPostView(post.id);
      return () => {
        stopTrackingPostView(post.id);
      };
    }
  }, [post?.id, user, startTrackingPostView, stopTrackingPostView]);

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) return;

      try {
        setLoading(true);
        setError(null);

        let postData: any = null;

        // Check if slug is actually a UUID (backward compatibility for old ID URLs)
        if (isUUID(slug)) {
          // It's a UUID, fetch by ID and redirect to slug URL if slug exists
          // Optimized: Select only needed columns
          const { data, error } = await (supabase as any)
            .from("posts")
            .select("id, user_id, title, content, image_r2_key, category, exam_type, likes_count, comments_count, trend_score, created_at, slug, post_type, link_url, topic_id")
            .eq("id", slug)
            .maybeSingle();
          
          if (error && error.code !== 'PGRST116') {
            throw error;
          }

          postData = data;

          // If post found and has a slug, redirect to slug URL
          if (postData && postData.slug) {
            navigate(`/post/${postData.slug}`, { replace: true });
            return;
          }
        } else {
          // It's a slug, fetch by slug (try exact match first, then case-insensitive)
          console.log("🔍 Fetching post by slug:", slug);
          
          // Optimized: Select only needed columns
          let { data, error } = await (supabase as any)
            .from("posts")
            .select("id, user_id, title, content, image_r2_key, category, exam_type, likes_count, comments_count, trend_score, created_at, slug, post_type, link_url, topic_id")
            .eq("slug", slug)
            .maybeSingle();
          
          if (error && error.code !== 'PGRST116') {
            console.error("❌ Error fetching by slug:", error);
            throw error;
          }

          postData = data;
          console.log("📄 Post data from exact slug match:", postData ? "Found" : "Not found");
          
          // If exact match failed, try case-insensitive
          if (!postData) {
            console.log("🔍 Trying case-insensitive slug match...");
            const { data: caseInsensitiveData, error: caseInsensitiveError } = await (supabase as any)
              .from("posts")
              .select("id, user_id, title, content, image_r2_key, category, exam_type, likes_count, comments_count, trend_score, created_at, slug, post_type, link_url, topic_id")
              .ilike("slug", slug)
              .maybeSingle();
            
            if (caseInsensitiveError && caseInsensitiveError.code !== 'PGRST116') {
              console.error("❌ Error in case-insensitive search:", caseInsensitiveError);
              throw caseInsensitiveError;
            }

            if (caseInsensitiveData) {
              console.log("✅ Found post with case-insensitive match");
              postData = caseInsensitiveData;
              
              // If slugs differ, redirect to correct slug
              const dbSlugNormalized = (caseInsensitiveData.slug || "").trim().toLowerCase();
              const urlSlugNormalized = slug.trim().toLowerCase();
              
              if (caseInsensitiveData.slug && dbSlugNormalized !== urlSlugNormalized) {
                console.log("🔄 Redirecting to correct slug URL:", caseInsensitiveData.slug);
                navigate(`/post/${caseInsensitiveData.slug}`, { replace: true });
                return;
              }
            } else {
              console.log("❌ No case-insensitive match found");
            }
          }

          // If still no results, try partial slug match (slug might be truncated in DB)
          if (!postData) {
            console.log("🔍 Trying partial slug match (slug might be truncated in database)...");
            
            // Try matching first part of slug (database slug might be shorter)
            const slugPrefix = slug.substring(0, Math.min(80, slug.length));
            const { data: partialMatches, error: partialError } = await (supabase as any)
              .from("posts")
              .select("id, user_id, title, content, image_r2_key, category, exam_type, likes_count, comments_count, trend_score, created_at, slug, post_type, link_url, topic_id")
              .ilike("slug", `${slugPrefix}%`)
              .limit(10);
            
            if (!partialError && partialMatches && partialMatches.length > 0) {
              // Find the best match - one where the slug starts with our prefix
              const bestMatch = partialMatches.find((p: any) => {
                if (!p.slug) return false;
                const dbSlug = p.slug.toLowerCase();
                const searchSlug = slug.toLowerCase();
                // Check if database slug starts with search slug prefix or vice versa
                return dbSlug.startsWith(searchSlug.substring(0, 40)) || 
                       searchSlug.startsWith(dbSlug.substring(0, 40));
              });
              
              if (bestMatch) {
                console.log("✅ Found post by partial slug match");
                console.log("📝 Matched post title:", bestMatch.title);
                console.log("🔗 Database slug:", bestMatch.slug);
                console.log("🔗 URL slug:", slug);
                
                // Only redirect if slugs are actually different (normalize for comparison)
                const dbSlugNormalized = (bestMatch.slug || "").trim().toLowerCase();
                const urlSlugNormalized = slug.trim().toLowerCase();
                
                if (bestMatch.slug && dbSlugNormalized !== urlSlugNormalized) {
                  console.log("🔄 Redirecting to correct slug URL:", bestMatch.slug);
                  navigate(`/post/${bestMatch.slug}`, { replace: true });
                  return;
                } else {
                  console.log("✅ Slugs match exactly, using found post");
                  postData = bestMatch;
                  // Don't return here - continue to fetch profile and tags
                }
              }
            }
          }
          
          // If still no results, try to find by matching slug against title
          // This handles cases where slug in URL was generated from title but doesn't match database slug
          if (!postData) {
            console.log("🔍 Trying to find post by title match (slug might be NULL or different)...");
            
            // Fetch recent posts and match by slugifying their titles
            const { data: recentPosts, error: recentError } = await (supabase as any)
              .from("posts")
              .select("id, user_id, title, content, image_r2_key, category, exam_type, likes_count, comments_count, trend_score, created_at, slug, post_type, link_url, topic_id")
              .order("created_at", { ascending: false })
              .limit(200); // Check last 200 posts to be safe
            
            if (!recentError && recentPosts) {
              // Helper function to create slug from text
              const createSlug = (text: string): string => {
                return text
                  .toLowerCase()
                  .trim()
                  .replace(/[^\w\s-]/g, '') // Remove special chars
                  .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphens
                  .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
              };
              
              // Find post where slugified title matches the URL slug
              const matchedPost = recentPosts.find((p: any) => {
                if (!p.title) return false;
                
                // Create a slug from the title
                const titleSlug = createSlug(p.title);
                
                // Also check if the database slug matches (even if it's different from title slug)
                const dbSlug = (p.slug || "").toLowerCase();
                const searchSlug = slug.toLowerCase();
                
                // Check multiple matching strategies:
                // 1. Exact match with title slug
                // 2. Prefix match (at least 40 chars)
                // 3. Database slug match (if exists)
                const minMatchLength = Math.min(slug.length, titleSlug.length, 40);
                
                if (minMatchLength >= 10) {
                  // Check title slug match
                  if (titleSlug === searchSlug || 
                      (titleSlug.length >= minMatchLength && titleSlug.substring(0, minMatchLength) === searchSlug.substring(0, minMatchLength)) ||
                      (searchSlug.length >= minMatchLength && searchSlug.substring(0, minMatchLength) === titleSlug.substring(0, minMatchLength))) {
                    return true;
                  }
                }
                
                // Check database slug match (if it exists)
                if (dbSlug && dbSlug.length >= 10) {
                  if (dbSlug === searchSlug || 
                      dbSlug.startsWith(searchSlug.substring(0, Math.min(40, searchSlug.length))) ||
                      searchSlug.startsWith(dbSlug.substring(0, Math.min(40, dbSlug.length)))) {
                    return true;
                  }
                }
                
                return false;
              });
              
              if (matchedPost) {
                console.log("✅ Found post by title match");
                console.log("📝 Matched post title:", matchedPost.title);
                console.log("🔗 Database slug:", matchedPost.slug || "NULL");
                console.log("🔗 URL slug:", slug);
                
                postData = matchedPost;
                
                // Normalize slugs for comparison
                const dbSlugNormalized = (matchedPost.slug || "").trim().toLowerCase();
                const urlSlugNormalized = slug.trim().toLowerCase();
                
                // If the matched post has a slug, redirect to correct slug URL only if different
                if (matchedPost.slug && dbSlugNormalized !== urlSlugNormalized) {
                  console.log("🔄 Redirecting to correct slug URL:", matchedPost.slug);
                  navigate(`/post/${matchedPost.slug}`, { replace: true });
                  return;
                } else if (!matchedPost.slug) {
                  // Post has no slug, redirect to ID-based URL
                  console.log("🔄 Post has no slug, redirecting to ID URL:", matchedPost.id);
                  navigate(`/post/${matchedPost.id}`, { replace: true });
                  return;
                } else {
                  console.log("✅ Slugs match, no redirect needed");
                }
              } else {
                console.log("❌ No post found by title match");
              }
            }
          }

          // If still no results, try as ID fallback ONLY if slug could be a UUID
          if (!postData && isUUID(slug)) {
            console.log("🔍 Trying ID fallback (slug looks like UUID)...");
            const { data: idData, error: idError } = await (supabase as any)
              .from("posts")
              .select("id, user_id, title, content, image_r2_key, category, exam_type, likes_count, comments_count, trend_score, created_at, slug, post_type, link_url, topic_id")
              .eq("id", slug)
              .maybeSingle();
            
            if (idError && idError.code !== 'PGRST116') {
              console.error("❌ Error in ID fallback:", idError);
              // Don't throw UUID parsing errors - they're expected for non-UUID slugs
              if (idError.code !== '22P02') {
                throw idError;
              }
            }

            if (idData) {
              console.log("✅ Found post by ID fallback");
              postData = idData;
              // If post found by ID and has a slug, redirect to slug URL
              if (postData.slug) {
                console.log("🔄 Redirecting to slug URL:", postData.slug);
                navigate(`/post/${postData.slug}`, { replace: true });
                return;
              }
            } else {
              console.log("❌ No post found by ID fallback");
            }
          }
        }

        // If no post found at all after all attempts
        if (!postData) {
          setError("Post not found");
          setLoading(false);
          return;
        }

        // Fetch profile (postData is guaranteed to exist here)
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, avatar_r2_key, avatar_url")
          .eq("id", postData.user_id)
          .single();

        // Fetch tags through post_tags junction table
        const { data: postTagsData } = await (supabase as any)
          .from('post_tags')
          .select('tag_id, tags(name)')
          .eq('post_id', postData.id);

        const tags = postTagsData?.map((pt: any) => pt.tags?.name).filter(Boolean) || [];

        setPost({
          ...postData,
          profiles: profileData,
          tags: tags // Override with tags from post_tags
        });
      } catch (err: any) {
        console.error("Error fetching post:", err);
        setError(err.message || "Failed to fetch post");
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [slug, navigate]);

  // Scoped realtime subscriptions for post detail page
  useEffect(() => {
    if (!post?.id) return;
    if (typeof window === "undefined") return; // SSR guard

    const refetchPost = async () => {
      try {
        const { data: postData, error: fetchError } = await (supabase as any)
          .from("posts")
          .select("id, user_id, title, content, image_r2_key, category, exam_type, likes_count, comments_count, trend_score, created_at, slug, post_type, link_url, topic_id")
          .eq("id", post.id)
          .single();

        if (!fetchError && postData) {
          // Fetch profile
          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, username, avatar_r2_key, avatar_url")
            .eq("id", postData.user_id)
            .single();

          // Fetch tags
          const { data: postTagsData } = await (supabase as any)
            .from('post_tags')
            .select('tag_id, tags(name)')
            .eq('post_id', post.id);

          const tags = postTagsData?.map((pt: any) => pt.tags?.name).filter(Boolean) || [];

          setPost({
            ...(postData as any),
            profiles: profileData,
            tags: tags
          });
        }
      } catch (err) {
        console.error("Error refetching post:", err);
      }
    };

    const rt = createRealtimeChannel(`realtime:post-detail:${post.id}`);

    // Listen to post updates
    rt.onPostgresChange(
      { table: "posts", event: "UPDATE", filter: `id=eq.${post.id}` },
      () => {
        refetchPost();
      }
    );

    // Listen to likes changes (for immediate UI updates)
    rt.onPostgresChange(
      { table: "likes", event: "*", filter: `post_id=eq.${post.id}` },
      () => {
        // Likes hook will handle the actual count update
        // This subscription ensures immediate visibility
      }
    );

    // Listen to comments changes (for immediate UI updates)
    rt.onPostgresChange(
      { table: "comments", event: "*", filter: `post_id=eq.${post.id}` },
      () => {
        // Comments hook will handle the actual updates
        // This subscription ensures immediate visibility
      }
    );

    rt.subscribe().catch((err: any) => {
      console.error("Failed to subscribe to post detail realtime:", err);
    });

    return () => {
      rt.unsubscribe();
    };
  }, [post?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Post not found.</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link to="/">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Link>
      </Button>

      <Card className="p-6 mb-6">
        {/* Post Header */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={getAvatarUrl(post.profiles, 40) || undefined} />
            <AvatarFallback>
              {deriveProfileInitial(post.profiles as ProfileHandleSource | null)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Link
                to={`/profile/${post.user_id}`}
                className="font-semibold hover:underline"
              >
                {deriveProfileHandle(post.profiles as ProfileHandleSource | null, "anonymous")}
              </Link>
              <span className="text-sm text-muted-foreground">
                • {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </span>
            </div>
            {post.category && (
              <span className="text-xs text-muted-foreground">{post.category}</span>
            )}
          </div>
        </div>

        {/* Post Title */}
        {post.title && (
          <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
        )}

        {/* Post Content */}
        {post.content && (
          <p className="text-base mb-4 whitespace-pre-wrap">
            {removeTagsFromContent(post.content, post.tags || [])}
          </p>
        )}

        {/* Post Tags - Display tags from post_tags table */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag: string, idx: number) => (
              <span
                key={idx}
                className="px-2 py-1 text-xs bg-secondary rounded-full hover:bg-secondary/80 cursor-pointer transition-colors"
                onClick={() => {
                  // Navigate to tag filter page
                  window.location.href = `/?tag=${tag}`;
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Post Image */}
        {(() => {
          const imageUrl = buildImageUrl({
            r2Key: post.image_r2_key || null,
            isLcp: false, // Detail page doesn't need LCP optimization
          });

          if (!imageUrl) {
            return null;
          }

          return (
            <div className="post-image-container">
              <img
                src={imageUrl}
                alt={post.title || "Post image"}
                className="post-image"
                loading="eager"
                decoding="async"
                width={800}
                height={450}
                style={{ aspectRatio: "16 / 9" }}
              />
            </div>
          );
        })()}

        {/* Post Link */}
        {post.link_url && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 border rounded-lg hover:bg-secondary/50 transition-colors mb-4"
          >
            <span className="text-sm text-primary hover:underline">
              {post.link_url}
            </span>
          </a>
        )}

        {/* Post Actions */}
        <div className="flex items-center gap-4 pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 hover:bg-transparent"
            onClick={handleLike}
          >
            <ThumbsUp
              className={`h-5 w-5 transition-colors ${
                hasLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"
              }`}
            />
            <span className="font-medium">{likesCount}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2  text-muted-foreground"
            onClick={handleSharePost}
          >
            <Share2 className="h-5 w-5" 
             />
            Share
          </Button>
          <span className="ml-auto text-sm text-muted-foreground">
            {post.comments_count || 0} comments
          </span>
        </div>
      </Card>

      {/* Comments Section */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Comments</h2>
        <CommentSection postId={post?.id || ""} postSlug={post?.slug} />
      </Card>
    </div>
  );
}
