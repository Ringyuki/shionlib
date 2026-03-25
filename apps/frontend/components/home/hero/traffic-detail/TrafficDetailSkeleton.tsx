import { Skeleton } from '@/components/shionui/Skeleton'

export const TrafficDetailSkeleton = () => (
  <div className="space-y-4 p-1">
    <div className="grid grid-cols-3 gap-3">
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
    </div>
    <Skeleton className="h-52 rounded-lg" />
    <Skeleton className="h-40 rounded-lg" />
  </div>
)
