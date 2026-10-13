export type ChartLine = {
  name: string
  values: number[]
}

export const chartTones = ['accent', 'warning', 'danger', 'success', 'info', 'neutral'] as const

export type ChartTone = (typeof chartTones)[number]

export type ChartBar = ChartLine & { tone: ChartTone }

export type ChartPalette = {
  text: string
  line: string
  surface: string
  tones: Record<ChartTone, string>
}

export const chartTokens = {
  text: '--hn-fg-muted',
  line: '--hn-border',
  surface: '--hn-surface',
  tones: {
    accent: '--hn-accent',
    warning: '--hn-warning',
    danger: '--hn-danger',
    success: '--hn-success',
    info: '--hn-info',
    neutral: '--hn-fg-muted',
  },
} as const

export const axisSplits = 4

export function axisStep(values: readonly number[], unit = 1): number {
  const top = Math.max(axisSplits, ...values.map(value => value / unit))
  const magnitude = 10 ** Math.floor(Math.log10(top / axisSplits))
  const factors = magnitude >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10]
  const factor = factors.find(candidate => candidate * magnitude * axisSplits >= top) ?? 10
  return Number((factor * magnitude * unit).toPrecision(12))
}

function frame(labels: string[], palette: ChartPalette) {
  return {
    animation: false,
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
      axisLine: { lineStyle: { color: palette.line } },
      axisTick: { show: false },
      axisLabel: { color: palette.text, fontSize: 12, hideOverlap: true },
    },
  }
}

export type LineSpec = {
  labels: string[]
  lines: ChartLine[]
  palette: ChartPalette
}

const lineTones = ['accent', 'warning'] as const

export function lineOption({ labels, lines, palette }: LineSpec) {
  const shared = frame(labels, palette)
  return {
    ...shared,
    color: lineTones.map(tone => palette.tones[tone]),
    xAxis: { ...shared.xAxis, boundaryGap: false },
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

export type BarSpec = {
  labels: string[]
  bars: ChartBar[]
  palette: ChartPalette
  unit?: number
  format: (value: number) => string
}

export function stackedTotals(labels: readonly string[], bars: readonly ChartLine[]): number[] {
  return labels.map((_, index) => bars.reduce((sum, bar) => sum + (bar.values[index] ?? 0), 0))
}

export function barOption({ labels, bars, palette, unit = 1, format }: BarSpec) {
  const shared = frame(labels, palette)
  const step = axisStep(stackedTotals(labels, bars), unit)
  return {
    ...shared,
    color: bars.map(bar => palette.tones[bar.tone]),
    tooltip: {
      ...shared.tooltip,
      axisPointer: { type: 'shadow' as const },
      valueFormatter: (value: unknown) => (typeof value === 'number' ? format(value) : ''),
    },
    yAxis: {
      type: 'value' as const,
      min: 0,
      max: Number((step * axisSplits).toPrecision(12)),
      interval: step,
      axisLabel: { color: palette.text, fontSize: 12, formatter: format },
      splitLine: { lineStyle: { color: palette.line } },
    },
    series: bars.map(bar => ({
      type: 'bar' as const,
      name: bar.name,
      data: bar.values,
      stack: 'total',
      barMaxWidth: 20,
      itemStyle: { borderRadius: 2 },
    })),
  }
}

export type ChartOption = ReturnType<typeof lineOption> | ReturnType<typeof barOption>
