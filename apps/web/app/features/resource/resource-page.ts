import type { GameHeader } from '~/features/game'
import type { Inspection } from '~/features/inspection'
import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'
import {
  fileState,
  type AwaitedVolumes,
  type FileState,
  type Resource,
  type ResourceFile,
} from './resource'

export type ResourceEvent = Schema<'DownloadEventDTO'>

export type EventChange = NonNullable<ResourceEvent['changes']>[number]

export type ResourcePage = { resource: Resource; game: GameHeader; inspections: Inspection[] }

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

export const pendingStates = [
  'rejected',
  'underReview',
  'stalled',
  'awaitingVolumes',
  'checking',
  'storing',
] as const

export type PendingState = Extract<FileState, (typeof pendingStates)[number]>

export type PageNotice = {
  state: PendingState
  rejection: ResourceFile['rejection']
  awaited: AwaitedVolumes | undefined
}

export function pendingState(file: Parameters<typeof fileState>[0]): PendingState | undefined {
  const state = fileState(file)
  return pendingStates.find(pending => pending === state)
}

export function noticeOf(
  files: readonly (Parameters<typeof fileState>[0] & Pick<ResourceFile, 'rejection'>)[],
  awaited?: AwaitedVolumes,
): PageNotice | undefined {
  for (const state of pendingStates) {
    const file = files.find(candidate => pendingState(candidate) === state)
    if (file !== undefined) {
      return { state, rejection: file.rejection, awaited }
    }
  }
  return undefined
}

export type Headline = { name: string; others: number }

export function headlineOf(files: readonly Pick<ResourceFile, 'file_name'>[]): Headline {
  return { name: files[0]?.file_name ?? '', others: Math.max(0, files.length - 1) }
}

export type Digest = { name: 'SHA-256' | 'BLAKE3'; value: string }

export function digestsOf(
  file: Pick<ResourceFile, 'hash_algorithm' | 'file_hash' | 'sha256'>,
): Digest[] {
  const digests: Digest[] = []
  const sha256 = file.sha256 ?? (file.hash_algorithm === 'sha256' ? file.file_hash : null)
  if (sha256 !== null) {
    digests.push({ name: 'SHA-256', value: sha256 })
  }
  if (file.hash_algorithm === 'blake3') {
    digests.push({ name: 'BLAKE3', value: file.file_hash })
  }
  return digests
}

type Inspected = Pick<ResourceFile, 'inspection_id'>

export type FileGroup<File extends Inspected = ResourceFile> = {
  files: File[]
  inspection: Inspection | undefined
}

export function inspectionOf(
  file: Inspected,
  inspections: readonly Inspection[],
): Inspection | undefined {
  return inspections.find(inspection => inspection.id === file.inspection_id)
}

export function fileGroups<File extends Inspected>(
  files: readonly File[],
  inspections: readonly Inspection[],
): FileGroup<File>[] {
  const groups: FileGroup<File>[] = []
  for (const file of files) {
    const inspection = inspectionOf(file, inspections)
    const shared = groups.find(
      group => inspection !== undefined && group.inspection?.id === inspection.id,
    )
    if (shared === undefined) {
      groups.push({ files: [file], inspection })
    } else {
      shared.files.push(file)
    }
  }
  return groups
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
