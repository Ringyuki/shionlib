import { describe, expect, it } from 'vitest'
import { axisSplits, axisStep, barOption, lineOption, type ChartPalette } from './admin-chart'

const palette: ChartPalette = {
  text: '#666',
  line: '#ddd',
  surface: '#fff',
  tones: {
    accent: '#06c',
    warning: '#f90',
    danger: '#d00',
    success: '#080',
    info: '#09c',
    neutral: '#999',
  },
}

describe('axisStep', () => {
  it('never drops below whole numbers', () => {
    expect(axisStep([])).toBe(1)
    expect(axisStep([0, 0, 0])).toBe(1)
    expect(axisStep([3])).toBe(1)
    expect(axisStep([10])).toBe(5)
  })

  it('picks a round step whose four intervals cover the largest value', () => {
    expect(axisStep([947])).toBe(250)
    expect(axisStep([6242])).toBe(2000)
    expect(axisStep([100])).toBe(25)
    for (const top of [1, 7, 39, 120, 999, 4001, 87_654]) {
      expect(axisStep([top]) * axisSplits).toBeGreaterThanOrEqual(top)
    }
  })

  it('counts in the given unit when the values are fractions', () => {
    expect(axisStep([], 0.0001)).toBe(0.0001)
    expect(axisStep([0.0137], 0.0001)).toBe(0.005)
    expect(axisStep([1.37], 0.0001)).toBe(0.5)
  })
})

describe('lineOption', () => {
  it('gives each line its own axis with the same number of intervals', () => {
    const option = lineOption({
      labels: ['10月1日', '10月2日'],
      lines: [
        { name: '下载', values: [12, 40] },
        { name: '浏览', values: [800, 947] },
      ],
      palette,
    })
    expect(option.yAxis.map(axis => [axis.max, axis.interval, axis.position])).toEqual([
      [40, 10, 'left'],
      [1000, 250, 'right'],
    ])
    expect(option.series.map(series => series.yAxisIndex)).toEqual([0, 1])
    expect(option.color).toEqual(['#06c', '#f90'])
  })
})

describe('barOption', () => {
  it('stacks the bars on one axis sized for the tallest column', () => {
    const option = barOption({
      labels: ['13:00', '14:00'],
      bars: [
        { name: '成功', tone: 'accent', values: [61, 64] },
        { name: '失败', tone: 'danger', values: [2, 5] },
      ],
      palette,
      format: value => `${value} 次`,
    })
    expect([option.yAxis.max, option.yAxis.interval]).toEqual([80, 20])
    expect(option.color).toEqual(['#06c', '#d00'])
    expect(option.series.map(series => series.stack)).toEqual(['total', 'total'])
    expect(option.yAxis.axisLabel.formatter(20)).toBe('20 次')
    expect(option.tooltip.valueFormatter(5)).toBe('5 次')
  })
})
