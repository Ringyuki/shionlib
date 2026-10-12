import { useEffect, useEffectEvent, useRef } from 'react'
import { chartTokens, lineOption, type ChartLine } from './admin-chart'

type Chart = {
  setOption: (option: ReturnType<typeof lineOption>, replace: boolean) => void
  resize: () => void
  dispose: () => void
}

async function loadEngine(): Promise<(host: HTMLElement) => Chart> {
  const [core, charts, components, renderers] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
  ])
  core.use([
    charts.LineChart,
    components.GridComponent,
    components.TooltipComponent,
    renderers.CanvasRenderer,
  ])
  return host => core.init(host)
}

function paletteOf(host: HTMLElement) {
  const style = getComputedStyle(host)
  const read = (token: string) => style.getPropertyValue(token).trim()
  return {
    text: read(chartTokens.text),
    line: read(chartTokens.line),
    surface: read(chartTokens.surface),
    lines: chartTokens.lines.map(read),
  }
}

export function useLineChart(labels: string[], lines: ChartLine[]) {
  const host = useRef<HTMLDivElement>(null)
  const chart = useRef<Chart | undefined>(undefined)
  const draw = useEffectEvent(() => {
    if (host.current !== null) {
      chart.current?.setOption(
        lineOption({ labels, lines, palette: paletteOf(host.current) }),
        true,
      )
    }
  })

  useEffect(() => {
    const element = host.current
    if (element === null) {
      return
    }
    let gone = false
    void loadEngine().then(init => {
      if (!gone) {
        chart.current = init(element)
        draw()
      }
    })
    const resized = new ResizeObserver(() => chart.current?.resize())
    resized.observe(element)
    const themed = new MutationObserver(() => draw())
    themed.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => {
      gone = true
      resized.disconnect()
      themed.disconnect()
      chart.current?.dispose()
      chart.current = undefined
    }
  }, [])

  useEffect(() => {
    draw()
  })

  return host
}
