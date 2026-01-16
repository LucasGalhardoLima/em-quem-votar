import { Skeleton } from "~/components/ui/skeleton";

export function PoliticianCardSkeleton() {
  return (
    <div className="bg-card p-4 rounded-xl border items-start flex gap-4 min-h-[160px]">
      <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-3 min-w-0">
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="pt-2 flex justify-end">
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

export function FeaturedVoteSkeleton() {
  return (
    <div className="bg-muted/10 rounded-2xl p-8 border flex flex-col h-full min-h-[260px]">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-6 w-24 rounded-lg" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="space-y-3 flex-grow">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full mt-4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <Skeleton className="mt-6 h-5 w-20" />
    </div>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <section className="bg-card rounded-3xl p-8 shadow-sm border flex flex-col md:flex-row items-center md:items-start gap-8">
      <Skeleton className="w-32 h-32 md:w-40 md:h-40 rounded-full flex-shrink-0" />

      <div className="flex-1 text-center md:text-left space-y-4 w-full">
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4 mx-auto md:mx-0" />
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <Skeleton className="h-3 w-32 mx-auto md:mx-0" />
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            <Skeleton className="h-7 w-24 rounded-lg" />
            <Skeleton className="h-7 w-32 rounded-lg" />
            <Skeleton className="h-7 w-28 rounded-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function VoteHistorySkeleton() {
  return (
    <div className="bg-card p-6 rounded-2xl shadow-sm border flex flex-col md:flex-row gap-6 items-start md:items-center min-h-[140px]">
      <div className="flex-1 space-y-3 w-full">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      <div className="flex-shrink-0">
        <Skeleton className="h-10 w-20 rounded-xl" />
      </div>
    </div>
  );
}

export function VoteDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-muted/10 pb-20">
      {/* Header Skeleton */}
      <div className="bg-background border-b h-16 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-full flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Description Card Skeleton */}
        <div className="bg-card rounded-2xl p-6 shadow-sm border space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>

        {/* Scoreboard Skeleton */}
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="rounded-2xl h-32" />
          <Skeleton className="rounded-2xl h-32" />
        </div>

        {/* Search Skeleton */}
        <Skeleton className="h-12 w-full rounded-xl" />

        {/* Lists Skeleton */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-40" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-8 w-40" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
