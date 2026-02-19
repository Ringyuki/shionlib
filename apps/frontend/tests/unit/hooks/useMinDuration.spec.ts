// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMinDuration } from '../../../hooks/useMinDuration'

describe('hooks/useMinDuration (unit)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ensures minimum duration for async task', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useMinDuration(500))
    const task = vi.fn(async () => 'ok')

    let promise: Promise<string>
    act(() => {
      promise = result.current.runWithMinDuration(task, 1000)
    })

    await vi.advanceTimersByTimeAsync(999)
    let settled = false
    promise!.then(() => {
      settled = true
    })
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(promise!).resolves.toBe('ok')
    expect(task).toHaveBeenCalledTimes(1)
  })
})
