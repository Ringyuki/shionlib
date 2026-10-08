import type { OngoingUpload, Submission, Upload, UploadState } from './upload'
import { unowned, uploadedBytes } from './upload'
import { syncState } from './upload-sync'
import type { SavedState } from './upload.schema'

export function savedStateOf(state: UploadState): SavedState {
  const submissions = state.submissions.filter(
    submission => submission.phase.name !== 'submitted' && !unowned(submission),
  )
  const kept = new Set(submissions.map(submission => submission.id))
  return {
    submissions: submissions.map(submission => ({
      id: submission.id,
      target: submission.target,
      label: submission.label,
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

export function savedSessions(saved: SavedState): number[] {
  return saved.uploads.flatMap(upload => upload.session?.id ?? [])
}

export function restoreState(saved: SavedState, ongoing: readonly OngoingUpload[]): UploadState {
  const live = new Map(ongoing.map(session => [session.upload_session_id, session]))
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
      label: submission.label,
      phase: submission.submitting && consumed ? { name: 'submitted' } : { name: 'uploading' },
    }
  })
  return syncState({ submissions, uploads }, ongoing)
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
