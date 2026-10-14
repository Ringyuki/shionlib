import type {
  FailureReason,
  OngoingUpload,
  Submission,
  SubmissionPhase,
  Upload,
  UploadPhase,
  UploadSession,
  UploadState,
  WaitReason,
} from './upload'
import { activeFiles, settled, unowned } from './upload'
import type { ErrorReport } from './upload-report'
import { syncState } from './upload-sync'

export type UploadEvent =
  | { type: 'added'; submission: Submission; uploads: Upload[] }
  | { type: 'restored'; state: UploadState }
  | { type: 'synced'; ongoing: readonly OngoingUpload[] }
  | { type: 'heldElsewhere'; upload: string }
  | { type: 'fileFound'; upload: string }
  | { type: 'started'; upload: string }
  | { type: 'sessionOpened'; upload: string; session: UploadSession; sent: number }
  | { type: 'progressed'; upload: string; sent: number; speed: number }
  | { type: 'waiting'; upload: string; reason: WaitReason }
  | { type: 'paused'; upload: string }
  | { type: 'resumed'; upload: string }
  | { type: 'finished'; upload: string }
  | { type: 'failed'; upload: string; reason: FailureReason; message?: string; error?: ErrorReport }
  | { type: 'removed'; upload: string }
  | { type: 'submission'; submission: string; phase: SubmissionPhase }
  | { type: 'dismissed'; submission: string }

export function reduce(state: UploadState, event: UploadEvent): UploadState {
  switch (event.type) {
    case 'added':
      return {
        submissions: [...state.submissions, event.submission],
        uploads: [...state.uploads, ...event.uploads],
      }
    case 'restored':
      return {
        submissions: [
          ...unknownTo(state.submissions, event.state.submissions),
          ...state.submissions,
        ],
        uploads: [...unknownTo(state.uploads, event.state.uploads), ...state.uploads],
      }
    case 'synced':
      return syncState(state, event.ongoing)
    case 'heldElsewhere':
      return update(state, event.upload, { phase: { name: 'heldElsewhere' }, speed: 0 })
    case 'fileFound':
    case 'resumed':
      return phase(state, event.upload, { name: 'queued' })
    case 'started':
      return phase(state, event.upload, { name: 'running' })
    case 'sessionOpened':
      return update(state, event.upload, { session: event.session, sent: event.sent })
    case 'progressed':
      return update(state, event.upload, { sent: event.sent, speed: event.speed })
    case 'waiting':
      return update(state, event.upload, {
        phase: { name: 'waiting', reason: event.reason },
        speed: 0,
      })
    case 'paused':
      return update(state, event.upload, { phase: { name: 'paused' }, speed: 0 })
    case 'finished':
      return finish(state, event.upload)
    case 'failed':
      return update(state, event.upload, {
        phase: { name: 'failed', reason: event.reason, message: event.message, error: event.error },
        speed: 0,
      })
    case 'removed':
      return remove(state, event.upload)
    case 'submission':
      return {
        ...state,
        submissions: state.submissions.map(submission =>
          submission.id === event.submission ? { ...submission, phase: event.phase } : submission,
        ),
      }
    case 'dismissed':
      return {
        submissions: state.submissions.filter(submission => submission.id !== event.submission),
        uploads: state.uploads.filter(upload => upload.submission !== event.submission),
      }
  }
}

export function nextToStart(state: UploadState, hasFile: (upload: string) => boolean): Upload[] {
  const running = state.uploads.filter(upload => upload.phase.name === 'running').length
  return state.uploads
    .filter(upload => upload.phase.name === 'queued' && hasFile(upload.id))
    .slice(0, Math.max(0, activeFiles - running))
}

export function readyToSubmit(state: UploadState): Submission[] {
  return state.submissions.filter(submission => {
    if (submission.phase.name !== 'uploading' || unowned(submission)) {
      return false
    }
    const uploads = uploadsOf(state, submission.id)
    return uploads.length > 0 && uploads.every(upload => upload.phase.name === 'done')
  })
}

export function uploadsOf(state: UploadState, submission: string): Upload[] {
  return state.uploads.filter(upload => upload.submission === submission)
}

export function findUpload(state: UploadState, id: string): Upload | undefined {
  return state.uploads.find(upload => upload.id === id)
}

export function busy(state: UploadState): boolean {
  return state.uploads.some(upload => !settled(upload))
}

function unknownTo<Entry extends { id: string }>(known: readonly Entry[], restored: Entry[]) {
  return restored.filter(entry => !known.some(current => current.id === entry.id))
}

function phase(state: UploadState, id: string, next: UploadPhase): UploadState {
  return update(state, id, { phase: next })
}

function update(state: UploadState, id: string, changes: Partial<Upload>): UploadState {
  return {
    ...state,
    uploads: state.uploads.map(upload => (upload.id === id ? { ...upload, ...changes } : upload)),
  }
}

function finish(state: UploadState, id: string): UploadState {
  const upload = findUpload(state, id)
  if (upload === undefined) {
    return state
  }
  return update(state, id, { phase: { name: 'done' }, sent: upload.file.size, speed: 0 })
}

function remove(state: UploadState, id: string): UploadState {
  const upload = findUpload(state, id)
  const uploads = state.uploads.filter(candidate => candidate.id !== id)
  const orphaned =
    upload !== undefined && !uploads.some(candidate => candidate.submission === upload.submission)
  return {
    uploads,
    submissions: orphaned
      ? state.submissions.filter(submission => submission.id !== upload.submission)
      : state.submissions,
  }
}
