# Cursor-Based Pagination Implementation

## Overview

This application implements **cursor-based pagination** using Supabase and React Query (TanStack Query) for optimal performance and user experience.

## Architecture

### Frontend Implementation

#### 1. **usePosts Hook** (`src/hooks/usePosts.tsx`)

The core pagination logic uses React Query's `useInfiniteQuery`:

```typescript
const query = useInfiniteQuery({
  queryKey: ['posts', tagFilter, limit],
  queryFn: ({ pageParam }) => fetchPosts({ pageParam, tagFilter, limit }),
  initialPageParam: undefined,
  getNextPageParam: (lastPage) => {
    if (!lastPage || lastPage.length < POSTS_PER_PAGE) {
      return undefined; // No more pages
    }
    // Cursor is the created_at timestamp of the last post
    return lastPage[lastPage.length - 1].created_at;
  },
});
```

**Key Features:**
- ✅ **Stable Ordering**: Posts ordered by `created_at DESC`
- ✅ **Opaque Cursor**: Uses ISO timestamp as cursor (e.g., `"2024-01-15T10:30:00Z"`)
- ✅ **Efficient Queries**: Fetches only the requested page size (10 posts default)
- ✅ **Real-time Updates**: Automatic cache invalidation on new posts

#### 2. **Pagination Query Logic**

```typescript
const fetchPosts = async ({ pageParam, tagFilter, limit }) => {
  let query = supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(effectiveLimit);
  
  // Cursor pagination: fetch posts created before the pageParam timestamp
  if (pageParam) {
    query = query.lt('created_at', pageParam);
  }

  const { data, error } = await query;
  // ... fetch related data (profiles, tags, views)
  return postsWithData;
};
```

**How It Works:**
1. **First Page**: No cursor → fetch the latest 10 posts
2. **Next Pages**: Cursor provided → fetch 10 posts with `created_at < cursor`
3. **Last Page**: If fetched posts < page size, no more pages exist

#### 3. **Response Format**

The hook transforms data to match the expected format:

```typescript
// Internal format
{
  pages: [
    [post1, post2, ...], // Page 1
    [post11, post12, ...], // Page 2
  ],
  pageParams: [undefined, "2024-01-15T10:30:00Z", ...]
}

// Exposed to components
{
  posts: [post1, post2, post11, post12, ...], // Flattened
  loading: boolean,
  fetchNextPage: () => void,
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
}
```

### Component Integration

#### Home.tsx & All.tsx

```typescript
const { 
  posts, 
  loading, 
  fetchNextPage, 
  hasNextPage, 
  isFetchingNextPage 
} = usePosts(tagFilter, postLimit);

// ... render posts ...

{hasNextPage && (
  <Button 
    onClick={() => fetchNextPage()} 
    disabled={isFetchingNextPage}
  >
    {isFetchingNextPage ? 'Loading...' : 'Load More'}
  </Button>
)}
```

## Database Schema Requirements

### Required Fields

```sql
-- Posts table must have:
CREATE TABLE posts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title TEXT,
  content TEXT,
  -- ... other fields
);

-- Critical index for performance
CREATE INDEX idx_posts_created_at_desc ON posts(created_at DESC);
```

### Performance Considerations

1. **Index on `created_at`**: Essential for fast cursor queries
2. **Page Size**: 10 posts per page (configurable via `POSTS_PER_PAGE`)
3. **Limit Clamping**: Non-authenticated users limited to 10 total posts
4. **Parallel Fetching**: Profiles, tags, and views fetched in parallel

## Cursor Format

### Supabase Implementation

- **Format**: ISO 8601 timestamp string
- **Example**: `"2024-01-15T10:30:00.123Z"`
- **Encoding**: Not encoded (transparent for debugging)
- **Stability**: Guaranteed by `ORDER BY created_at DESC`

### Advantages Over Offset Pagination

| Feature | Offset Pagination | Cursor Pagination |
|---------|-------------------|-------------------|
| Performance | O(n) - slow for large offsets | O(1) - constant time |
| Stability | ❌ Items can shift | ✅ Always stable |
| Duplicates | ❌ Possible on new inserts | ✅ Never |
| Missing Items | ❌ Possible on deletions | ✅ Never |
| Database Load | ❌ High for large datasets | ✅ Low, uses index |

## Real-Time Updates

The hook includes Supabase real-time subscriptions:

```typescript
useEffect(() => {
  const rt = createRealtimeChannel("realtime:posts_bundle");

  // Invalidate cache on any post changes
  rt.onPostgresChange({ table: "posts", event: "*" }, () => {
    queryClient.invalidateQueries({ queryKey });
  });

  // Optimistic update for view counts
  rt.onPostgresChange({ table: "post_views", event: "INSERT" }, (payload) => {
    // Update cache immediately
    queryClient.setQueryData(queryKey, (oldData) => {
      // Increment view count for the post
    });
  });

  rt.subscribe();
  return () => rt.unsubscribe();
}, [queryKey]);
```

## Cache Management

### React Query Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
    },
  },
});
```

### Cache Keys

```typescript
// Posts cache key structure
['posts', tagFilter, limit]

// Examples:
['posts', 'all', 'unlimited']
['posts', 'jee,neet', 'any', 'unlimited']
['posts', 'all', '10'] // Non-authenticated users
```

## API Reference

### usePosts Hook

```typescript
function usePosts(
  tagFilter?: { tags: string[]; mode: 'any' | 'all' },
  limit?: number
): {
  posts: Post[];
  loading: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  refetch: () => void;
}
```

**Parameters:**
- `tagFilter` (optional): Filter posts by tags
  - `tags`: Array of tag names
  - `mode`: 'any' (OR) or 'all' (AND)
- `limit` (optional): Maximum total posts (for non-authenticated users)

**Returns:**
- `posts`: Flattened array of all loaded posts
- `loading`: True during initial load
- `fetchNextPage`: Function to load next page
- `hasNextPage`: True if more pages available
- `isFetchingNextPage`: True while loading next page
- `refetch`: Function to manually refresh data

### Post Type

```typescript
interface Post {
  id: string;
  user_id: string;
  title?: string;
  content?: string;
  image_url?: string;
  category?: string;
  exam_type?: string;
  created_at: string; // ISO 8601
  likes_count: number;
  comments_count: number;
  views_count: number;
  tags: string[];
  profiles: {
    id: string;
    username: string;
    avatar_url?: string;
  } | null;
}
```

## Error Handling

```typescript
useEffect(() => {
  if (query.error) {
    toast({
      title: "Error",
      description: query.error.message || "Failed to fetch posts",
      variant: "destructive",
    });
  }
}, [query.error]);
```

## Testing Cursor Pagination

### Test Cases

1. **First Page Load**
   ```
   Query: No cursor
   Expected: Latest 10 posts
   Verify: created_at in descending order
   ```

2. **Load More**
   ```
   Query: cursor = "2024-01-15T10:30:00Z"
   Expected: Next 10 posts with created_at < cursor
   Verify: No gaps, no duplicates
   ```

3. **Last Page**
   ```
   Query: cursor = oldest post's created_at
   Expected: Remaining posts (< 10)
   Verify: hasNextPage = false
   ```

4. **Concurrent Inserts**
   ```
   Action: New post created while paginating
   Expected: Real-time update invalidates cache
   Verify: User sees new post on refresh
   ```

## Performance Metrics

### Target Benchmarks

- **Initial Load**: < 500ms
- **Load More**: < 300ms
- **Cache Hit**: < 50ms
- **Real-time Update**: < 100ms

### Optimization Tips

1. **Database**: Ensure index on `created_at DESC`
2. **Network**: Use HTTP/2 or HTTP/3 for parallel requests
3. **Cache**: Increase `staleTime` for less critical data
4. **Parallel**: Fetch profiles, tags, views simultaneously

## Migration Notes

### From Offset to Cursor

If migrating from offset pagination:

```typescript
// Old (Offset)
const { data } = await supabase
  .from('posts')
  .select('*')
  .range(offset, offset + limit - 1)
  .order('created_at', { ascending: false });

// New (Cursor)
let query = supabase
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(limit);

if (cursor) {
  query = query.lt('created_at', cursor);
}

const { data } = await query;
```

## Troubleshooting

### Common Issues

1. **Duplicate Posts**
   - Cause: Missing or incorrect cursor
   - Fix: Verify cursor extraction from last post

2. **Slow Queries**
   - Cause: Missing index on created_at
   - Fix: `CREATE INDEX idx_posts_created_at_desc ON posts(created_at DESC);`

3. **Missing Posts**
   - Cause: Posts with same created_at timestamp
   - Fix: Add `id` as tiebreaker in ORDER BY (future enhancement)

4. **Infinite Loading**
   - Cause: hasNextPage logic incorrect
   - Fix: Check `lastPage.length < POSTS_PER_PAGE` condition

## Future Enhancements

- [ ] Add `id` as tiebreaker for posts with identical timestamps
- [ ] Implement bi-directional pagination (previous page)
- [ ] Add cursor encryption for security
- [ ] Support multiple sort orders (popularity, comments)
- [ ] Prefetch next page on scroll proximity

---

**Last Updated**: November 2024  
**Version**: 1.0.0  
**Maintainer**: Development Team

