// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const loadHook = async () => {
  vi.resetModules()
  return await import('../../../hooks/useRestoreBodyPointerEvents')
}

describe('hooks/useRestoreBodyPointerEvents (unit)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    document.body.style.pointerEvents = ''
  })

  it('overrides pointer-events and restores empty inline style', async () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ pointerEvents: 'none' } as any)

    const { useRestoreBodyPointerEvents } = await loadHook()
    const { unmount } = renderHook(() => useRestoreBodyPointerEvents(true))

    expect(document.body.style.pointerEvents).toBe('auto')
    unmount()
    expect(document.body.style.pointerEvents).toBe('')
  })

  it('restores previous inline pointer-events value', async () => {
    document.body.style.pointerEvents = 'none'
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ pointerEvents: 'none' } as any)

    const { useRestoreBodyPointerEvents } = await loadHook()
    const { unmount } = renderHook(() => useRestoreBodyPointerEvents(true))

    expect(document.body.style.pointerEvents).toBe('auto')
    unmount()
    expect(document.body.style.pointerEvents).toBe('none')
  })
})
