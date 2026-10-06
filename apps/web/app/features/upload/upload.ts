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

export type FileIdentity = { name: string; size: number; lastModified: number }

export type UploadSession = { id: number; chunkSize: number; totalChunks: number }

export type WaitReason = 'network' | 'busy' | 'signedOut' | 'elsewhere'

export type FailureReason = 'differentFile' | 'changedFile' | 'expired' | 'rejected'

export type UploadPhase =
  | { name: 'queued' }
  | { name: 'needsFile' }
  | { name: 'running' }
  | { name: 'waiting'; reason: WaitReason }
  | { name: 'paused' }
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

export type Submission = { id: string; target: UploadTarget; phase: SubmissionPhase }

export type UploadState = { submissions: Submission[]; uploads: Upload[] }

export type Admission = 'empty' | 'tooLarge' | 'overQuota' | undefined

export const activeFiles = 2

export const chunkSlots = 3

export const stallTimeout = 60_000

export const emptyState: UploadState = { submissions: [], uploads: [] }

export function uploadStorageKey(viewer: number): string {
  return `shionlib_uploads_${viewer}`
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
    const upload = waiting.find(
      candidate => !matches.has(candidate.id) && sameFile(identityOf(file), candidate.file),
    )
    if (upload !== undefined) {
      matches.set(upload.id, file)
    }
    return upload === undefined
  })
  return { matches, unmatched }
}

export function admit(allowance: Allowance, sizes: readonly number[]): Admission {
  if (sizes.some(size => size === 0)) {
    return 'empty'
  }
  const largest = Math.max(...sizes)
  if (allowance.max_file_size !== null && largest > allowance.max_file_size) {
    return 'tooLarge'
  }
  const total = sizes.reduce((sum, size) => sum + size, 0)
  if (
    allowance.stored_limit !== null &&
    allowance.stored + allowance.in_flight + total > allowance.stored_limit
  ) {
    return 'overQuota'
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

export function settled(upload: Upload): boolean {
  return upload.phase.name === 'done' || upload.phase.name === 'failed'
}

export function totals(uploads: readonly Upload[]) {
  const active = uploads.filter(upload => upload.phase.name !== 'failed')
  const size = active.reduce((sum, upload) => sum + upload.file.size, 0)
  const sent = active.reduce((sum, upload) => sum + upload.sent, 0)
  return { size, sent, ratio: size === 0 ? 0 : sent / size }
}
