# Real-Time Social Feed Implementation Guide

## Overview
This implementation provides a fully real-time social feed using Supabase real-time subscriptions with no page reloads, optimistic UI updates, and proper nested comment support.

## Key Features

### ✅ 1. Real-Time Updates with Supabase Channels
- Posts, comments, and likes update in real-time across all clients
- No page reloads required
- Uses Supabase `postgres_changes` events

### ✅ 2. Optimistic UI Updates
- Like/unlike actions update instantly before database confirmation
- Automatic rollback on errors with toast notifications
- Instant feedback for better UX

### ✅ 3. Nested Comment Support
- Full support for comment replies using `parent_id`
- Real-time updates for nested replies
- Proper tree structure building and management

### ✅ 4. Image Optimization
- Lazy loading with `loading="lazy"` attribute
- Error fallback to placeholder images
- Smooth opacity transitions on load
- `IntersectionObserver` for smart image loading (see `OptimizedImage` component)

## Implementation Details

### Hooks Architecture

#### 1. `usePosts.tsx` - Real-Time Posts Feed
```typescript
// Features:
- Initial posts fetch
- Real-time subscriptions for INSERT, UPDATE, DELETE
- Automatically fetches new posts with profile data
- Optimistically updates posts in state
- No manual refetch needed
```

**Usage:**
```typescript
const { posts, loading } = usePosts();
```

#### 2. `useLikes.tsx` - Post Likes with Optimistic Updates
```typescript
// Features:
- Checks if user has liked post
- Fetches current likes count
- Optimistic toggle with rollback on error
- Real-time subscription for likes_count changes
- Shows error toast on failure
```

**Usage:**
```typescript
const { hasLiked, likesCount, toggleLike } = useLikes(postId, user?.id);
// Click handler calls toggleLike() - no parameters needed
```

#### 3. `useCommentLikes.tsx` - Comment Likes
```typescript
// Features:
- Same as useLikes but for comments
- Real-time subscription for comment likes_count
- Optimistic updates with rollback
```

**Usage:**
```typescript
const { hasLiked, likesCount, toggleLike } = useCommentLikes(commentId, user?.id);
```

#### 4. `useComments.tsx` - Nested Comments with Real-Time
```typescript
// Features:
- Builds comment tree from flat structure using parent_id
- Real-time subscriptions for INSERT, UPDATE, DELETE
- Handles nested replies automatically
- Supports sorting (best, newest, oldest)
- Updates only affected comments in state
```

**Usage:**
```typescript
const { comments, addComment, updateComment, deleteComment, sortBy, setSortBy } = useComments(postId);
```

### Real-Time Subscriptions

#### Posts Channel
```typescript
// Listens for:
- INSERT → Fetches new post with profile data
- UPDATE → Updates post in list
- DELETE → Removes post from list
```

#### Comments Channel
```typescript
// Listens for:
- INSERT → Adds new comment/reply to tree
- UPDATE → Updates comment in tree (including nested)
- DELETE → Removes comment from tree recursively
```

#### Likes Channels
```typescript
// Per post/comment:
- UPDATE → Updates likes_count when triggers fire
```

## Database Triggers

The implementation relies on these database triggers (from migrations):

1. **Post Likes Trigger**
   - On insert: `likes_count + 1`
   - On delete: `likes_count - 1`

2. **Comment Likes Trigger**
   - On insert: `likes_count + 1`
   - On delete: `likes_count - 1`

3. **Post Comments Trigger**
   - On insert: `comments_count + 1`
   - On delete: `comments_count - 1`

These triggers keep counts in sync automatically across all clients via real-time subscriptions.

## Component Updates

### PostCard.tsx
- Uses `useLikes` hook for real-time like functionality
- Shows red thumbs-up when liked (`fill-red-500 text-red-500`)
- Displays current likes count
- Optimistic updates on click

### CommentSection.tsx
- Uses `useComments` hook for real-time comment updates
- Supports nested replies
- Real-time comment additions/updates/deletions

### CommentItem.tsx
- Uses `useCommentLikes` for real-time comment likes
- Shows red heart when liked (`fill-[#ff4500] text-[#ff4500]`)
- Supports nested reply rendering
- Edit/delete with real-time updates

### Home.tsx
- Uses `usePosts` for real-time posts feed
- Sort functionality (best, trending, new, top)
- No manual refresh needed

### PostDetailUpdated.tsx
- Uses `useLikes` for post likes
- Uses `CommentSection` for real-time nested comments
- Full real-time experience

## Image Optimization

### OptimizedImage Component
Created a reusable component with:
- `IntersectionObserver` for lazy loading
- Loading skeleton/shimmer
- Error fallback
- Smooth transitions

**Usage:**
```typescript
<OptimizedImage
  src={imageUrl}
  alt="Post image"
  className="max-w-full h-auto"
/>
```

## How It Works

### 1. User Likes a Post
1. User clicks like button
2. UI updates instantly (optimistic)
3. Database insert happens
4. Trigger updates `likes_count`
5. Real-time subscription updates count if changed
6. On error: UI reverts, shows toast

### 2. User Adds a Comment
1. User submits comment
2. Database insert happens
3. Real-time subscription receives INSERT event
4. Fetches comment with profile data
5. Builds comment tree
6. Updates state with new comment
7. If reply: adds to parent's replies array

### 3. User Deletes a Comment
1. User confirms delete
2. Database delete happens
3. Real-time subscription receives DELETE event
4. Removes comment from tree (recursive for replies)
5. Updates parent's replies array

### 4. Real-Time Updates Across Users
1. User A likes post X
2. Database trigger updates `likes_count`
3. User B's subscription receives UPDATE event
4. User B's UI updates automatically
5. No refresh needed

## Error Handling

### Network Errors
- Supabase auto-reconnects
- Failed operations show toast
- Optimistic updates rolled back

### Database Errors
- Validation errors caught
- User-friendly error messages
- State consistency maintained

## Performance Optimizations

1. **Selective Updates**: Only affected posts/comments update
2. **Lazy Loading**: Images load only when visible
3. **Memoization**: `useCallback` for stable references
4. **Real-Time Filters**: Subscription filters by post_id
5. **Efficient Tree Building**: O(n) tree construction

## Testing Checklist

- [x] Like/unlike posts updates instantly
- [x] Like/unlike comments updates instantly
- [x] Add comment appears immediately
- [x] Add reply appears under parent
- [x] Delete comment removes from tree
- [x] Edit comment updates in place
- [x] Counts update across tabs/users
- [x] No page reloads on any action
- [x] Error handling works correctly
- [x] Images load lazily
- [x] Nested replies render correctly

## Future Enhancements

1. Add optimistic comment updates
2. Implement comment pagination
3. Add mention notifications
4. Add real-time typing indicators
5. Implement comment reactions

## Files Modified

### Hooks
- `src/hooks/usePosts.tsx` - Enhanced with real-time
- `src/hooks/useLikes.tsx` - Optimistic updates + real-time
- `src/hooks/useCommentLikes.tsx` - Optimistic updates + real-time
- `src/hooks/useComments.tsx` - Real-time nested comments

### Components
- `src/components/posts/PostCard.tsx` - Real-time likes
- `src/components/posts/CommentSection.tsx` - Uses real-time hook
- `src/components/posts/CommentItem.tsx` - Real-time likes + nested
- `src/pages/Home.tsx` - Uses real-time posts

### New Components
- `src/components/ui/optimized-image.tsx` - Lazy loading images

## Summary

This implementation provides a fully real-time social feed with:
✅ No page reloads
✅ Optimistic UI updates
✅ Real-time subscriptions for all changes
✅ Nested comment support
✅ Proper error handling
✅ Image optimization
✅ Count synchronization across users

All updates happen instantly with Supabase real-time channels, providing a seamless user experience.

