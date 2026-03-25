'use client'

import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import { ResponsiveBar } from '@nivo/bar'
import { formatBytes } from '@/utils/format'
import { useNivoTheme } from './useNivoTheme'
import type { GameTraffic } from '@/interfaces/analysis/data.interface'
import { useLocale } from 'next-intl'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'

interface TopGamesChartProps {
  data: GameTraffic[]
  trafficLabel: string
}

export const TopGamesChart = ({ data, trafficLabel }: TopGamesChartProps) => {
  const nivoTheme = useNivoTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const locale = useLocale()

  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'

  const barData = useMemo(
    () =>
      [...data].reverse().map(g => {
        const { title } = getPreferredContent(
          {
            title_jp: g.gameName.title_jp ?? '',
            title_zh: g.gameName.title_zh ?? '',
            title_en: g.gameName.title_en ?? '',
          },
          'title',
          lang,
        )
        return {
          game: title,
          [trafficLabel]: g.totalBytes,
        }
      }),
    [data, trafficLabel, lang],
  )

  return (
    <div style={{ height: Math.max(barData.length * 32 + 40, 120) }}>
      <ResponsiveBar
        data={barData}
        theme={nivoTheme}
        keys={[trafficLabel]}
        indexBy="game"
        layout="horizontal"
        margin={{ top: 0, right: 0, bottom: 0, left: 120 }}
        padding={0.3}
        colors={[isDark ? '#a78bfa' : '#8b5cf6']}
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
            <p className="font-medium">{d.game}</p>
            <p className="text-muted-foreground">{formatBytes(value)}</p>
          </div>
        )}
        valueFormat={v => formatBytes(v)}
      />
    </div>
  )
}
