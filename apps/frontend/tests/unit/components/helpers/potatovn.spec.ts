import { describe, expect, it } from 'vitest'
import { buildPotatoVNUrl } from '../../../../components/game/download/helpers/potatovn'

describe('components/game/download/helpers/potatovn (unit)', () => {
  const base = {
    resourceId: 12,
    url: 'https://dl.example.com/game.7z?sig=abc',
    fileName: 'game.7z',
    size: 1234,
    checksumAlgo: 'sha256' as const,
    checksum: 'deadbeef',
    expiresAt: 1700000000,
    title: 'CLANNAD',
    bangumiId: '13',
  }

  it('builds a potato-vn install url with the v1 parameter set', () => {
    const url = new URL(buildPotatoVNUrl(base))

    expect(url.protocol).toBe('potato-vn:')
    expect(url.host).toBe('install')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      v: '1',
      provider: 'shionlib',
      resource_id: '12',
      url: base.url,
      file_name: 'game.7z',
      archive_format: '7z',
      size: '1234',
      checksum_algo: 'sha256',
      checksum: 'deadbeef',
      expires_at: '1700000000',
      bgm_id: '13',
      title: 'CLANNAD',
    })
  })

  it('adds the optional ids only when provided and normalizes the vndb prefix', () => {
    const withIds = new URL(buildPotatoVNUrl({ ...base, vndbId: '17', hikarinagiId: 42 }))
    expect(withIds.searchParams.get('vndb_id')).toBe('v17')
    expect(withIds.searchParams.get('hikarinagi_id')).toBe('42')

    const prefixed = new URL(buildPotatoVNUrl({ ...base, vndbId: 'v17' }))
    expect(prefixed.searchParams.get('vndb_id')).toBe('v17')

    const withoutIds = new URL(buildPotatoVNUrl(base))
    expect(withoutIds.searchParams.has('vndb_id')).toBe(false)
    expect(withoutIds.searchParams.has('hikarinagi_id')).toBe(false)
  })
})
