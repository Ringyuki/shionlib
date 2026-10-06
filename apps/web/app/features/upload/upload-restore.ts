import type { OngoingUpload, Submission, Upload, UploadState } from './upload'
import { uploadedBytes } from './upload'
import type { SavedState } from './upload.schema'

export const orphanSubmission = 'orphans'

export function savedStateOf(state: UploadState): SavedState {
  const submissions = state.submissions.filter(
    submission => submission.phase.name !== 'submitted' && submission.target.kind !== 'orphan',
  )
  const kept = new Set(submissions.map(submission => submission.id))
  return {
    submissions: submissions.map(submission => ({
      id: submission.id,
      target: submission.target,
      submitting: submission.phase.name === 'submitting',
    })),
    uploads: state.uploads
      .filter(upload => kept.has(upload.submission) && upload.phase.name !== 'failed')
      .map(upload => ({
        id: upload.id,
        submission: upload.submission,
        file: upload.file,
        name: upload.name,
        session: upload.session,
        done: upload.phase.name === 'done',
      })),
  }
}

export function restoreState(saved: SavedState, ongoing: readonly OngoingUpload[]): UploadState {
  const live = new Map(ongoing.map(session => [session.upload_session_id, session]))
  const claimed = new Set(saved.uploads.flatMap(upload => upload.session?.id ?? []))
  const submitting = new Set(
    saved.submissions.filter(submission => submission.submitting).map(submission => submission.id),
  )
  const uploads = saved.uploads.map(upload =>
    restoreUpload(upload, live, submitting.has(upload.submission)),
  )
  const submissions: Submission[] = saved.submissions.map(submission => {
    const own = saved.uploads.filter(upload => upload.submission === submission.id)
    const consumed = own.every(
      upload => upload.session !== undefined && !live.has(upload.session.id),
    )
    return {
      id: submission.id,
      target: submission.target,
      phase: submission.submitting && consumed ? { name: 'submitted' } : { name: 'uploading' },
    }
  })
  const orphans = ongoing.filter(session => !claimed.has(session.upload_session_id)).map(orphanOf)
  if (orphans.length > 0) {
    submissions.push({
      id: orphanSubmission,
      target: { kind: 'orphan' },
      phase: { name: 'uploading' },
    })
  }
  return { submissions, uploads: [...uploads, ...orphans] }
}

function restoreUpload(
  upload: SavedState['uploads'][number],
  live: Map<number, OngoingUpload>,
  submitting: boolean,
): Upload {
  const base = {
    id: upload.id,
    submission: upload.submission,
    file: upload.file,
    name: upload.name,
    session: upload.session,
    sent: 0,
    speed: 0,
  }
  if (upload.session === undefined) {
    return { ...base, phase: { name: 'needsFile' } }
  }
  const server = live.get(upload.session.id)
  if (server === undefined) {
    return upload.done && submitting
      ? { ...base, sent: upload.file.size, phase: { name: 'done' } }
      : { ...base, phase: { name: 'failed', reason: 'expired' } }
  }
  if (server.status === 'COMPLETED') {
    return { ...base, sent: upload.file.size, phase: { name: 'done' } }
  }
  const sent = uploadedBytes(upload.session, upload.file.size, server.uploaded_chunks ?? [])
  return { ...base, sent, phase: { name: 'needsFile' } }
}

function orphanOf(session: OngoingUpload): Upload {
  const file = { name: session.file_name, size: session.total_size, lastModified: 0 }
  const uploadSession = {
    id: session.upload_session_id,
    chunkSize: session.chunk_size,
    totalChunks: session.total_chunks,
  }
  const finished = session.status === 'COMPLETED'
  return {
    id: `session-${session.upload_session_id}`,
    submission: orphanSubmission,
    file,
    session: uploadSession,
    sent: finished
      ? file.size
      : uploadedBytes(uploadSession, file.size, session.uploaded_chunks ?? []),
    speed: 0,
    phase: finished ? { name: 'done' } : { name: 'needsFile' },
  }
}
