// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCountdown } from '../../../hooks/useCountdown'

describe('hooks/useCountdown (unit)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts countdown and ticks to zero', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCountdown({ duration: 3, intervalMs: 1000 }))

    act(() => {
      result.current.startCountdown()
    })
    expect(result.current.isCountingDown).toBe(true)
    expect(result.current.countdown).toBe(3)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.countdown).toBe(2)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.countdown).toBe(0)
    expect(result.current.isCountingDown).toBe(false)
  })

  it('resets countdown', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCountdown({ duration: 10, intervalMs: 1000 }))

    act(() => {
      result.current.startCountdown(5)
    })
    expect(result.current.countdown).toBe(5)

    act(() => {
      result.current.resetCountdown()
    })
    expect(result.current.countdown).toBe(0)
    expect(result.current.isCountingDown).toBe(false)
  })
})
