import { createHash } from 'crypto'

export type FieldSyncCandidateAction = 'add' | 'update' | 'remove' | 'unmatched'
export type FieldSyncCandidateSource = 'bangumi' | 'vndb' | 'merged'
export type FieldSyncCandidateConfidence = 'exact' | 'high' | 'medium' | 'low'

export interface FieldSyncCandidate {
  id: string
  action: FieldSyncCandidateAction
  source: FieldSyncCandidateSource
  title: string
  subtitle?: string
  confidence: FieldSyncCandidateConfidence
  defaultSelected: boolean
  applicable: boolean
  local?: Record<string, any>
  remote?: Record<string, any>
  warnings?: string[]
}

export interface InternalFieldSyncCandidate extends FieldSyncCandidate {
  apply?: Record<string, any>
}

type CandidateInput = Omit<FieldSyncCandidate, 'id' | 'action' | 'applicable'> &
  Partial<Pick<FieldSyncCandidate, 'applicable'>> & { apply?: Record<string, any> }

export const createFieldSyncCandidate = (
  field: string,
  action: FieldSyncCandidateAction,
  key: string,
  candidate: CandidateInput,
): InternalFieldSyncCandidate => ({
  id: fieldSyncCandidateId(field, action, key),
  action,
  applicable: candidate.applicable ?? true,
  ...candidate,
})

export const createFieldSyncPreview = (
  field: string,
  candidates: InternalFieldSyncCandidate[],
) => ({
  field,
  generatedAt: new Date().toISOString(),
  summary: {
    total: candidates.length,
    add: candidates.filter(c => c.action === 'add').length,
    update: candidates.filter(c => c.action === 'update').length,
    unmatched: candidates.filter(c => c.action === 'unmatched').length,
    defaultSelected: candidates.filter(c => c.defaultSelected && c.applicable).length,
  },
  candidates: candidates.map(candidate => {
    const publicCandidate = { ...candidate }
    delete publicCandidate.apply
    return publicCandidate
  }),
})

export const createScalarGroupCandidate = (
  entityId: number,
  field: string,
  source: FieldSyncCandidateSource,
  options: {
    local: Record<string, any>
    remote: Record<string, any>
    title: string
    skipEmptyRemote?: boolean
  },
): InternalFieldSyncCandidate[] => {
  const remote = pickDefined(options.remote)
  if (options.skipEmptyRemote && Object.values(remote).every(value => isEmptyValue(value))) {
    return []
  }
  if (Object.keys(remote).length === 0) return []

  const local = pickDefined(
    Object.fromEntries(Object.keys(remote).map(key => [key, options.local[key]])),
  )
  if (stableEqual(local, remote)) return []

  return [
    createFieldSyncCandidate(field, 'update', `${entityId}:${field}:${hashValue(remote)}`, {
      source,
      title: options.title,
      subtitle: 'Scalar field group',
      confidence: 'exact',
      defaultSelected: Object.values(local).every(value => isEmptyValue(value)),
      local,
      remote,
      apply: { scalar: remote },
    }),
  ]
}

export const pickDefined = <T extends Record<string, any>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>

export const pickNonEmpty = <T extends Record<string, any>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => !isEmptyValue(item))) as Partial<T>

export const isEmptyValue = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0)

export const stableEqual = (a: unknown, b: unknown) =>
  JSON.stringify(sortJson(a)) === JSON.stringify(sortJson(b))

export const uniqueStrings = (values: Array<string | null | undefined>) => [
  ...new Set(values.map(value => value?.trim()).filter(Boolean) as string[]),
]

const fieldSyncCandidateId = (field: string, action: FieldSyncCandidateAction, key: string) =>
  `${field}:${action}:${hashValue(key)}`

const hashValue = (value: unknown) =>
  createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16)

const sortJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(item => sortJson(item))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortJson(item)]),
  )
}
