import { describe, expect, it } from 'vitest'
import { keepWithinPages, requestedPage } from './paging'

function address(search: string): URL {
  return new URL(`https://shionlib.test/zh/developer${search}`)
}

function redirected(run: () => void): string | null {
  try {
    run()
  } catch (thrown) {
    if (thrown instanceof Response) {
      return thrown.headers.get('Location')
    }
    throw thrown
  }
  return null
}

describe('requestedPage', () => {
  it('reads the page of the address and falls back to the first', () => {
    expect(requestedPage(address('?page=4'))).toBe(4)
    expect(requestedPage(address('?page=-2'))).toBe(1)
    expect(requestedPage(address(''))).toBe(1)
  })
})

describe('keepWithinPages', () => {
  it('lets a page that exists through', () => {
    expect(redirected(() => keepWithinPages(address('?page=2'), 21, 20))).toBeNull()
    expect(redirected(() => keepWithinPages(address(''), 0, 20))).toBeNull()
  })

  it('sends a page past the end to the last one and keeps the rest of the address', () => {
    expect(redirected(() => keepWithinPages(address('?q=yuzu&page=9'), 21, 20))).toBe(
      '/zh/developer?q=yuzu&page=2',
    )
    expect(redirected(() => keepWithinPages(address('?q=yuzu&page=9'), 3, 20))).toBe(
      '/zh/developer?q=yuzu',
    )
  })
})
