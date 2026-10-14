import { constraints } from '~/shared/api/generated/constraints'
import type { ResourceDraft } from '~/features/upload'
import type { Schema } from '~/shared/api/types'
import { isBlank, type RichDocument } from '~/shared/richtext/rich-text'
import { resourceInfo, type InfoValues } from './resource-info'

export type Resource = Schema<'DownloadResourceDTO'>

export type ResourceFile = Schema<'DownloadFileDTO'>

export type FileHistory = Schema<'DownloadHistoryDTO'>

export type ResourceViewer = Pick<Schema<'UserMeDTO'>, 'id' | 'role'>

export type ResourceRights = { manage: boolean; remove: boolean }

type EditFields = Schema<'EditDownloadSourceBodyInput'>

export type Platform = NonNullable<EditFields['platform']>[number]

export type FileState =
  | 'passed'
  | 'checking'
  | 'awaitingVolumes'
  | 'storing'
  | 'underReview'
  | 'stalled'
  | 'rejected'
  | 'falsePositive'
  | 'risky'

export type Language = NonNullable<EditFields['language']>[number]

export type Simulator = NonNullable<EditFields['simulator']>

export type ReportReason = Schema<'CreateReportInputBody'>['reason']

const editBody = constraints.EditDownloadSourceBodyInput

export const commonReportReason: ReportReason = 'BROKEN_LINK'

export const reportReasons: readonly ReportReason[] = [
  commonReportReason,
  ...constraints.CreateReportInputBody.reason.enum.filter(reason => reason !== commonReportReason),
]

export const platformOptions: readonly Platform[] = editBody.platform.itemEnum

export const languageOptions: readonly Language[] = editBody.language.itemEnum

export const simulatorOptions: readonly Simulator[] = editBody.simulator.enum

export const leastPlatforms = editBody.platform.minItems

export const leastLanguages = editBody.language.minItems

const mobilePlatforms: readonly Platform[] = ['and', 'ios']

const adminRole = 2

const superAdminRole = 3

const hashEdge = 6

export function resourceAnchor(id: number): string {
  return `resource-${id}`
}

export function detections(file: Pick<ResourceFile, 'malware_scan_cases'>): string[] {
  const names = (file.malware_scan_cases ?? []).flatMap(found => found.detected_viruses ?? [])
  return [...new Set(names)]
}

export function stored(file: Pick<ResourceFile, 'stage'>): boolean {
  return file.stage === 'stored'
}

export function fileState(
  file: Pick<ResourceFile, 'stage' | 'malware_scan_cases' | 'is_virus_false_positive'>,
): FileState {
  switch (file.stage) {
    case 'checking':
    case 'storing':
    case 'stalled':
    case 'rejected':
      return file.stage
    case 'under_review':
      return 'underReview'
    case 'awaiting_volumes':
      return 'awaitingVolumes'
    case 'stored':
      if (detections(file).length === 0) {
        return 'passed'
      }
      return file.is_virus_false_positive ? 'falsePositive' : 'risky'
  }
}

export type AwaitedVolumes = { names: string[]; more: number; deadline: Date }

const namedVolumes = 3

export function awaitedVolumes(
  resource: Pick<Resource, 'missing_volumes' | 'volumes_deadline'>,
): AwaitedVolumes | undefined {
  const names = resource.missing_volumes ?? []
  if (names.length === 0 || resource.volumes_deadline === null) {
    return undefined
  }
  return {
    names: names.slice(0, namedVolumes),
    more: Math.max(0, names.length - namedVolumes),
    deadline: new Date(resource.volumes_deadline),
  }
}

export function downloadable(file: Parameters<typeof fileState>[0]): boolean {
  const state = fileState(file)
  return state === 'passed' || state === 'falsePositive'
}

export function shortHash(hash: string): string {
  return hash.length <= hashEdge * 2 + 1
    ? hash
    : `${hash.slice(0, hashEdge)}…${hash.slice(-hashEdge)}`
}

export function rightsOver(
  resource: Pick<Resource, 'creator'>,
  viewer: ResourceViewer | null,
): ResourceRights {
  if (viewer === null) {
    return { manage: false, remove: false }
  }
  return {
    manage: resource.creator.id === viewer.id || viewer.role >= adminRole,
    remove: viewer.role >= superAdminRole,
  }
}

export function needsSimulator(platforms: readonly Platform[]): boolean {
  return platforms.some(platform => mobilePlatforms.includes(platform))
}

export type ResourceFieldValues = InfoValues & {
  platform: Platform[]
  language: Language[]
  simulator: Simulator | ''
  note: RichDocument
}

export function writtenNote(note: RichDocument): RichDocument | undefined {
  return isBlank(note) ? undefined : note
}

export function resourceDraft(values: ResourceFieldValues): ResourceDraft | undefined {
  const note = writtenNote(values.note)
  const { form, ...info } = resourceInfo(values, values.language)
  if (form === undefined) {
    return undefined
  }
  return {
    platform: values.platform,
    language: values.language,
    ...(needsSimulator(values.platform) && values.simulator !== ''
      ? { simulator: values.simulator }
      : {}),
    ...(note === undefined ? {} : { note }),
    ...info,
    form,
  }
}

export type ResourceSummary = {
  count: number
  downloads: number
  updated: string | undefined
  first: number | undefined
}

export function summarizeResources(resources: readonly Resource[]): ResourceSummary {
  const updated = resources
    .map(resource => resource.updated)
    .sort()
    .at(-1)
  return {
    count: resources.length,
    downloads: resources.reduce((total, resource) => total + resource.downloads, 0),
    updated,
    first: resources[0]?.id,
  }
}
