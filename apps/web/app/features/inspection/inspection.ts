import type { Schema } from '~/shared/api/types'

export type Inspection = Schema<'InspectionDTO'>

export type Disc = Schema<'InspectionDiscDTO'>

export type Entry = Schema<'InspectionEntryDTO'>

export type Match = Schema<'InspectionFoundDTO'>

export type Listed = Entry & { location?: string }

export type EntryPage = { entries: Listed[]; total: number }

export type Branch = EntryPage & { loading: boolean }

export type Branches = Record<string, Branch>

export type View = { inspectionId: number; query: string }

export type Contents = { view: View; branches: Branches; expanded: number[] }

export type Place = { parent: number | null; page: number }

export type InspectedFile = Pick<Schema<'DownloadFileDTO'>, 'file_name' | 'inspection_id' | 'stage'>

export type Unread = 'reading' | 'waiting' | 'failed' | 'unread'

export type EntryNode = { value: number | string; label: string; children?: EntryNode[] }

export type Meaning =
  | { kind: 'entry'; entry: Listed }
  | { kind: 'loading'; place: Place }
  | { kind: 'more'; parent: number | null; left: number }

export const entryPageSize = 200

export const filterDelay = 350

export const maxQueryLength = 100

const topKey = 'top'

const loadingMark = 'load'

const moreMark = 'more'

export function branchKey(parent: number | null): string {
  return parent === null ? topKey : String(parent)
}

function parentOf(key: string): number | null {
  return key === topKey ? null : Number(key)
}

export function expandable(entry: Pick<Entry, 'kind' | 'children'>): boolean {
  return entry.kind !== 'file' && entry.kind !== 'track' && entry.children > 0
}

export function withPage(branches: Branches, parent: number | null, page: EntryPage): Branches {
  const key = branchKey(parent)
  const known = branches[key]?.entries ?? []
  const fresh = page.entries.filter(entry => !known.some(seen => seen.id === entry.id))
  return {
    ...branches,
    [key]: { entries: [...known, ...fresh], total: page.total, loading: false },
  }
}

export function wanting(branches: Branches, parent: number | null): Branches {
  const key = branchKey(parent)
  const branch = branches[key]
  return branch === undefined ? branches : { ...branches, [key]: { ...branch, loading: true } }
}

function nextPage(branch: Branch | undefined): number {
  return branch === undefined ? 1 : Math.floor(branch.entries.length / entryPageSize) + 1
}

function nodesUnder(branches: Branches, parent: number | null): EntryNode[] {
  const key = branchKey(parent)
  const branch = branches[key]
  const pending: EntryNode = { value: `${loadingMark}:${key}:${nextPage(branch)}`, label: '' }
  if (branch === undefined) {
    return [pending]
  }
  const nodes: EntryNode[] = branch.entries.map(entry =>
    expandable(entry)
      ? { value: entry.id, label: entry.name, children: nodesUnder(branches, entry.id) }
      : { value: entry.id, label: entry.name },
  )
  if (branch.entries.length >= branch.total) {
    return nodes
  }
  return [...nodes, branch.loading ? pending : { value: `${moreMark}:${key}`, label: '' }]
}

export function treeOf(branches: Branches): EntryNode[] {
  return nodesUnder(branches, null)
}

export function entriesById(branches: Branches): Map<number, Listed> {
  const known = new Map<number, Listed>()
  for (const branch of Object.values(branches)) {
    for (const entry of branch.entries) {
      known.set(entry.id, entry)
    }
  }
  return known
}

export function meaningOf(
  branches: Branches,
  known: ReadonlyMap<number, Listed>,
  value: number | string,
): Meaning | undefined {
  if (typeof value === 'number') {
    const entry = known.get(value)
    return entry === undefined ? undefined : { kind: 'entry', entry }
  }
  const [mark, key, page] = value.split(':')
  if (key === undefined) {
    return undefined
  }
  const parent = parentOf(key)
  if (mark === loadingMark) {
    return { kind: 'loading', place: { parent, page: Number(page) } }
  }
  const branch = branches[key]
  return branch === undefined
    ? undefined
    : { kind: 'more', parent, left: branch.total - branch.entries.length }
}

export function topTotal(branches: Branches): number {
  return branches[topKey]?.total ?? 0
}

export function viewSearch(view: Partial<View>, first: number | undefined): string {
  const params = new URLSearchParams()
  if (view.inspectionId !== undefined && view.inspectionId !== first) {
    params.set('file', String(view.inspectionId))
  }
  const query = view.query?.trim() ?? ''
  if (query !== '') {
    params.set('q', query)
  }
  const search = params.toString()
  return search === '' ? '' : `?${search}`
}

export function matchParts(name: string, query: string): [string, string, string] {
  const at = query === '' ? -1 : name.toLowerCase().indexOf(query.toLowerCase())
  if (at < 0) {
    return [name, '', '']
  }
  return [name.slice(0, at), name.slice(at, at + query.length), name.slice(at + query.length)]
}

export function trackSeconds(entry: Pick<Entry, 'track'>): { minutes: number; seconds: number } {
  const total = entry.track?.seconds ?? 0
  return { minutes: Math.floor(total / 60), seconds: total % 60 }
}

export function namesOf(files: readonly InspectedFile[], inspectionId: number): string[] {
  return files.filter(file => file.inspection_id === inspectionId).map(file => file.file_name)
}

type Wording = {
  duration: (length: { minutes: number; seconds: number }) => string
  items: (count: number) => string
}

export function notedOf(entry: Pick<Entry, 'kind' | 'track' | 'items'>, say: Wording): string {
  if (entry.kind === 'track') {
    return (entry.track?.seconds ?? 0) > 0 ? say.duration(trackSeconds(entry)) : ''
  }
  return entry.items > 0 ? say.items(entry.items) : ''
}

export function unreadState(files: readonly Pick<InspectedFile, 'stage'>[]): Unread {
  if (files.some(file => file.stage === 'checking')) {
    return 'reading'
  }
  if (files.some(file => file.stage === 'awaiting_volumes')) {
    return 'waiting'
  }
  const unreadable = files.every(file => file.stage === 'rejected' || file.stage === 'stalled')
  return files.length > 0 && unreadable ? 'failed' : 'unread'
}
