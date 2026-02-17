import { Skeleton } from '@/components/shionui/Skeleton'

export const DetailSkeleton = () => {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      <Skeleton className="h-6 w-3/4" />

      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-10 w-32" />
    </div>
  )
}
