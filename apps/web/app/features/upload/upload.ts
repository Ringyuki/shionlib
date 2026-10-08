import type { Schema } from '~/shared/api/types'

export type Allowance = Schema<'AllowanceDTO'>

export type OngoingUpload = Schema<'OngoingUploadDTO'>

type ResourceFields = Schema<'DownloadSourceBodyInput'>

export type ResourceDraft = {
  platform: NonNullable<ResourceFields['platform']>
  language: NonNullable<ResourceFields['language']>
  simulator?: ResourceFields['simulator']
  note?: ResourceFields['note']
}

export type UploadTarget =
  | { kind: 'create'; gameId: number; resource: ResourceDraft }
  | { kind: 'append'; resourceId: number }
  | { kind: 'replace'; fileId: number; reason?: string }
  | { kind: 'orphan' }
  | { kind: 'heldElsewhere' }

export type FileIdentity = { name: string; size: number; lastModified: number }

export type UploadSession = { id: number; chunkSize: number; totalChunks: number }

export type WaitReason = 'network' | 'busy' | 'inFlight' | 'signedOut' | 'otherTab'

export type FailureReason = 'differentFile' | 'changedFile' | 'expired' | 'rejected'

export type UploadPhase =
  | { name: 'queued' }
  | { name: 'needsFile' }
  | { name: 'running' }
  | { name: 'waiting'; reason: WaitReason }
  | { name: 'paused' }
  | { name: 'heldElsewhere' }
  | { name: 'done' }
  | { name: 'failed'; reason: FailureReason; message?: string }

export type Upload = {
  id: string
  submission: string
  file: FileIdentity
  name?: string
  session?: UploadSession
  sent: number
  speed: number
  phase: UploadPhase
}

export type SubmissionPhase =
  | { name: 'uploading' }
  | { name: 'submitting' }
  | { name: 'submitted' }
  | { name: 'failed'; message?: string }

export type Submission = { id: string; target: UploadTarget; label: string; phase: SubmissionPhase }

export type UploadState = { submissions: Submission[]; uploads: Upload[] }

export type Picture = { ongoing: OngoingUpload[]; renewEvery?: number }

export type Admission =
  | { kind: 'full' }
  | { kind: 'empty'; file: string }
  | { kind: 'tooLarge'; file: string; size: number; limit: number }
  | { kind: 'overQuota'; total: number; left: number }

export type QueueStatus = 'idle' | 'active' | 'attention' | 'finished'

export const activeFiles = 2

export const chunkSlots = 3

export const stallTimeout = 60_000

export const syncEvery = 30_000

export const renewalsPerHold = 4

export const emptyState: UploadState = { submissions: [], uploads: [] }

export const clientStorageKey = 'shionlib_upload_client'

export function uploadStorageKey(viewer: number): string {
  return `shionlib_uploads_${viewer}`
}

export function unowned(submission: Pick<Submission, 'target'>): boolean {
  return submission.target.kind === 'orphan' || submission.target.kind === 'heldElsewhere'
}

export function lockedElsewhere(submission: Submission, uploads: readonly Upload[]): boolean {
  return (
    submission.target.kind === 'heldElsewhere' ||
    uploads.some(upload => upload.phase.name === 'heldElsewhere')
  )
}

export function chosenFiles(value: File | File[] | null): File[] {
  return value === null ? [] : [value].flat()
}

export function identityOf(file: File): FileIdentity {
  return { name: file.name, size: file.size, lastModified: file.lastModified }
}

export function sameFile(file: FileIdentity, known: FileIdentity): boolean {
  const modified = known.lastModified === 0 || known.lastModified === file.lastModified
  return file.name === known.name && file.size === known.size && modified
}

export function matchFiles(uploads: readonly Upload[], chosen: readonly File[]) {
  const waiting = uploads.filter(upload => upload.phase.name === 'needsFile')
  const matches = new Map<string, File>()
  const unmatched = chosen.filter(file => {
    const identity = identityOf(file)
    const upload = waiting.find(
      candidate => !matches.has(candidate.id) && sameFile(identity, candidate.file),
    )
    if (upload !== undefined) {
      matches.set(upload.id, file)
      return false
    }
    return !uploads.some(candidate => sameFile(identity, candidate.file))
  })
  return { matches, unmatched }
}

export function remainingBytes(allowance: Allowance): number | null {
  if (allowance.stored_limit === null) {
    return null
  }
  return Math.max(0, allowance.stored_limit - allowance.stored - allowance.in_flight)
}

export function fileLimit(allowance: Allowance): number {
  return allowance.max_file_size === null
    ? allowance.in_flight_limit
    : Math.min(allowance.max_file_size, allowance.in_flight_limit)
}

export function admit(
  allowance: Allowance | undefined,
  files: readonly Pick<File, 'name' | 'size'>[],
): Admission | undefined {
  const left = allowance === undefined ? null : remainingBytes(allowance)
  if (left === 0) {
    return { kind: 'full' }
  }
  const empty = files.find(file => file.size === 0)
  if (empty !== undefined) {
    return { kind: 'empty', file: empty.name }
  }
  if (allowance === undefined) {
    return undefined
  }
  const limit = fileLimit(allowance)
  const large = files.find(file => file.size > limit)
  if (large !== undefined) {
    return { kind: 'tooLarge', file: large.name, size: large.size, limit }
  }
  const total = files.reduce((sum, file) => sum + file.size, 0)
  if (left !== null && total > left) {
    return { kind: 'overQuota', total, left }
  }
  return undefined
}

export function uploadedBytes(session: UploadSession, size: number, chunks: readonly number[]) {
  return chunks.reduce((sum, index) => sum + chunkLength(session, size, index), 0)
}

export function chunkLength(session: UploadSession, size: number, index: number): number {
  const start = index * session.chunkSize
  return Math.max(0, Math.min(session.chunkSize, size - start))
}

export function remainingSeconds(upload: Upload): number | undefined {
  if (upload.speed <= 0) {
    return undefined
  }
  return Math.ceil((upload.file.size - upload.sent) / upload.speed)
}

export function pausable(upload: Upload): boolean {
  const { name } = upload.phase
  return name === 'running' || name === 'queued' || name === 'waiting'
}

export function progress(upload: Upload): number {
  return upload.file.size === 0 ? 0 : (upload.sent / upload.file.size) * 100
}

export function unsubmitted(state: UploadState): Submission[] {
  return state.submissions.filter(submission => submission.phase.name !== 'submitted')
}

export function submitted(state: UploadState): Submission[] {
  return state.submissions.filter(submission => submission.phase.name === 'submitted')
}

export function settled(upload: Upload): boolean {
  return upload.phase.name === 'done' || upload.phase.name === 'failed'
}

export function totals(uploads: readonly Upload[]) {
  const active = uploads.filter(upload => upload.phase.name !== 'failed')
  const size = active.reduce((sum, upload) => sum + upload.file.size, 0)
  const sent = active.reduce((sum, upload) => sum + upload.sent, 0)
  return { size, sent, ratio: size === 0 ? 0 : sent / size }
}

export function queueStatus(state: UploadState): QueueStatus {
  if (state.submissions.length === 0) {
    return 'idle'
  }
  const attention =
    state.uploads.some(
      upload => upload.phase.name === 'needsFile' || upload.phase.name === 'failed',
    ) ||
    state.submissions.some(
      submission => submission.phase.name === 'failed' || submission.target.kind === 'orphan',
    )
  if (attention) {
    return 'attention'
  }
  const active = state.submissions.some(
    submission => submission.phase.name === 'uploading' || submission.phase.name === 'submitting',
  )
  return active ? 'active' : 'finished'
}
