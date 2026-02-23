import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export function SkeletonCandidateCard() {
  return (
    <Card className="h-full">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="w-16 h-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-40 mt-2" />
            <div className="flex gap-1 mt-3">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonCandidateGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCandidateCard key={i} />
      ))}
    </div>
  );
}
