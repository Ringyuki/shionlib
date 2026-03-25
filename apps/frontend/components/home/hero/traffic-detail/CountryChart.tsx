'use client'

import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import { ResponsiveBar } from '@nivo/bar'
import { formatBytes } from '@/utils/format'
import { useNivoTheme } from './useNivoTheme'
import type { CountryTraffic } from '@/interfaces/analysis/data.interface'
import { CN, US, JP, TW, HK, SG, MY, CA, GB } from 'country-flag-icons/react/3x2'

interface FlagMapProps {
  country: string
}
const FlagMap = ({ country }: FlagMapProps) => {
  switch (country) {
    case 'CN':
      return <CN className="w-4 h-4" />
    case 'US':
      return <US className="w-4 h-4" />
    case 'JP':
      return <JP className="w-4 h-4" />
    case 'TW':
      return <TW className="w-4 h-4" />
    case 'HK':
      return <HK className="w-4 h-4" />
    case 'SG':
      return <SG className="w-4 h-4" />
    case 'MY':
      return <MY className="w-4 h-4" />
    case 'CA':
      return <CA className="w-4 h-4" />
    case 'GB':
      return <GB className="w-4 h-4" />
    default:
      return null
  }
}

interface CountryChartProps {
  data: CountryTraffic[]
  trafficLabel: string
}

export const CountryChart = ({ data, trafficLabel }: CountryChartProps) => {
  const nivoTheme = useNivoTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const barData = useMemo(
    () =>
      [...data].reverse().map(c => ({
        country: c.country,
        [trafficLabel]: c.totalBytes,
      })),
    [data, trafficLabel],
  )

  return (
    <div style={{ height: Math.max(barData.length * 28 + 40, 120) }}>
      <ResponsiveBar
        data={barData}
        theme={nivoTheme}
        keys={[trafficLabel]}
        indexBy="country"
        layout="horizontal"
        margin={{ top: 0, right: 0, bottom: 0, left: 24 }}
        padding={0.3}
        colors={[isDark ? '#34d399' : '#10b981']}
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
            <div className="flex items-center gap-2">
              <FlagMap country={d.country} />
              <p className="font-medium">{d.country}</p>
            </div>
            <p className="text-muted-foreground">{formatBytes(value)}</p>
          </div>
        )}
        valueFormat={v => formatBytes(v)}
      />
    </div>
  )
}
