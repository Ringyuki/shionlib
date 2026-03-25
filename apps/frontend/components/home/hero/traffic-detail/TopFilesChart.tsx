'use client'

import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import { ResponsiveBar } from '@nivo/bar'
import { formatBytes } from '@/utils/format'
import { useNivoTheme } from './useNivoTheme'
import type { TopFileTraffic } from '@/interfaces/analysis/data.interface'

interface TopFilesChartProps {
  data: TopFileTraffic[]
  trafficLabel: string
}

export const TopFilesChart = ({ data, trafficLabel }: TopFilesChartProps) => {
  const nivoTheme = useNivoTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const barData = useMemo(
    () =>
      [...data].reverse().map(f => ({
        file: f.fileName || f.fileId,
        [trafficLabel]: f.totalBytes,
      })),
    [data, trafficLabel],
  )

  return (
    <div style={{ height: Math.max(barData.length * 32 + 40, 120) }}>
      <ResponsiveBar
        data={barData}
        theme={nivoTheme}
        keys={[trafficLabel]}
        indexBy="file"
        layout="horizontal"
        margin={{ top: 0, left: 120, bottom: 0, right: 0 }}
        padding={0.3}
        colors={[isDark ? '#4cb8ea' : '#34a2d5']}
        borderRadius={3}
        axisRight={null}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
        }}
        axisBottom={null}
        enableGridY={false}
        enableLabel={false}
        tooltip={({ data: d, value }) => (
          <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md min-w-40 w-fit">
            <p className="font-medium">{d.file}</p>
            <p className="text-muted-foreground">{formatBytes(value)}</p>
          </div>
        )}
        valueFormat={v => formatBytes(v)}
      />
    </div>
  )
}
