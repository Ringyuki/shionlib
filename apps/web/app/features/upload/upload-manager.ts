import { ApiError } from '~/shared/api/error'
import type { FileHasher } from './file-hasher'
import type { UploadTarget } from './upload'
import { chunkSlots, identityOf, matchFiles } from './upload'
import { failureOf, spoilsSession, stopped } from './upload-failure'
import { Slots } from './upload-slots'
import { findUpload, nextToStart, readyToSubmit, uploadsOf, type UploadEvent } from './upload-state'
import { UploadStore } from './upload-store'
import { transfer, type TransferContext, type UploadDeps } from './upload-transfer'
import { discardSession, restoreUploads, submitUploads } from './upload.use-cases'

export type PickedFile = { file: File; name?: string }

const elsewhereDelay = 30_000

export class UploadManager {
  private readonly deps: UploadDeps
  private readonly store: UploadStore
  private readonly context: TransferContext
  private readonly files = new Map<string, File>()
  private readonly running = new Map<string, AbortController>()
  private readonly hashers = new Map<string, FileHasher>()
  private lifetime = new AbortController()

  constructor(deps: UploadDeps) {
    this.deps = deps
    this.store = new UploadStore(deps.storage.write)
    this.context = {
      deps,
      slots: new Slots(chunkSlots),
      hashers: this.hashers,
      dispatch: event => this.dispatch(event),
    }
  }

  subscribe = (listener: () => void) => this.store.subscribe(listener)

  getSnapshot = () => this.store.getSnapshot()

  async start() {
    const lifetime = new AbortController()
    this.lifetime = lifetime
    const saved = this.deps.storage.read()
    const restored = await restoreUploads(this.deps.api, saved, lifetime.signal, this.deps.random)
    if (restored !== undefined && !lifetime.signal.aborted) {
      this.dispatch({ type: 'restored', state: restored })
      this.advance()
    }
  }

  dispose() {
    this.lifetime.abort(stopped())
    this.running.forEach(controller => controller.abort(stopped()))
    this.running.clear()
    this.hashers.forEach(hasher => hasher.dispose())
    this.hashers.clear()
  }

  add(target: UploadTarget, label: string, picks: readonly PickedFile[]): string {
    const submission = this.deps.newId()
    const uploads = picks.map(pick => {
      const id = this.deps.newId()
      this.files.set(id, pick.file)
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
      this.files.set(upload, file)
      this.dispatch({ type: 'fileFound', upload })
    })
    this.advance()
    return unmatched
  }

  pause(id: string) {
    this.running.get(id)?.abort(stopped())
    this.dispatch({ type: 'paused', upload: id })
  }

  resume(id: string) {
    this.dispatch({ type: 'resumed', upload: id })
    this.advance()
  }

  cancel(id: string) {
    this.running.get(id)?.abort(stopped())
    this.forget(id)
    this.discard(id)
    this.dispatch({ type: 'removed', upload: id })
    this.advance()
  }

  dismiss(submission: string) {
    const entry = this.state.submissions.find(candidate => candidate.id === submission)
    for (const upload of uploadsOf(this.state, submission)) {
      if (entry?.phase.name === 'submitted') {
        this.forget(upload.id)
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

  private advance() {
    for (const upload of nextToStart(this.state, id => this.files.has(id))) {
      void this.run(upload.id)
    }
    for (const submission of readyToSubmit(this.state)) {
      void this.submit(submission.id)
    }
  }

  private async run(id: string) {
    const upload = findUpload(this.state, id)
    const file = this.files.get(id)
    if (upload === undefined || file === undefined) {
      return
    }
    const controller = new AbortController()
    this.running.set(id, controller)
    this.dispatch({ type: 'started', upload: id })
    try {
      if (await transfer(this.context, upload, file, controller.signal)) {
        this.forget(id)
        this.dispatch({ type: 'finished', upload: id })
      } else {
        this.dispatch({ type: 'waiting', upload: id, reason: 'elsewhere' })
        this.deps.later(() => this.retryElsewhere(id), elsewhereDelay)
      }
    } catch (error) {
      this.fail(id, error)
    } finally {
      this.running.delete(id)
      this.advance()
    }
  }

  private retryElsewhere(id: string) {
    const phase = findUpload(this.state, id)?.phase
    if (phase?.name === 'waiting' && phase.reason === 'elsewhere') {
      this.resume(id)
    }
  }

  private fail(id: string, error: unknown) {
    const failure = failureOf(error)
    if (failure === undefined) {
      return
    }
    if (spoilsSession(failure)) {
      this.discard(id)
    }
    this.forget(id)
    this.dispatch({ type: 'failed', upload: id, reason: failure.reason, message: failure.detail })
  }

  private discard(id: string) {
    const session = findUpload(this.state, id)?.session
    if (session !== undefined) {
      void discardSession(this.deps.api, session.id).catch(() => undefined)
    }
  }

  private async submit(submission: string) {
    const entry = this.state.submissions.find(candidate => candidate.id === submission)
    if (entry === undefined) {
      return
    }
    this.dispatch({ type: 'submission', submission, phase: { name: 'submitting' } })
    try {
      await submitUploads(this.deps.api, entry.target, uploadsOf(this.state, submission))
      this.dispatch({ type: 'submission', submission, phase: { name: 'submitted' } })
    } catch (error) {
      const message = error instanceof ApiError ? error.message : undefined
      this.dispatch({ type: 'submission', submission, phase: { name: 'failed', message } })
    }
  }

  private forget(id: string) {
    this.files.delete(id)
    this.hashers.get(id)?.dispose()
    this.hashers.delete(id)
  }

  private dispatch(event: UploadEvent) {
    this.store.dispatch(event)
  }

  private get state() {
    return this.store.getSnapshot()
  }
}
