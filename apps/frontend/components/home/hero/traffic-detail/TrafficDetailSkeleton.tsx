import { Skeleton } from '@/components/shionui/Skeleton'

const SummaryCardSkeleton = () => (
  <div className="rounded-xl border bg-card px-4 py-4 space-y-2">
    <Skeleton className="h-3 w-20 rounded" />
    <Skeleton className="h-6 w-24 rounded" />
    <Skeleton className="h-3 w-12 rounded" />
  </div>
)

const BarRowSkeleton = ({ width }: { width: string }) => (
  <div className="flex items-center gap-3">
    <Skeleton className="h-3 w-16 shrink-0 rounded" />
    <Skeleton className={`h-5 rounded ${width}`} />
  </div>
)

export const TrafficDetailSkeleton = () => (
  <div className="space-y-5 p-1">
    <div className="grid grid-cols-3 gap-3">
      <SummaryCardSkeleton />
      <SummaryCardSkeleton />
      <SummaryCardSkeleton />
    </div>

    <div className="space-y-2">
      <Skeleton className="h-4 w-28 rounded" />
      <div className="flex items-end gap-1 h-56 pt-4 pb-8 px-2">
        {[40, 55, 35, 70, 85, 60, 45, 75, 90, 50, 65, 80].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>

    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24 rounded" />
        <div className="space-y-2 pt-1">
          <BarRowSkeleton width="w-full" />
          <BarRowSkeleton width="w-4/5" />
          <BarRowSkeleton width="w-3/5" />
          <BarRowSkeleton width="w-2/5" />
          <BarRowSkeleton width="w-1/4" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24 rounded" />
        <div className="space-y-2 pt-1">
          <BarRowSkeleton width="w-full" />
          <BarRowSkeleton width="w-3/4" />
          <BarRowSkeleton width="w-1/2" />
          <BarRowSkeleton width="w-2/5" />
          <BarRowSkeleton width="w-1/5" />
        </div>
      </div>
    </div>

    <div className="space-y-2">
      <Skeleton className="h-4 w-28 rounded" />
      <div className="space-y-2 pt-1">
        <BarRowSkeleton width="w-full" />
        <BarRowSkeleton width="w-4/5" />
        <BarRowSkeleton width="w-3/5" />
        <BarRowSkeleton width="w-2/5" />
        <BarRowSkeleton width="w-1/4" />
      </div>
    </div>
  </div>
)
