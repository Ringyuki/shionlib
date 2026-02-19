// @vitest-environment jsdom
import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import useMasonry from '../../../hooks/useMasonry'

const buildRect = (left: number, top: number, bottom: number): DOMRect => {
  return {
    x: left,
    y: top,
    width: 100,
    height: bottom - top,
    top,
    right: left + 100,
    bottom,
    left,
    toJSON: () => ({}),
  } as DOMRect
}

const Harness = () => {
  const [masonryContainer, isInitialized] = useMasonry()

  return React.createElement(
    'div',
    null,
    React.createElement('div', { 'data-testid': 'is-initialized' }, String(isInitialized)),
    React.createElement(
      'div',
      {
        'data-testid': 'container',
        ref: masonryContainer,
        style: { rowGap: '10px' },
      },
      React.createElement('div', { 'data-testid': 'a' }),
      React.createElement('div', { 'data-testid': 'b' }),
      React.createElement('div', { 'data-testid': 'c' }),
    ),
  )
}

describe('hooks/useMasonry (unit)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes and applies masonry margin for same-column siblings', async () => {
    const rectMap = new Map<string, DOMRect>([
      ['a', buildRect(0, 0, 100)],
      ['b', buildRect(120, 0, 100)],
      ['c', buildRect(0, 150, 250)],
    ])

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const id = this.getAttribute('data-testid') || ''
      return rectMap.get(id) || buildRect(0, 0, 0)
    })

    render(React.createElement(Harness))

    await waitFor(() => {
      expect(screen.getByTestId('is-initialized').textContent).toBe('true')
    })

    await waitFor(() => {
      expect((screen.getByTestId('c') as HTMLElement).style.marginTop).toBe('-40px')
    })
  })

  it('recomputes layout on mutation and resize', async () => {
    const rectMap = new Map<string, DOMRect>([
      ['a', buildRect(0, 0, 100)],
      ['b', buildRect(120, 0, 100)],
      ['c', buildRect(0, 150, 250)],
    ])

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const id = this.getAttribute('data-testid') || ''
      return rectMap.get(id) || buildRect(0, 0, 0)
    })

    render(React.createElement(Harness))

    await waitFor(() => {
      expect(screen.getByTestId('is-initialized').textContent).toBe('true')
    })

    const container = screen.getByTestId('container')
    const d = document.createElement('div')
    d.setAttribute('data-testid', 'd')
    rectMap.set('d', buildRect(0, 180, 280))

    await act(async () => {
      container.appendChild(d)
    })

    await waitFor(() => {
      expect(d.style.marginTop).toBe('80px')
    })

    rectMap.set('d', buildRect(0, 210, 310))

    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })

    await waitFor(() => {
      expect(d.style.marginTop).toBe('50px')
    })
  })
})
