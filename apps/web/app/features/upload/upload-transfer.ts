import type { ApiClient } from '~/shared/api/client'
import type { ChunkUpload } from '~/shared/api/chunk'
import { FileHasher, type HashWorker } from './file-hasher'
import type { Upload, UploadSession } from './upload'
import { uploadedBytes } from './upload'
import { retrying, type Waiting } from './upload-failure'
import { UploadRunner, type RunnerEvent } from './upload-runner'
import type { Slots } from './upload-slots'
import type { UploadEvent } from './upload-state'
import { completeSession, openSession, uploadedChunks } from './upload.use-cases'
import type { SavedState } from './upload.schema'

export type UploadDeps = {
  api: ApiClient
  send: (upload: ChunkUpload) => Promise<unknown>
  hashWorker: () => HashWorker
  storage: { read: () => SavedState; write: (state: SavedState) => void }
  lock: (name: string, task: () => Promise<void>) => Promise<boolean>
  later: (task: () => void, milliseconds: number) => void
  now: () => number
  random: () => number
  newId: () => string
}

export type TransferContext = {
  deps: UploadDeps
  slots: Slots
  hashers: Map<string, FileHasher>
  dispatch: (event: UploadEvent) => void
}

export async function transfer(
  context: TransferContext,
  upload: Upload,
  file: File,
  signal: AbortSignal,
): Promise<boolean> {
  const { deps, dispatch } = context
  const waiting = waitingFor(context, upload.id)
  const fresh = upload.session === undefined
  const session =
    upload.session ?? (await retrying(signal, () => openSession(deps.api, upload.file), waiting))
  if (fresh) {
    dispatch({ type: 'sessionOpened', upload: upload.id, session, sent: 0 })
  }
  return deps.lock(`shionlib-upload-${session.id}`, async () => {
    const stored = fresh
      ? []
      : await retrying(signal, () => uploadedChunks(deps.api, session.id), waiting)
    const sent = uploadedBytes(session, file.size, stored)
    dispatch({ type: 'sessionOpened', upload: upload.id, session, sent })
    const runner = new UploadRunner({
      file,
      session,
      stored: new Set(stored),
      hasher: hasherFor(context, upload.id, file, session),
      slots: context.slots,
      send: deps.send,
      complete: digest => completeSession(deps.api, session.id, digest),
      report: event => dispatch(eventOf(upload.id, event)),
      now: deps.now,
      random: deps.random,
    })
    await runner.run(signal)
  })
}

function hasherFor(context: TransferContext, id: string, file: File, session: UploadSession) {
  const known = context.hashers.get(id)
  if (known !== undefined) {
    return known
  }
  const hasher = new FileHasher(context.deps.hashWorker(), file, session.chunkSize)
  context.hashers.set(id, hasher)
  return hasher
}

function waitingFor(context: TransferContext, upload: string): Waiting {
  return {
    wait: reason => context.dispatch({ type: 'waiting', upload, reason }),
    resume: () => context.dispatch({ type: 'started', upload }),
    random: context.deps.random,
  }
}

function eventOf(upload: string, event: RunnerEvent): UploadEvent {
  switch (event.type) {
    case 'progress':
      return { type: 'progressed', upload, sent: event.sent, speed: event.speed }
    case 'waiting':
      return { type: 'waiting', upload, reason: event.reason }
    case 'running':
      return { type: 'started', upload }
  }
}
