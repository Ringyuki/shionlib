'use client'

import { StatsTrend } from '@/interfaces/admin/stats.interface'
import { AreaChart } from '@/components/shionui/charts/AreaChart'
import { Skeleton } from '@/components/shionui/Skeleton'
import { cn } from '@/utils/cn'
import { useTranslations } from 'next-intl'

interface TrendChartProps {
  data?: StatsTrend[]
  isLoading?: boolean
  className?: string
}

export function TrendChart({ data, isLoading, className }: TrendChartProps) {
  const t = useTranslations('Admin.Dashboard')

  if (isLoading) {
    return <Skeleton className={cn('h-[350px] rounded-xl', className)} />
  }

  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          'flex h-[350px] items-center justify-center rounded-xl border',
          'bg-white/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800',
          className,
        )}
      >
        <p className="text-gray-500 dark:text-gray-400">{t('noTrendData')}</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border p-6',
        'bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm',
        'border-gray-200 dark:border-gray-800',
        className,
      )}
    >
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {t('activityTrends')}
      </h3>
      <AreaChart
        data={data}
        index="date"
        categories={['games', 'users']}
        colors={['blue', 'emerald']}
        valueFormatter={(value: number) => value.toLocaleString()}
        showLegend={true}
        showGridLines={true}
        className="h-[280px]"
      />
    </div>
  )
}
