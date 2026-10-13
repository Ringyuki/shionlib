import { describe, expect, it } from 'vitest'
import { changesPage, navigatesHere } from './in-page'

const plain = {
  button: 0,
  metaKey: false,
  altKey: false,
  ctrlKey: false,
  shiftKey: false,
  defaultPrevented: false,
}

describe('changesPage', () => {
  const here = { pathname: '/zh/game/1', search: '?sort=hot' }

  it('takes another path or another query for another page', () => {
    expect(changesPage(here, { pathname: '/zh/game/1/info', search: '?sort=hot' })).toBe(true)
    expect(changesPage(here, { pathname: '/zh/game/1', search: '' })).toBe(true)
  })

  it('stays on the page when only the hash would differ', () => {
    expect(changesPage(here, { pathname: '/zh/game/1', search: '?sort=hot' })).toBe(false)
  })
})

describe('navigatesHere', () => {
  it('follows a plain primary click in this tab', () => {
    expect(navigatesHere(plain, undefined)).toBe(true)
    expect(navigatesHere(plain, '_self')).toBe(true)
  })

  it('leaves clicks that open elsewhere or were already handled', () => {
    expect(navigatesHere({ ...plain, metaKey: true }, undefined)).toBe(false)
    expect(navigatesHere({ ...plain, ctrlKey: true }, undefined)).toBe(false)
    expect(navigatesHere({ ...plain, shiftKey: true }, undefined)).toBe(false)
    expect(navigatesHere({ ...plain, altKey: true }, undefined)).toBe(false)
    expect(navigatesHere({ ...plain, button: 1 }, undefined)).toBe(false)
    expect(navigatesHere({ ...plain, defaultPrevented: true }, undefined)).toBe(false)
    expect(navigatesHere(plain, '_blank')).toBe(false)
  })
})
