export function PoliticianCardSkeleton() {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 animate-pulse">
      <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="flex gap-1 mt-1">
          <div className="h-4 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </div>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center md:items-start gap-8 animate-pulse">
      <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gray-200 flex-shrink-0" />
      
      <div className="flex-1 text-center md:text-left space-y-4 w-full">
        <div className="space-y-3">
          <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto md:mx-0" />
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <div className="h-6 bg-gray-200 rounded-full w-20" />
            <div className="h-6 bg-gray-200 rounded-full w-16" />
          </div>
        </div>

        <div className="pt-2 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-32 mx-auto md:mx-0" />
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            <div className="h-7 bg-gray-200 rounded-lg w-24" />
            <div className="h-7 bg-gray-200 rounded-lg w-32" />
            <div className="h-7 bg-gray-200 rounded-lg w-28" />
          </div>
        </div>
      </div>
    </section>
  );
}

export function VoteHistorySkeleton() {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 items-start md:items-center animate-pulse">
      <div className="flex-1 space-y-3 w-full">
        <div className="h-3 bg-gray-200 rounded w-24" />
        <div className="h-5 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
      </div>
      
      <div className="flex-shrink-0">
        <div className="h-10 w-20 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}

export function VoteDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white border-b border-gray-100 h-16 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-full flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-200 rounded w-1/3" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Description Card Skeleton */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        </div>

        {/* Scoreboard Skeleton */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-100 rounded-2xl p-6 h-32" />
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 h-32" />
        </div>

        {/* Search Skeleton */}
        <div className="h-12 bg-white rounded-xl border border-gray-200" />

        {/* Lists Skeleton */}
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-40" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white p-3 rounded-lg border border-gray-100 h-16" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-8 bg-gray-200 rounded w-40" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white p-3 rounded-lg border border-gray-100 h-16" />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
