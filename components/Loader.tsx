export function MediaCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[120px] sm:w-[140px] md:w-[160px] animate-pulse">
      <div className="w-full aspect-[2/3] rounded-md bg-[#1c1c1c]" />
      <div className="h-3 w-3/4 mt-2 rounded bg-[#1c1c1c]" />
      <div className="h-3 w-1/4 mt-1 rounded bg-[#1c1c1c]" />
    </div>
  )
}

export function MediaRowSkeleton() {
  return (
    <div className="px-4 animate-pulse">
      <div className="h-4 w-32 mb-3 bg-[#1c1c1c] rounded" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <MediaCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
