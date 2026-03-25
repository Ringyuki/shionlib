'use client'

import { useMemo } from 'react'
import { StatsTrend } from '@/interfaces/admin/stats.interface'
import { ResponsiveLine } from '@nivo/line'
import { Skeleton } from '@/components/shionui/Skeleton'
import { cn } from '@/utils/cn'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import type { PartialTheme } from '@nivo/theming'

interface TrendChartProps {
  data?: StatsTrend[]
  isLoading?: boolean
  className?: string
}

const useNivoTheme = (): PartialTheme => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return useMemo(
    () => ({
      text: { fill: isDark ? '#d1d5db' : '#374151' },
      axis: {
        ticks: {
          text: { fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 11 },
          line: { stroke: isDark ? '#374151' : '#e5e7eb' },
        },
        legend: { text: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 12 } },
      },
      grid: { line: { stroke: isDark ? '#1f2937' : '#f3f4f6' } },
      tooltip: {
        container: {
          background: isDark ? '#1f2937' : '#ffffff',
          color: isDark ? '#f3f4f6' : '#111827',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          fontSize: 12,
        },
      },
    }),
    [isDark],
  )
}

export const TrendChart = ({ data, isLoading, className }: TrendChartProps) => {
  const t = useTranslations('Admin.Dashboard')
  const nivoTheme = useNivoTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const lineData = useMemo(() => {
    if (!data?.length) return []
    return [
      {
        id: 'games',
        data: data.map(d => ({ x: d.date, y: d.games })),
      },
      {
        id: 'users',
        data: data.map(d => ({ x: d.date, y: d.users })),
      },
    ]
  }, [data])

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
      <div className="h-[280px]">
        <ResponsiveLine
          data={lineData}
          theme={nivoTheme}
          margin={{ top: 8, right: 16, bottom: 40, left: 40 }}
          xScale={{ type: 'point' }}
          yScale={{ type: 'linear', min: 0, stacked: false }}
          curve="monotoneX"
          axisBottom={{
            tickSize: 0,
            tickPadding: 8,
            tickRotation: -45,
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            format: (v: number) => v.toLocaleString(),
          }}
          colors={isDark ? ['#4cb8ea', '#34d399'] : ['#34a2d5', '#10b981']}
          lineWidth={2}
          enablePoints={false}
          enableArea
          areaOpacity={isDark ? 0.12 : 0.08}
          useMesh
          enableSlices="x"
          legends={[
            {
              anchor: 'top-right',
              direction: 'row',
              translateY: -4,
              itemWidth: 80,
              itemHeight: 20,
              symbolSize: 10,
              symbolShape: 'circle',
              itemTextColor: isDark ? '#d1d5db' : '#374151',
            },
          ]}
          enableGridX={false}
        />
      </div>
    </div>
  )
}
