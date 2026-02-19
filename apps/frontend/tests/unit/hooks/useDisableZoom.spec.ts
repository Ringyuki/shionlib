// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDisableZoom } from '../../../hooks/useDisableZoom'

describe('hooks/useDisableZoom (unit)', () => {
  it('creates viewport meta and cleans it up when missing originally', () => {
    document.head.innerHTML = ''
    const { unmount } = renderHook(() => useDisableZoom(true))

    const meta = document.querySelector('meta[name="viewport"]')
    expect(meta?.getAttribute('content')).toContain('maximum-scale=1')

    unmount()
    expect(document.querySelector('meta[name="viewport"]')).toBeNull()
  })

  it('restores original viewport content when meta existed', () => {
    document.head.innerHTML = ''
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'viewport')
    meta.setAttribute('content', 'width=device-width')
    document.head.appendChild(meta)

    const { unmount } = renderHook(() => useDisableZoom(true))
    expect(meta.getAttribute('content')).toContain('user-scalable=no')

    unmount()
    expect(meta.getAttribute('content')).toBe('width=device-width')
  })
})
