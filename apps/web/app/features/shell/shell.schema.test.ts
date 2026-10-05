import { describe, expect, it } from 'vitest'
import { historyStateOf, scrollTopOf, sidebarModeFrom } from './shell.schema'

describe('sidebarModeFrom', () => {
  it('reads the remembered mode and defaults to expanded', () => {
    expect(sidebarModeFrom('a=1; shionlib_sidebar=rail')).toBe('rail')
    expect(sidebarModeFrom('shionlib_sidebar=wide')).toBe('expanded')
    expect(sidebarModeFrom('')).toBe('expanded')
  })
})

describe('scroll restoration input', () => {
  it('accepts only object history states and finite positions', () => {
    expect(historyStateOf({ idx: 3 })).toEqual({ idx: 3 })
    expect(historyStateOf(null)).toEqual({})
    expect(scrollTopOf('120')).toBe(120)
    expect(scrollTopOf('x')).toBeUndefined()
    expect(scrollTopOf(null)).toBeUndefined()
  })
})
