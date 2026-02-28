import { isGameDownloadLinkRoute } from './is-game-download-link-route'

describe('isGameDownloadLinkRoute', () => {
  it('matches only the download link endpoint', () => {
    expect(isGameDownloadLinkRoute({ method: 'GET', path: '/game/download/123/link' })).toBe(true)
    expect(isGameDownloadLinkRoute({ method: 'GET', path: '/game/download/123/link/' })).toBe(true)
  })

  it('does not match overlapping download-source routes', () => {
    expect(isGameDownloadLinkRoute({ method: 'GET', path: '/game/download-source/list' })).toBe(
      false,
    )
    expect(
      isGameDownloadLinkRoute({ method: 'GET', path: '/game/download-source/file/1/history' }),
    ).toBe(false)
  })

  it('does not match other methods or malformed paths', () => {
    expect(isGameDownloadLinkRoute({ method: 'POST', path: '/game/download/123/link' })).toBe(false)
    expect(isGameDownloadLinkRoute({ method: 'GET', path: '/game/download/abc/link' })).toBe(false)
    expect(isGameDownloadLinkRoute({ method: 'GET', path: '/game/download/123' })).toBe(false)
    expect(isGameDownloadLinkRoute()).toBe(false)
  })
})
