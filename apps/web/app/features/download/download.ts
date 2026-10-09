import type { Schema } from '~/shared/api/types'
import type { Aria2Target } from '~/shared/vendor/aria2'
import {
  isManager,
  managers,
  needsBangumi,
  type Manager,
  type ManagerInstall,
} from '~/shared/vendor/managers'

export const downloadMethods = ['browser', 'aria2', ...managers] as const

export type DownloadMethod = (typeof downloadMethods)[number]

export type DownloadIntent = DownloadMethod | 'copy'

export type DownloadSettings = {
  method: DownloadMethod
  aria2: Aria2Target
  managers: Record<Manager, boolean>
}

export type DownloadFile = Pick<
  Schema<'DownloadFileDTO'>,
  'id' | 'file_name' | 'file_size' | 'file_hash' | 'hash_algorithm'
>

export type DownloadGame = { title: string } & Pick<
  Schema<'GameHeaderDTO'>,
  'b_id' | 'v_id' | 'h_id'
>

export type DownloadSubject = { resourceId: number; file: DownloadFile }

export type DownloadLink = { url: string; expiresAt: number; minutes: number }

export const downloadSettingsKey = 'shionlib_download'

export const defaultAria2Endpoint = 'http://127.0.0.1:6800/jsonrpc'

export const fallbackMethod: DownloadMethod = 'browser'

export const defaultDownloadSettings: DownloadSettings = {
  method: fallbackMethod,
  aria2: { endpoint: defaultAria2Endpoint, secret: '', directory: '' },
  managers: { lunabox: true, reina: true, potatovn: true },
}

export function validMinutes(expiresIn: number): number {
  return Math.max(1, Math.floor(expiresIn / 60))
}

export function linkOf(url: string, expiresIn: number, now: Date): DownloadLink {
  return {
    url,
    expiresAt: Math.floor(now.getTime() / 1000) + expiresIn,
    minutes: validMinutes(expiresIn),
  }
}

export function offeredMethods(settings: DownloadSettings): DownloadMethod[] {
  return downloadMethods.filter(method => !isManager(method) || settings.managers[method])
}

export function usableFor(method: DownloadMethod, game: DownloadGame | undefined): boolean {
  if (!isManager(method) || !needsBangumi(method)) {
    return true
  }
  return game !== undefined && game.b_id !== null && game.b_id !== ''
}

export function preferredMethod(
  settings: DownloadSettings,
  game: DownloadGame | undefined,
): DownloadMethod {
  const { method } = settings
  return offeredMethods(settings).includes(method) && usableFor(method, game)
    ? method
    : fallbackMethod
}

export function withManagerShown(
  settings: DownloadSettings,
  manager: Manager,
  shown: boolean,
): DownloadSettings {
  return {
    ...settings,
    managers: { ...settings.managers, [manager]: shown },
    method: !shown && settings.method === manager ? fallbackMethod : settings.method,
  }
}

export function installOf(
  link: DownloadLink,
  subject: DownloadSubject,
  game: DownloadGame | undefined,
): ManagerInstall {
  const { file } = subject
  return {
    url: link.url,
    expiresAt: link.expiresAt,
    resourceId: subject.resourceId,
    fileName: file.file_name,
    size: file.file_size,
    checksumAlgorithm: file.hash_algorithm,
    checksum: file.file_hash,
    title: game?.title ?? '',
    bangumiId: game?.b_id ?? null,
    vndbId: game?.v_id ?? null,
    hikarinagiId: game?.h_id ?? null,
  }
}
