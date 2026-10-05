import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { issueDownloadLink } from './download.use-cases'

describe('issueDownloadLink', () => {
  it('passes the verification token to the API', async () => {
    const fake = fakeApi().on('get', '/game/download/{id}/link', {
      file_url: 'https://dl.test/a.7z',
      expires_in: 1800,
    })
    await expect(issueDownloadLink(fake.api, { fileId: 4, token: 'tok' })).resolves.toMatchObject({
      file_url: 'https://dl.test/a.7z',
    })
    const url = new URL(fake.requests[0]?.url ?? '')
    expect(url.pathname).toBe('/game/download/4/link')
    expect(url.searchParams.get('token')).toBe('tok')
  })
})
