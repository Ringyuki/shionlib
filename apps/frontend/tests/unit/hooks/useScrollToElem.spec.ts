// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useScrollToElem } from '../../../hooks/useScrollToElem'

const rect = (top: number, bottom: number, left = 0, right = 0) => ({
  top,
  bottom,
  left,
  right,
  width: right - left,
  height: bottom - top,
  x: left,
  y: top,
  toJSON: () => ({}),
})

describe('hooks/useScrollToElem (unit)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.stubGlobal('scrollTo', vi.fn())
    Object.defineProperty(window, 'pageYOffset', { value: 200, configurable: true })
  })

  it('scrolls to target with top bar offset and updates hash', () => {
    const topBar = document.createElement('div')
    topBar.className = 'fixed inset-x-0'
    topBar.getBoundingClientRect = () => rect(0, 50)
    document.body.appendChild(topBar)

    const target = document.createElement('section')
    target.id = 'section-1'
    target.getBoundingClientRect = () => rect(300, 340)
    document.body.appendChild(target)

    const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
    const { result } = renderHook(() =>
      useScrollToElem({ extraMargin: 10, behavior: 'auto', updateHash: true }),
    )

    act(() => {
      result.current(target)
    })

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 440, behavior: 'auto' })
    expect(replaceState).toHaveBeenCalledWith(null, '', '#section-1')
  })

  it('does nothing for missing target', () => {
    const { result } = renderHook(() => useScrollToElem())

    act(() => {
      result.current('missing-id')
    })

    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
