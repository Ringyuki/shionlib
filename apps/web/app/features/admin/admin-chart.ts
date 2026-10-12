export type ChartLine = {
  name: string
  values: number[]
}

export type ChartPalette = {
  text: string
  line: string
  surface: string
  lines: string[]
}

export type ChartSpec = {
  labels: string[]
  lines: ChartLine[]
  palette: ChartPalette
}

export const chartTokens = {
  text: '--hn-fg-muted',
  line: '--hn-border',
  surface: '--hn-surface',
  lines: ['--hn-accent', '--hn-warning'],
} as const

export const axisSplits = 4

export function axisStep(values: readonly number[]): number {
  const top = Math.max(axisSplits, ...values)
  const magnitude = 10 ** Math.floor(Math.log10(top / axisSplits))
  const factors = magnitude >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10]
  const factor = factors.find(candidate => candidate * magnitude * axisSplits >= top) ?? 10
  return factor * magnitude
}

export function lineOption({ labels, lines, palette }: ChartSpec) {
  return {
    animation: false,
    color: palette.lines,
    grid: { left: 8, right: 8, top: 12, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: palette.surface,
      borderColor: palette.line,
      textStyle: { color: palette.text, fontSize: 13 },
    },
    xAxis: {
      type: 'category' as const,
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: palette.line } },
      axisTick: { show: false },
      axisLabel: { color: palette.text, fontSize: 12, hideOverlap: true },
    },
    yAxis: lines.map((line, index) => ({
      type: 'value' as const,
      min: 0,
      max: axisStep(line.values) * axisSplits,
      interval: axisStep(line.values),
      position: index === 0 ? ('left' as const) : ('right' as const),
      axisLabel: { color: palette.text, fontSize: 12 },
      splitLine: { show: index === 0, lineStyle: { color: palette.line } },
    })),
    series: lines.map((line, index) => ({
      type: 'line' as const,
      name: line.name,
      data: line.values,
      yAxisIndex: index,
      showSymbol: false,
      lineStyle: { width: 2 },
    })),
  }
}
