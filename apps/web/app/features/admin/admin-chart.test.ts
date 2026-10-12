import { describe, expect, it } from 'vitest'
import { axisSplits, axisStep, lineOption } from './admin-chart'

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
})

describe('lineOption', () => {
  it('gives each line its own axis with the same number of intervals', () => {
    const option = lineOption({
      labels: ['10月1日', '10月2日'],
      lines: [
        { name: '下载', values: [12, 40] },
        { name: '浏览', values: [800, 947] },
      ],
      palette: { text: '#666', line: '#ddd', surface: '#fff', lines: ['#06c', '#f90'] },
    })
    expect(option.yAxis.map(axis => [axis.max, axis.interval, axis.position])).toEqual([
      [40, 10, 'left'],
      [1000, 250, 'right'],
    ])
    expect(option.series.map(series => series.yAxisIndex)).toEqual([0, 1])
    expect(option.color).toEqual(['#06c', '#f90'])
  })
})
