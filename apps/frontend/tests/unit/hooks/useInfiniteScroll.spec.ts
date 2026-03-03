// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useInfiniteScroll } from '../../../hooks/useInfiniteScroll'

type MockEntry = Partial<IntersectionObserverEntry> & { isIntersecting: boolean; target: Element }

class MockIntersectionObserver {
  callback: IntersectionObserverCallback
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }

  trigger(entries: MockEntry[]) {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver)
  }
}

describe('hooks/useInfiniteScroll (unit)', () => {
  let observers: MockIntersectionObserver[]

  beforeEach(() => {
    observers = []
    vi.stubGlobal('IntersectionObserver', function MockIntersectionObserverFactory(
      this: unknown,
      callback: IntersectionObserverCallback,
    ) {
      const observer = new MockIntersectionObserver(callback)
      observers.push(observer)
      return observer
    } as unknown as typeof IntersectionObserver)
  })

  it('observes the sentinel and loads more when it enters the viewport', async () => {
    const onLoadMore = vi.fn().mockResolvedValue(undefined)
    const node = document.createElement('div')

    const { result } = renderHook(() =>
      useInfiniteScroll({ onLoadMore, hasMore: true, rootMargin: '0px 0px 320px 0px' }),
    )

    act(() => {
      result.current(node)
    })

    expect(observers[0]?.observe).toHaveBeenCalledWith(node)

    act(() => {
      observers[0]?.trigger([{ isIntersecting: true, target: node }])
    })

    await waitFor(() => {
      expect(onLoadMore).toHaveBeenCalledTimes(1)
    })
  })

  it('does not start another request while one is already running', async () => {
    let resolveLoad: (() => void) | undefined
    const onLoadMore = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveLoad = resolve
        }),
    )
    const node = document.createElement('div')

    const { result } = renderHook(() => useInfiniteScroll({ onLoadMore, hasMore: true }))

    act(() => {
      result.current(node)
      observers[0]?.trigger([{ isIntersecting: true, target: node }])
      observers[0]?.trigger([{ isIntersecting: true, target: node }])
    })

    expect(onLoadMore).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveLoad?.()
      await Promise.resolve()
    })

    act(() => {
      observers[0]?.trigger([{ isIntersecting: true, target: node }])
    })

    await waitFor(() => {
      expect(onLoadMore).toHaveBeenCalledTimes(2)
    })
  })

  it('stops triggering when there are no more pages', () => {
    const onLoadMore = vi.fn()
    const node = document.createElement('div')

    const { result } = renderHook(() => useInfiniteScroll({ onLoadMore, hasMore: false }))

    act(() => {
      result.current(node)
      observers[0]?.trigger([{ isIntersecting: true, target: node }])
    })

    expect(onLoadMore).not.toHaveBeenCalled()
  })
})
