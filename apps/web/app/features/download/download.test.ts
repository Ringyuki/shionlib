import { describe, expect, it } from 'vitest'
import { defaultDownloadSettings, validMinutes } from './download'
import { downloadSettingsFrom } from './download.schema'

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
    })
    expect(downloadSettingsFrom(JSON.stringify({ method: 'ftp' })).method).toBe('browser')
  })
})

describe('validMinutes', () => {
  it('rounds the link lifetime down to whole minutes', () => {
    expect(validMinutes(1800)).toBe(30)
    expect(validMinutes(20)).toBe(1)
  })
})
