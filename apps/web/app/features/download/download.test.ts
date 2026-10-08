import { describe, expect, it } from 'vitest'
import { defaultDownloadSettings, validMinutes } from './download'
import { firstIssueMessage } from '~/shared/form/check'
import { aria2Form, downloadMethodFrom, downloadSettingsFrom } from './download.schema'

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

describe('download settings form', () => {
  it('needs a full address for aria2 and nothing else', () => {
    const form = aria2Form(issue => issue)
    const valid = { endpoint: 'http://127.0.0.1:6800/jsonrpc', secret: '', directory: '' }
    expect(firstIssueMessage(form, valid)).toBeUndefined()
    expect(firstIssueMessage(form, { ...valid, endpoint: '127.0.0.1:6800' })).toBe('endpoint')
    expect(firstIssueMessage(form, { ...valid, endpoint: 'nas:6800' })).toBe('endpoint')
    expect(
      firstIssueMessage(form, { ...valid, endpoint: 'https://nas.lan/jsonrpc' }),
    ).toBeUndefined()
  })

  it('reads a download method', () => {
    expect(downloadMethodFrom('aria2')).toBe('aria2')
    expect(downloadMethodFrom('torrent')).toBeUndefined()
  })
})
