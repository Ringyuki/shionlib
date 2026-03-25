'use client'

import { ArrowUp, ArrowDown } from 'lucide-react'
import { Card, CardContent } from '@/components/shionui/Card'
import { formatBytes, formatNumber } from '@/utils/format'
import type { TrafficDetailData } from '@/interfaces/analysis/data.interface'

const PercentBadge = ({ current, previous }: { current: number; previous: number }) => {
  if (previous === 0 && current === 0) return null
  const pct = previous === 0 ? 100 : ((current - previous) / previous) * 100
  const isUp = pct >= 0

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-success' : 'text-destructive'}`}
    >
      {isUp ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

interface SummaryCardsProps {
  data: TrafficDetailData
  labels: {
    totalDownloads: string
    totalTraffic: string
    averageSize: string
  }
}

export const SummaryCards = ({ data, labels }: SummaryCardsProps) => (
  <div className="grid grid-cols-3 gap-3">
    <Card className="gap-2 py-4">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{labels.totalDownloads}</p>
        <p className="text-xl font-bold">{formatNumber(data.totalDownloads)}</p>
        <PercentBadge current={data.totalDownloads} previous={data.prevTotalDownloads} />
      </CardContent>
    </Card>
    <Card className="gap-2 py-4">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{labels.totalTraffic}</p>
        <p className="text-xl font-bold">{formatBytes(data.totalBytes)}</p>
        <PercentBadge current={data.totalBytes} previous={data.prevTotalBytes} />
      </CardContent>
    </Card>
    <Card className="gap-2 py-4">
      <CardContent className="px-4">
        <p className="text-xs text-muted-foreground">{labels.averageSize}</p>
        <p className="text-xl font-bold">{formatBytes(data.averageSize)}</p>
        <PercentBadge current={data.averageSize} previous={data.prevAverageSize} />
      </CardContent>
    </Card>
  </div>
)
