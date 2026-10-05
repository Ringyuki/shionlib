import { constraints } from '~/shared/api/generated/constraints'
import type { Schema } from '~/shared/api/types'

export type Resource = Schema<'DownloadResourceDTO'>

export type ResourceFile = Schema<'DownloadFileDTO'>

export type FileHistory = Schema<'DownloadHistoryDTO'>

type EditFields = Schema<'EditDownloadSourceBodyInput'>

export type Platform = NonNullable<EditFields['platform']>[number]

export type FileState = 'passed' | 'scanning' | 'falsePositive' | 'risky'

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

export const platformFilterFrom = 4

export const fileInObjectStore = 3

const hashEdge = 6

const sizeUnits = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function resourceAnchor(id: number): string {
  return `resource-${id}`
}

export function detections(file: Pick<ResourceFile, 'malware_scan_cases'>): string[] {
  const names = (file.malware_scan_cases ?? []).flatMap(found => found.detected_viruses ?? [])
  return [...new Set(names)]
}

export function fileState(
  file: Pick<ResourceFile, 'file_status' | 'malware_scan_cases' | 'is_virus_false_positive'>,
): FileState {
  if (file.file_status !== fileInObjectStore) {
    return 'scanning'
  }
  if (detections(file).length === 0) {
    return 'passed'
  }
  return file.is_virus_false_positive ? 'falsePositive' : 'risky'
}

export function shortHash(hash: string): string {
  return hash.length <= hashEdge * 2 + 1
    ? hash
    : `${hash.slice(0, hashEdge)}…${hash.slice(-hashEdge)}`
}

export function fileSize(bytes: number): { value: number; unit: (typeof sizeUnits)[number] } {
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1024 && unit < sizeUnits.length - 1) {
    value /= 1024
    unit += 1
  }
  return { value, unit: sizeUnits[unit] ?? 'B' }
}

export function resourcePlatforms(resources: readonly Resource[]): string[] {
  return [...new Set(resources.flatMap(resource => resource.platform ?? []))]
}

export function withPlatform(
  resources: readonly Resource[],
  platform: string | undefined,
): Resource[] {
  return platform === undefined
    ? [...resources]
    : resources.filter(resource => (resource.platform ?? []).includes(platform))
}

export function ownedBy(resource: Pick<Resource, 'creator'>, viewerId: number | null): boolean {
  return viewerId !== null && resource.creator.id === viewerId
}

export function needsSimulator(platforms: readonly Platform[]): boolean {
  return platforms.some(platform => mobilePlatforms.includes(platform))
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
