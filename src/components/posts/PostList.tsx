import { useMemo } from "react";
import { usePosts } from "@/hooks/usePosts";
import { PostCard } from "@/components/posts/PostCard";
import { PostCardSkeleton } from "@/components/posts/PostCardSkeleton";
import { deriveProfileHandle, getAvatarUrl, type ProfileHandleSource } from "@/lib/profileDisplay";

export function PostList() {
  const { posts, loading } = usePosts();

  const emptyMessage = useMemo(() => (
    'No posts yet. Be the first to create one!'
  ), []);

  // Show skeleton loaders immediately for better FCP
  if (loading && posts.length === 0) {
    return (
      <div className="space-y-4">
        <PostCardSkeleton isFirstPost={true} />
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post: any, index: number) => (
        <PostCard 
          key={post.id}
          id={post.id}
          slug={post.slug}
          authorId={post.user_id}
          author={deriveProfileHandle(post.profiles as ProfileHandleSource | null, 'anonymous')}
          timeAgo={new Date(post.created_at).toLocaleString()}
          title={post.title || post.content?.substring(0, 100) || 'Untitled'}
          content={post.content || ''}
          imageR2Key={post.image_r2_key || null}
          category={post.category}
          examType={post.exam_type || ''}
          comments={post.comments_count || 0}
          views={post.views_count || 0}
          tags={post.tags || []}
          avatarUrl={getAvatarUrl(post.profiles, 40) || undefined}
          isFirstPost={index === 0} // Optimize first post for LCP
        />
      ))}
    </div>
  );
}


