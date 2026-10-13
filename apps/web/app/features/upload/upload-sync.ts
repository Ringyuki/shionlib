import type { OngoingUpload, Submission, Upload, UploadPhase, UploadState } from './upload'
import { unowned, unsubmitted, uploadedBytes } from './upload'

export const orphanSubmission = 'orphans'

export const elsewhereSubmission = 'heldElsewhere'

const unownedSubmissions: Submission[] = [
  { id: orphanSubmission, target: { kind: 'orphan' }, label: '', phase: { name: 'uploading' } },
  {
    id: elsewhereSubmission,
    target: { kind: 'heldElsewhere' },
    label: '',
    phase: { name: 'uploading' },
  },
]

const drivenHere: readonly UploadPhase['name'][] = [
  'queued',
  'running',
  'waiting',
  'paused',
  'failed',
]

export function heldSessions(state: UploadState, hasFile: (upload: string) => boolean): number[] {
  const queued = new Set(
    unsubmitted(state)
      .filter(submission => !unowned(submission))
      .map(submission => submission.id),
  )
  return state.uploads.flatMap(upload => {
    const wanted = queued.has(upload.submission)
      ? upload.phase.name !== 'failed'
      : hasFile(upload.id)
    return upload.session !== undefined && wanted ? [upload.session.id] : []
  })
}

export function syncState(state: UploadState, ongoing: readonly OngoingUpload[]): UploadState {
  const live = new Map(ongoing.map(session => [session.upload_session_id, session]))
  const queued = state.submissions.filter(submission => !unowned(submission))
  const own = state.uploads.filter(upload =>
    queued.some(submission => submission.id === upload.submission),
  )
  const claimed = new Set(own.flatMap(upload => upload.session?.id ?? []))
  const known = new Map(
    state.uploads.flatMap(upload =>
      upload.session === undefined || own.includes(upload) ? [] : [[upload.session.id, upload]],
    ),
  )
  const others = ongoing
    .filter(session => !claimed.has(session.upload_session_id))
    .map(session => unownedUpload(session, known.get(session.upload_session_id)))
  return {
    submissions: [
      ...queued,
      ...unownedSubmissions.filter(submission =>
        others.some(upload => upload.submission === submission.id),
      ),
    ],
    uploads: [...own.map(upload => ownUpload(upload, live)), ...others],
  }
}

function ownUpload(upload: Upload, live: ReadonlyMap<number, OngoingUpload>): Upload {
  const server = upload.session === undefined ? undefined : live.get(upload.session.id)
  const { name } = upload.phase
  if (upload.session === undefined || server === undefined || name === 'failed') {
    return upload
  }
  const idle = name === 'heldElsewhere' || name === 'needsFile'
  if (server.status === 'COMPLETED') {
    return idle ? { ...upload, sent: upload.file.size, speed: 0, phase: { name: 'done' } } : upload
  }
  const sent = uploadedBytes(upload.session, upload.file.size, server.uploaded_chunks ?? [])
  if (server.held_elsewhere) {
    return { ...upload, sent, speed: 0, phase: { name: 'heldElsewhere' } }
  }
  return name === 'heldElsewhere' ? { ...upload, sent, phase: { name: 'needsFile' } } : upload
}

function unownedUpload(session: OngoingUpload, known: Upload | undefined): Upload {
  const file = { name: session.file_name, size: session.total_size, lastModified: 0 }
  const uploadSession = {
    id: session.upload_session_id,
    chunkSize: session.chunk_size,
    totalChunks: session.total_chunks,
  }
  const finished = session.status === 'COMPLETED'
  const idle: UploadPhase = finished ? { name: 'done' } : { name: 'needsFile' }
  const base = {
    id: `session-${session.upload_session_id}`,
    file,
    session: uploadSession,
    sent: finished
      ? file.size
      : uploadedBytes(uploadSession, file.size, session.uploaded_chunks ?? []),
    speed: 0,
  }
  if (session.held_elsewhere) {
    return {
      ...base,
      submission: elsewhereSubmission,
      phase: finished ? idle : { name: 'heldElsewhere' },
    }
  }
  if (known !== undefined && drivenHere.includes(known.phase.name)) {
    return { ...known, submission: orphanSubmission }
  }
  return { ...base, submission: orphanSubmission, phase: idle }
}
