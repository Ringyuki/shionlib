import { describe, expect, it } from 'vitest'
import {
  initialPercent,
  resizedPercent,
  shownWidth,
  snappedPercent,
  widestPercent,
} from './picture-size'

describe('the width a picture starts with', () => {
  it('fills the column when the picture is at least as wide', () => {
    expect(initialPercent(1600, 768)).toBe(100)
    expect(initialPercent(768, 768)).toBe(100)
  })

  it('takes the first snap point that holds a narrower picture', () => {
    expect(initialPercent(250, 768)).toBe(33)
    expect(initialPercent(380, 768)).toBe(50)
    expect(initialPercent(700, 768)).toBe(100)
  })

  it('fills the column while nothing is measured yet', () => {
    expect(initialPercent(0, 768)).toBe(100)
    expect(initialPercent(500, 0)).toBe(100)
  })
})

describe('resizing', () => {
  it('never grows a picture beyond its own width', () => {
    expect(widestPercent(384, 768)).toBe(50)
    expect(resizedPercent(40, 400, 768, widestPercent(384, 768))).toBe(50)
  })

  it('never shrinks below the least width', () => {
    expect(resizedPercent(40, -400, 768, 100)).toBe(20)
  })

  it('counts a drag twice, since the picture stays centred', () => {
    expect(resizedPercent(50, 40, 800, 100)).toBe(60)
  })

  it('snaps near a snap point and only to points the picture can reach', () => {
    expect(snappedPercent(51.5, 100)).toBe(50)
    expect(snappedPercent(58, 100)).toBe(58)
    expect(snappedPercent(74, 70)).toBe(70)
  })
})

describe('the width that is shown', () => {
  it('is the share of the column, capped by the picture itself', () => {
    expect(shownWidth(50, 1600)).toBe('min(50%, 1600px)')
    expect(shownWidth(100, 0)).toBe('100%')
  })
})
