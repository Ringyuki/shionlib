import { describe, expect, it } from 'bun:test'
import { fitInside, fitTitle, textWidth } from '../../src/cards/measure'

describe('textWidth', () => {
  it('counts CJK characters as one em and others as about half', () => {
    expect(textWidth('橘光', 10)).toBe(20)
    expect(textWidth('ab', 10)).toBeCloseTo(11)
    expect(textWidth('ライム', 10)).toBe(30)
  })
})

describe('fitTitle', () => {
  it('keeps 60 px over two lines while the title fits', () => {
    expect(fitTitle('橘光柠水随想曲', 662)).toEqual({ fontSize: 60, lines: 2 })
  })

  it('steps down to 48 px over three lines when 60 px would need a third line', () => {
    expect(fitTitle('抬头看看吧，看那天上的繁星 Interstellar Focus', 512)).toEqual({
      fontSize: 48,
      lines: 3,
    })
  })
})

describe('fitInside', () => {
  it('fits a portrait cover to the height of the picture area', () => {
    expect(fitInside([500, 709], { width: 460, height: 502 })).toEqual({ width: 354, height: 502 })
  })

  it('fits a landscape cover to the width of the picture area', () => {
    expect(fitInside([822, 560], { width: 460, height: 502 })).toEqual({ width: 460, height: 313 })
  })

  it('treats a picture without dimensions as 3:4', () => {
    expect(fitInside([], { width: 460, height: 502 })).toEqual({ width: 377, height: 502 })
  })
})
