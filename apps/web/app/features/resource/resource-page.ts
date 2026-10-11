import type { GameHeader } from '~/features/game'
import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'
import type { Resource, ResourceFile } from './resource'

export type ResourceEvent = Schema<'DownloadEventDTO'>

export type EventChange = NonNullable<ResourceEvent['changes']>[number]

export type ResourcePage = { resource: Resource; game: GameHeader }

export const resourceTabs = ['contents', 'details', 'history', 'comments'] as const

export type ResourceTab = (typeof resourceTabs)[number]

export const firstTab: ResourceTab = 'contents'

export function resourcePath(locale: Locale, id: number, tab: ResourceTab = firstTab): string {
  const base = `/${locale}/resource/${id}`
  return tab === firstTab ? base : `${base}/${tab}`
}

export function resourceTabAt(pathname: string, pathOf: (tab: ResourceTab) => string): ResourceTab {
  const within = (tab: ResourceTab) =>
    pathname === pathOf(tab) || pathname.startsWith(`${pathOf(tab)}/`)
  return resourceTabs.find(tab => tab !== firstTab && within(tab)) ?? firstTab
}

export type Headline = { name: string; others: number }

export function headlineOf(files: readonly Pick<ResourceFile, 'file_name'>[]): Headline {
  return { name: files[0]?.file_name ?? '', others: Math.max(0, files.length - 1) }
}

export function hashName(algorithm: ResourceFile['hash_algorithm']): string {
  return algorithm === 'sha256' ? 'SHA-256' : 'BLAKE3'
}

export function eventFiles(event: Pick<ResourceEvent, 'files'>) {
  return event.files ?? []
}

export function eventChanges(event: Pick<ResourceEvent, 'changes'>): EventChange[] {
  return event.changes ?? []
}

export function changedValues(values: readonly string[] | null): string[] {
  return [...(values ?? [])]
}
