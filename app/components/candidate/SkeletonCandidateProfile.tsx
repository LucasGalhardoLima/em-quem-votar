import { Skeleton } from "~/components/ui/skeleton";

export function SkeletonCandidateProfile() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <Skeleton className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-12 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
        </div>
      </div>

      {/* Biography */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Positions */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-28" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-4 w-40" />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="w-2.5 h-2.5 rounded-full" />
              ))}
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
