import type { Composition } from '~/features/resource'
import type { Allowance, Submission, Upload } from '~/features/upload'
import type { ApiQuery, Schema } from '~/shared/api/types'

export type OwnResource = Schema<'DownloadOwnResourceDTO'>

export type Summary = Schema<'DownloadOwnSummaryDTO'>

type Counts = Pick<Summary, 'processing' | 'published'>

type ListQuery = ApiQuery<'/game/download-source/mine', 'get'>

export type Scope = NonNullable<ListQuery['scope']>

export type SortKey = NonNullable<ListQuery['sort_by']>

export const stages = ['uploading', 'processing', 'published'] as const

export type Stage = (typeof stages)[number]

export const sortKeys = ['updated', 'downloads'] as const satisfies readonly SortKey[]

export type Listing = {
  stage: Stage | undefined
  search: string
  sort: SortKey
  ascending: boolean
  page: number
}

export type UploaderContent = {
  allowance: Allowance
  summary: Summary
  listing: Listing
  resources: OwnResource[]
  compositions: Composition[]
  total: number
}

export type Transfer = { submission: Submission; uploads: Upload[] }

type Identified = { resource: Pick<OwnResource['resource'], 'id'> }

export type Entry<Own extends Identified = OwnResource> =
  | { kind: 'transfer'; key: string; transfer: Transfer }
  | { kind: 'resource'; key: string; own: Own }

export type Emptiness = 'nothing' | 'unmatched' | Stage

export const firstListing: Listing = {
  stage: undefined,
  search: '',
  sort: 'updated',
  ascending: false,
  page: 1,
}

export const orders = [
  { name: 'recent', sort: 'updated', ascending: false },
  { name: 'oldest', sort: 'updated', ascending: true },
  { name: 'mostDownloaded', sort: 'downloads', ascending: false },
  { name: 'leastDownloaded', sort: 'downloads', ascending: true },
] as const satisfies readonly (Pick<Listing, 'sort' | 'ascending'> & { name: string })[]

export type Order = (typeof orders)[number]

export const pageSize = 20

export const refreshEvery = 15_000

export const searchDelay = 350

export function scopeOf(stage: Exclude<Stage, 'uploading'> | undefined): Scope {
  return stage ?? 'all'
}

type Staged = Pick<OwnResource['resource'], 'published_at'> & {
  files: readonly Pick<Schema<'DownloadFileDTO'>, 'stage'>[] | null
}

export function stageOf({ files, published_at }: Staged): Exclude<Stage, 'uploading'> {
  const settled = (files ?? []).every(file => file.stage === 'stored')
  return published_at !== null && settled ? 'published' : 'processing'
}

export function orderOf(listing: Pick<Listing, 'sort' | 'ascending'>): Order {
  const chosen = orders.find(
    order => order.sort === listing.sort && order.ascending === listing.ascending,
  )
  return chosen ?? orders[0]
}

export function matchingTransfers(transfers: readonly Transfer[], search: string): Transfer[] {
  const wanted = search.trim().toLowerCase()
  return transfers.filter(({ submission, uploads }) =>
    [submission.label, ...uploads.map(upload => upload.name ?? upload.file.name)].some(name =>
      name.toLowerCase().includes(wanted),
    ),
  )
}

export function entriesOf<Own extends Identified>(
  listing: Listing,
  transfers: readonly Transfer[],
  resources: readonly Own[],
): Entry<Own>[] {
  const leading = listing.stage === undefined || listing.stage === 'uploading'
  const queued = leading && listing.page === 1 ? matchingTransfers(transfers, listing.search) : []
  return [
    ...queued.map((transfer): Entry<Own> => ({
      kind: 'transfer',
      key: `transfer:${transfer.submission.id}`,
      transfer,
    })),
    ...resources.map((own): Entry<Own> => ({
      kind: 'resource',
      key: `resource:${own.resource.id}`,
      own,
    })),
  ]
}

export function emptinessOf(listing: Listing, summary: Counts, queued: number): Emptiness {
  if (listing.search !== '') {
    return 'unmatched'
  }
  if (nothingUploaded(summary) && queued === 0 && listing.stage !== 'uploading') {
    return 'nothing'
  }
  return listing.stage ?? 'nothing'
}

type Moving = Pick<Upload, 'sent' | 'speed'> & {
  file: Pick<Upload['file'], 'size'>
  phase: Pick<Upload['phase'], 'name'>
}

export function paceOf(uploads: readonly Moving[]): { speed: number; seconds: number } | undefined {
  const speed = uploads
    .filter(upload => upload.phase.name === 'running')
    .reduce((sum, upload) => sum + upload.speed, 0)
  if (speed <= 0) {
    return undefined
  }
  const left = uploads
    .filter(upload => upload.phase.name !== 'failed')
    .reduce((sum, upload) => sum + Math.max(0, upload.file.size - upload.sent), 0)
  return { speed, seconds: Math.ceil(left / speed) }
}

export function heldSince<Token>(
  held: ReadonlyMap<string, Token>,
  ids: readonly string[],
  token: Token,
): ReadonlyMap<string, Token> {
  if (ids.length === held.size && ids.every(id => held.has(id))) {
    return held
  }
  const next = new Map<string, Token>()
  for (const id of ids) {
    const since = held.get(id)
    next.set(id, since === undefined ? token : since)
  }
  return next
}

export function listingSearch(listing: Listing): string {
  const params = new URLSearchParams()
  if (listing.stage !== undefined) {
    params.set('status', listing.stage)
  }
  if (listing.search !== '') {
    params.set('q', listing.search)
  }
  if (listing.sort !== firstListing.sort) {
    params.set('sort', listing.sort)
  }
  if (listing.ascending) {
    params.set('order', 'asc')
  }
  if (listing.page > 1) {
    params.set('page', String(listing.page))
  }
  const query = params.toString()
  return query === '' ? '' : `?${query}`
}

export function nothingUploaded(summary: Counts): boolean {
  return summary.processing + summary.published === 0
}
