'use client'

import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import { ResponsiveLine } from '@nivo/line'
import { formatBytes } from '@/utils/format'
import { useNivoTheme } from './useNivoTheme'
import type { HourlyTrafficPoint } from '@/interfaces/analysis/data.interface'

interface HourlyTrendChartProps {
  data: HourlyTrafficPoint[]
  trafficLabel: string
}

const formatHourTick = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const formatHourTooltip = (value: string) =>
  new Date(value).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export const HourlyTrendChart = ({ data, trafficLabel }: HourlyTrendChartProps) => {
  const nivoTheme = useNivoTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const lineData = useMemo(
    () => [
      {
        id: trafficLabel,
        data: data.map(h => ({
          x: h.hour,
          y: h.totalBytes,
        })),
      },
    ],
    [data, trafficLabel],
  )

  return (
    <div className="h-56">
      <ResponsiveLine
        data={lineData}
        theme={nivoTheme}
        margin={{ top: 8, right: 0, bottom: 32, left: 55 }}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 0, stacked: false }}
        curve="linear"
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          tickRotation: -45,
          format: value => formatHourTick(String(value)),
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          format: (v: number) => formatBytes(v),
        }}
        colors={[isDark ? '#4cb8ea' : '#34a2d5']}
        enablePoints={false}
        enableArea
        areaOpacity={isDark ? 0.15 : 0.12}
        useMesh
        enableSlices="x"
        sliceTooltip={({ slice }) => (
          <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md min-w-40 w-fit">
            <p className="font-medium">
              {slice.points[0]?.data.x ? formatHourTooltip(String(slice.points[0].data.x)) : ''}
            </p>
            {slice.points.map(p => (
              <p key={p.id} className="text-muted-foreground">
                {p.seriesId}: {formatBytes(Number(p.data.y))}
              </p>
            ))}
          </div>
        )}
        enableGridX={false}
        enableCrosshair={false}
      />
    </div>
  )
}
