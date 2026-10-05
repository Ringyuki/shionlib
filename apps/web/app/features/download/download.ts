import type { Aria2Target } from '~/shared/vendor/aria2'

export const downloadMethods = ['browser', 'aria2'] as const

export type DownloadMethod = (typeof downloadMethods)[number]

export type DownloadIntent = DownloadMethod | 'copy'

export type DownloadSettings = {
  method: DownloadMethod
  aria2: Aria2Target
}

export const downloadSettingsKey = 'shionlib_download'

export const defaultAria2Endpoint = 'http://127.0.0.1:6800/jsonrpc'

export const defaultDownloadSettings: DownloadSettings = {
  method: 'browser',
  aria2: { endpoint: defaultAria2Endpoint, secret: '', directory: '' },
}

export const turnstileAction = 'download'

export function validMinutes(expiresIn: number): number {
  return Math.max(1, Math.floor(expiresIn / 60))
}
