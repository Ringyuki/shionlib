import { ApiError } from '~/shared/api/error'
import type { SubmissionPhase, UploadTarget } from './upload'
import { identityOf, matchFiles, syncEvery } from './upload'
import { stopped } from './upload-failure'
import { describeError, submissionReport } from './upload-report'
import { UploadRuns } from './upload-runs'
import { findUpload, nextToStart, readyToSubmit, uploadsOf, type UploadEvent } from './upload-state'
import { UploadStore } from './upload-store'
import { heldSessions } from './upload-sync'
import { sendReport, type UploadDeps } from './upload-transfer'
import { discardSession, restoreUploads, submitUploads, syncSessions } from './upload.use-cases'

export type PickedFile = { file: File; name?: string }

export class UploadManager {
  private readonly deps: UploadDeps
  private readonly store: UploadStore
  private readonly runs: UploadRuns
  private readonly gone = new Set<number>()
  private lifetime = new AbortController()
  private pace = syncEvery

  constructor(deps: UploadDeps) {
    this.deps = deps
    this.store = new UploadStore(deps.storage.write)
    this.runs = new UploadRuns(deps, {
      state: () => this.state,
      dispatch: event => this.dispatch(event),
      advance: () => this.advance(),
      discard: upload => this.discard(upload),
    })
  }

  subscribe = (listener: () => void) => this.store.subscribe(listener)

  getSnapshot = () => this.store.getSnapshot()

  async start() {
    const lifetime = new AbortController()
    this.lifetime = lifetime
    const { api, client, random, storage } = this.deps
    const restored = await restoreUploads(api, client, storage.read(), lifetime.signal, random)
    if (restored !== undefined && !lifetime.signal.aborted) {
      this.pace = restored.renewEvery ?? this.pace
      this.dispatch({ type: 'restored', state: restored.state })
      this.advance()
    }
    this.keepInSync(lifetime.signal)
  }

  dispose() {
    this.lifetime.abort(stopped())
    this.runs.dispose()
  }

  add(target: UploadTarget, label: string, picks: readonly PickedFile[]): string {
    const submission = this.deps.newId()
    const uploads = picks.map(pick => {
      const id = this.deps.newId()
      this.runs.keep(id, pick.file)
      const file = identityOf(pick.file)
      return {
        id,
        submission,
        file,
        name: pick.name,
        sent: 0,
        speed: 0,
        phase: { name: 'queued' } as const,
      }
    })
    this.dispatch({
      type: 'added',
      submission: { id: submission, target, label, phase: { name: 'uploading' } },
      uploads,
    })
    this.advance()
    return submission
  }

  attach(chosen: readonly File[]): File[] {
    const { matches, unmatched } = matchFiles(this.state.uploads, chosen)
    matches.forEach((file, upload) => {
      this.runs.keep(upload, file)
      this.dispatch({ type: 'fileFound', upload })
    })
    this.advance()
    return unmatched
  }

  pause(id: string) {
    this.runs.stop(id)
    this.dispatch({ type: 'paused', upload: id })
  }

  resume(id: string) {
    this.dispatch({ type: 'resumed', upload: id })
    this.advance()
  }

  cancel(id: string) {
    this.runs.stop(id)
    this.runs.forget(id)
    this.discard(id)
    this.dispatch({ type: 'removed', upload: id })
    this.advance()
  }

  dismiss(submission: string) {
    const entry = this.state.submissions.find(candidate => candidate.id === submission)
    for (const upload of uploadsOf(this.state, submission)) {
      if (entry?.phase.name === 'submitted') {
        this.runs.forget(upload.id)
      } else {
        this.cancel(upload.id)
      }
    }
    this.dispatch({ type: 'dismissed', submission })
  }

  retrySubmission(submission: string) {
    this.dispatch({ type: 'submission', submission, phase: { name: 'uploading' } })
    this.advance()
  }

  private keepInSync(signal: AbortSignal) {
    this.deps.later(() => {
      if (!signal.aborted) {
        void this.sync(signal).finally(() => this.keepInSync(signal))
      }
    }, this.pace)
  }

  private async sync(signal: AbortSignal) {
    if (this.state.submissions.length === 0) {
      return
    }
    const held = heldSessions(this.state, this.runs.hasFile)
    const picture = await syncSessions(this.deps.api, this.deps.client, held).catch(() => undefined)
    if (picture === undefined || signal.aborted) {
      return
    }
    this.pace = picture.renewEvery ?? this.pace
    const ongoing = picture.ongoing.filter(session => !this.gone.has(session.upload_session_id))
    this.dispatch({ type: 'synced', ongoing })
    this.runs.settle()
    this.advance()
  }

  private advance() {
    for (const upload of nextToStart(this.state, this.runs.hasFile)) {
      void this.runs.run(upload.id)
    }
    for (const submission of readyToSubmit(this.state)) {
      void this.submit(submission.id)
    }
  }

  private discard(id: string) {
    const session = findUpload(this.state, id)?.session
    if (session !== undefined) {
      this.gone.add(session.id)
      void discardSession(this.deps.api, this.deps.client, session.id).catch(() => undefined)
    }
  }

  private async submit(submission: string) {
    const entry = this.state.submissions.find(candidate => candidate.id === submission)
    if (entry === undefined) {
      return
    }
    this.dispatch({ type: 'submission', submission, phase: { name: 'submitting' } })
    try {
      const uploads = uploadsOf(this.state, submission)
      await submitUploads(this.deps.api, entry.target, uploads)
      uploads.forEach(upload => upload.session !== undefined && this.gone.add(upload.session.id))
      this.dispatch({ type: 'submission', submission, phase: { name: 'submitted' } })
    } catch (error) {
      const message = error instanceof ApiError && error.message !== '' ? error.message : undefined
      const phase: SubmissionPhase = { name: 'failed', message, error: describeError(error) }
      this.dispatch({ type: 'submission', submission, phase })
      sendReport(this.deps, submissionReport(entry.label, uploadsOf(this.state, submission), error))
    }
  }

  private dispatch(event: UploadEvent) {
    this.store.dispatch(event)
  }

  private get state() {
    return this.store.getSnapshot()
  }
}
