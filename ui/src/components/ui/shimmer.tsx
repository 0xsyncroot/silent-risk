/**
 * Shimmer/Skeleton Loading Components
 * Beautiful loading states for better UX
 */

export function ShimmerCard() {
  return (
    <div className="card p-6 animate-pulse">
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
        <div className="flex-1">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-slate-200 rounded w-1/2"></div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 bg-slate-200 rounded"></div>
        <div className="h-3 bg-slate-200 rounded w-5/6"></div>
        <div className="h-3 bg-slate-200 rounded w-4/6"></div>
      </div>
    </div>
  );
}

export function ShimmerStats() {
  return (
    <div className="grid grid-cols-3 gap-6 mb-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="text-center animate-pulse">
          <div className="mb-3 mx-auto">
            <div className="w-20 h-20 bg-slate-200 rounded-full mx-auto"></div>
          </div>
          <div className="h-3 bg-slate-200 rounded w-20 mx-auto mb-1"></div>
          <div className="h-2 bg-slate-200 rounded w-16 mx-auto"></div>
        </div>
      ))}
    </div>
  );
}

export function ShimmerList() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card p-6 animate-pulse">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-slate-200 rounded-xl flex-shrink-0"></div>
            <div className="flex-1">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-3"></div>
              <div className="h-3 bg-slate-200 rounded mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-5/6"></div>
            </div>
            <div className="text-right">
              <div className="h-8 w-16 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ShimmerPassport() {
  return (
    <div className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 rounded-xl p-6 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-slate-900/20 rounded-lg"></div>
          <div>
            <div className="h-3 w-24 bg-slate-900/20 rounded mb-1"></div>
            <div className="h-3 w-32 bg-slate-900/20 rounded"></div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="text-center">
            <div className="w-20 h-20 bg-slate-900/20 rounded-full mx-auto mb-3"></div>
            <div className="h-2 w-16 bg-slate-900/20 rounded mx-auto"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

