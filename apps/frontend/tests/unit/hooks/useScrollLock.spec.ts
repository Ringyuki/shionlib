// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const loadHook = async () => {
  vi.resetModules()
  return await import('../../../hooks/useScrollLock')
}

describe('hooks/useScrollLock (unit)', () => {
  beforeEach(() => {
    document.body.removeAttribute('data-scroll-locked')
    document.body.style.overflow = ''
    document.body.style.removeProperty('--removed-body-scroll-bar-size')
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true })
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 1180,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('locks and unlocks body scroll', async () => {
    const { useScrollLock } = await loadHook()
    const { unmount } = renderHook(() => useScrollLock(true))

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.getAttribute('data-scroll-locked')).toBe('true')
    expect(document.body.style.getPropertyValue('--removed-body-scroll-bar-size')).toBe('20px')

    unmount()

    expect(document.body.style.overflow).toBe('')
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
    expect(document.body.style.getPropertyValue('--removed-body-scroll-bar-size')).toBe('')
  })

  it('restores existing body scroll lock markers after cleanup', async () => {
    document.body.setAttribute('data-scroll-locked', 'manual')
    document.body.style.overflow = 'scroll'
    document.body.style.setProperty('--removed-body-scroll-bar-size', '2px')

    const { useScrollLock } = await loadHook()
    const { unmount } = renderHook(() => useScrollLock(true))
    unmount()

    expect(document.body.getAttribute('data-scroll-locked')).toBe('manual')
    expect(document.body.style.overflow).toBe('scroll')
    expect(document.body.style.getPropertyValue('--removed-body-scroll-bar-size')).toBe('2px')
  })
})
