// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOnWindowResize } from '../../../hooks/useOnWindowResize'

describe('hooks/useOnWindowResize (unit)', () => {
  it('invokes handler immediately and on resize events', () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() => useOnWindowResize(handler))

    expect(handler).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('resize'))
    expect(handler).toHaveBeenCalledTimes(2)

    unmount()
    window.dispatchEvent(new Event('resize'))
    expect(handler).toHaveBeenCalledTimes(2)
  })
})
