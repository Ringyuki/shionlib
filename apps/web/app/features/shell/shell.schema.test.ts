import { describe, expect, it } from 'vitest'
import { sidebarModeFrom } from './shell.schema'

describe('sidebarModeFrom', () => {
  it('reads the remembered mode and defaults to expanded', () => {
    expect(sidebarModeFrom('a=1; shionlib_sidebar=rail')).toBe('rail')
    expect(sidebarModeFrom('shionlib_sidebar=wide')).toBe('expanded')
    expect(sidebarModeFrom('')).toBe('expanded')
  })
})
