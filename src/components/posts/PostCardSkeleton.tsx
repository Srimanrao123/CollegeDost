import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PostCardSkeletonProps {
  showImage?: boolean;
  isFirstPost?: boolean;
}

/**
 * Optimized skeleton loader for PostCard
 * 
 * Performance Benefits:
 * - Renders immediately (no data fetching needed)
 * - Prevents layout shift (CLS)
 * - Improves perceived performance (FCP)
 * - Shows layout structure before content loads
 */
export function PostCardSkeleton({ showImage = true, isFirstPost = false }: PostCardSkeletonProps) {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-6 w-3/4 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6 mb-3" />
        {showImage && (
          <Skeleton 
            className="w-full rounded-lg mb-4" 
            style={{ 
              // PERFORMANCE: Fixed aspect ratio matching PostCard to prevent CLS
              aspectRatio: '16 / 9',
              width: '100%',
              maxHeight: isFirstPost ? '450px' : '400px',
            }} 
          />
        )}
        <div className="flex items-center gap-4 pt-4 border-t">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </Card>
  );
}

