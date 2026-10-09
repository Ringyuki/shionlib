import { describe, expect, it } from 'vitest'
import { firstIssueMessage } from '~/shared/form/check'
import {
  defaultDownloadSettings,
  installOf,
  linkOf,
  offeredMethods,
  preferredMethod,
  usableFor,
  validMinutes,
  withManagerShown,
  type DownloadGame,
  type DownloadSettings,
  type DownloadSubject,
} from './download'
import {
  aria2Form,
  aria2TargetFrom,
  downloadMethodFrom,
  downloadSettingsFrom,
} from './download.schema'

const game: DownloadGame = { title: '千恋＊万花', b_id: '172612', v_id: 'v19829', h_id: 9 }

const unlisted: DownloadGame = { title: 'Untitled', b_id: null, v_id: null, h_id: null }

const subject: DownloadSubject = {
  resourceId: 12,
  file: {
    id: 7,
    file_name: 'game.7z',
    file_size: 4096,
    file_hash: 'abc123',
    hash_algorithm: 'blake3',
  },
}

const withMethod = (method: DownloadSettings['method']): DownloadSettings => ({
  ...defaultDownloadSettings,
  method,
})

describe('downloadSettingsFrom', () => {
  it('reads stored settings and repairs what is broken', () => {
    expect(downloadSettingsFrom(null)).toEqual(defaultDownloadSettings)
    expect(downloadSettingsFrom('not json')).toEqual(defaultDownloadSettings)
    expect(
      downloadSettingsFrom(
        JSON.stringify({
          method: 'aria2',
          aria2: { endpoint: 'http://nas:6800/jsonrpc', secret: 's' },
        }),
      ),
    ).toEqual({
      method: 'aria2',
      aria2: { endpoint: 'http://nas:6800/jsonrpc', secret: 's', directory: '' },
      managers: { lunabox: true, reina: true, potatovn: true },
    })
    expect(downloadSettingsFrom(JSON.stringify({ method: 'ftp' })).method).toBe('browser')
  })

  it('keeps which managers are shown and shows the ones it was not told about', () => {
    const stored = JSON.stringify({ method: 'reina', managers: { lunabox: false, reina: 'yes' } })
    expect(downloadSettingsFrom(stored)).toMatchObject({
      method: 'reina',
      managers: { lunabox: false, reina: true, potatovn: true },
    })
  })
})

describe('link', () => {
  it('rounds the link lifetime down to whole minutes', () => {
    expect(validMinutes(1800)).toBe(30)
    expect(validMinutes(20)).toBe(1)
  })

  it('says when the link ends in seconds since the epoch', () => {
    expect(linkOf('https://dl.test/a', 1800, new Date('2026-10-09T00:00:00.500Z'))).toEqual({
      url: 'https://dl.test/a',
      expiresAt: 1791504000 + 1800,
      minutes: 30,
    })
  })
})

describe('methods', () => {
  it('offers the browser and aria2 always and a manager while it is shown', () => {
    expect(offeredMethods(defaultDownloadSettings)).toEqual([
      'browser',
      'aria2',
      'lunabox',
      'reina',
      'potatovn',
    ])
    expect(offeredMethods(withManagerShown(defaultDownloadSettings, 'reina', false))).toEqual([
      'browser',
      'aria2',
      'lunabox',
      'potatovn',
    ])
  })

  it('needs a Bangumi id only for the managers that go by it', () => {
    expect(usableFor('reina', game)).toBe(true)
    expect(usableFor('reina', unlisted)).toBe(false)
    expect(usableFor('potatovn', { ...game, b_id: '' })).toBe(false)
    expect(usableFor('potatovn', undefined)).toBe(false)
    expect(usableFor('lunabox', unlisted)).toBe(true)
    expect(usableFor('aria2', undefined)).toBe(true)
  })

  it('uses the chosen method where it can and the browser where it cannot', () => {
    expect(preferredMethod(withMethod('aria2'), unlisted)).toBe('aria2')
    expect(preferredMethod(withMethod('reina'), game)).toBe('reina')
    expect(preferredMethod(withMethod('reina'), unlisted)).toBe('browser')
    const hidden = {
      ...withMethod('lunabox'),
      managers: { lunabox: false, reina: true, potatovn: true },
    }
    expect(preferredMethod(hidden, game)).toBe('browser')
  })

  it('goes back to the browser when the default manager is hidden', () => {
    expect(withManagerShown(withMethod('lunabox'), 'lunabox', false)).toMatchObject({
      method: 'browser',
      managers: { lunabox: false },
    })
    expect(withManagerShown(withMethod('lunabox'), 'reina', false).method).toBe('lunabox')
    expect(withManagerShown(withMethod('aria2'), 'lunabox', true).managers.lunabox).toBe(true)
  })
})

describe('installOf', () => {
  it('describes the file, its resource and its game to a manager', () => {
    const link = { url: 'https://dl.test/a', expiresAt: 1_800_000_000, minutes: 30 }
    expect(installOf(link, subject, game)).toEqual({
      url: 'https://dl.test/a',
      expiresAt: 1_800_000_000,
      resourceId: 12,
      fileName: 'game.7z',
      size: 4096,
      checksumAlgorithm: 'blake3',
      checksum: 'abc123',
      title: '千恋＊万花',
      bangumiId: '172612',
      vndbId: 'v19829',
      hikarinagiId: 9,
    })
    expect(installOf(link, subject, undefined)).toMatchObject({
      title: '',
      bangumiId: null,
      vndbId: null,
      hikarinagiId: null,
    })
  })
})

describe('download settings form', () => {
  const valid = { endpoint: 'http://127.0.0.1:6800/jsonrpc', secret: '', directory: '' }

  it('needs a full address for aria2 and nothing else', () => {
    const form = aria2Form(issue => issue)
    expect(firstIssueMessage(form, valid)).toBeUndefined()
    expect(firstIssueMessage(form, { ...valid, endpoint: '127.0.0.1:6800' })).toBe('endpoint')
    expect(firstIssueMessage(form, { ...valid, endpoint: 'nas:6800' })).toBe('endpoint')
    expect(
      firstIssueMessage(form, { ...valid, endpoint: 'https://nas.lan/jsonrpc' }),
    ).toBeUndefined()
  })

  it('gives the aria2 target only when its address is usable', () => {
    expect(aria2TargetFrom({ ...valid, endpoint: ' https://nas.lan/jsonrpc ' })).toEqual({
      ...valid,
      endpoint: 'https://nas.lan/jsonrpc',
    })
    expect(aria2TargetFrom({ ...valid, endpoint: 'http://' })).toBeUndefined()
    expect(aria2TargetFrom({ ...valid, endpoint: 'nas' })).toBeUndefined()
  })

  it('reads a download method', () => {
    expect(downloadMethodFrom('aria2')).toBe('aria2')
    expect(downloadMethodFrom('potatovn')).toBe('potatovn')
    expect(downloadMethodFrom('torrent')).toBeUndefined()
  })
})
