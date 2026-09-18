// Loading placeholders shaped like the real page, so a tap answers back
// before the data does. Brand v4: a pulse between two surface steps, no
// shimmer. Server-safe.

const pulse = "animate-pulse rounded-control bg-surface-3";

export function SkeletonLine({ w = "w-40", h = "h-4" }: { w?: string; h?: string }) {
  return <div className={`${pulse} ${w} ${h}`} aria-hidden="true" />;
}

/** Page header: eyebrow + title, optional right-hand line. */
export function SkeletonHeader({ withSide = true }: { withSide?: boolean }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4" aria-hidden="true">
      <div className="space-y-2">
        <SkeletonLine w="w-24" h="h-3" />
        <SkeletonLine w="w-56" h="h-8" />
      </div>
      {withSide && <SkeletonLine w="w-32" h="h-4" />}
    </div>
  );
}

/** A card with a title line and a few body lines. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-card border border-line bg-surface-2 p-5 shadow-e1" aria-hidden="true">
      <SkeletonLine w="w-40" h="h-5" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <SkeletonLine w={i % 2 ? "w-36" : "w-28"} />
            <SkeletonLine w="w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A bordered list of rows, like the pull log or the Stockroom. */
export function SkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface-2 shadow-e1" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}
        >
          <div className="space-y-2">
            <SkeletonLine w={i % 3 === 0 ? "w-44" : "w-32"} />
            <SkeletonLine w="w-24" h="h-3" />
          </div>
          <SkeletonLine w="w-16" h="h-6" />
        </div>
      ))}
    </div>
  );
}

/** A grid of unit-style cards. */
export function SkeletonCards({ count = 6, cols = "sm:grid-cols-2 lg:grid-cols-3" }: { count?: number; cols?: string }) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${cols}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}

/** Screen-reader announcement to pair with any skeleton. */
export function LoadingLabel({ what = "this page" }: { what?: string }) {
  return (
    <p className="sr-only" role="status">
      Loading {what}…
    </p>
  );
}
