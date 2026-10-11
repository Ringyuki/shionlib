import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { contentLimits, languages } from './viewer'
import { contentLimitFrom, preferenceCommand } from './viewer.schema'
import { loadViewer, savePreferences } from './viewer.use-cases'
import { parseOptional } from '~/shared/form/check'
import { locales } from '~/shared/i18n/locale'

describe('loadViewer', () => {
  it('is nothing for a guest and fails on anything else', async () => {
    const guest = fakeApi().fail('get', '/user/me', 401, { code: 200101, message: 'unauthorized' })
    await expect(loadViewer(guest.api)).resolves.toBeNull()
    const broken = fakeApi().fail('get', '/user/me', 500, { code: 500, message: 'down' })
    await expect(loadViewer(broken.api)).rejects.toMatchObject({ status: 500 })
  })
})

describe('savePreferences', () => {
  it('saves only what changed, each at its own endpoint', async () => {
    const fake = fakeApi()
      .on('post', '/user/info/lang', undefined)
      .on('post', '/user/info/content-limit', undefined)
      .on('post', '/user/info/only-games-with-resources', undefined)
      .on('post', '/user/info/profile-backgrounds', undefined)
    await savePreferences(fake.api, { contentLimit: 2 })
    expect(fake.requests.map(request => new URL(request.url).pathname)).toEqual([
      '/user/info/content-limit',
    ])
    await savePreferences(fake.api, { lang: 'ja', onlyGamesWithResources: false })
    await expect(fake.requests[0]?.json()).resolves.toEqual({ content_limit: 2 })
    await expect(fake.requests[1]?.json()).resolves.toEqual({ lang: 'ja' })
    await expect(fake.requests[2]?.json()).resolves.toEqual({ only_games_with_resources: false })
    await savePreferences(fake.api, { showProfileBackgrounds: false })
    await expect(fake.requests[3]?.json()).resolves.toEqual({ show_profile_backgrounds: false })
  })
})

describe('preferences', () => {
  it('take their values from the API contract', () => {
    expect([...languages].sort()).toEqual([...locales].sort())
    expect(contentLimits).toEqual([1, 2, 3])
    expect(contentLimitFrom(2)).toBe(2)
    expect(contentLimitFrom(4)).toBeUndefined()
    expect(parseOptional(preferenceCommand, { lang: 'fr' })).toBeUndefined()
    expect(parseOptional(preferenceCommand, { contentLimit: 3 })).toEqual({ contentLimit: 3 })
  })
})
