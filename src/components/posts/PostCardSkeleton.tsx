import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function PostCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-6 w-3/4 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6 mb-4" />
        <Skeleton className="h-48 w-full rounded-lg mb-4" />
        <div className="flex items-center gap-4 pt-4 border-t">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>
    </Card>
  );
}

