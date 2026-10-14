import type { ApiClient } from '~/shared/api/client'
import type { ChunkUpload } from '~/shared/api/chunk'
import { FileHasher, type HashWorker } from './file-hasher'
import type { Upload, UploadSession, WaitReason } from './upload'
import { uploadedBytes } from './upload'
import { locate, retrying, type Waiting } from './upload-failure'
import { remembered, type FailureAttempt, type FailureReport } from './upload-report'
import { UploadRunner, type RunnerEvent } from './upload-runner'
import type { Slots } from './upload-slots'
import type { UploadEvent } from './upload-state'
import { completeSession, openSession, reportFailure, uploadedChunks } from './upload.use-cases'
import type { SavedState } from './upload.schema'

export type UploadDeps = {
  api: ApiClient
  client: string
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
  attempts: Map<string, FailureAttempt[]>
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
    upload.session ??
    (await retrying(signal, () => openSession(deps.api, deps.client, upload.file), waiting).catch(
      (error: unknown) => {
        throw locate(error, 'open')
      },
    ))
  if (fresh) {
    dispatch({ type: 'sessionOpened', upload: upload.id, session, sent: 0 })
  }
  return deps.lock(`shionlib-upload-${session.id}`, async () => {
    const stored = fresh
      ? []
      : await retrying(signal, () => uploadedChunks(deps.api, session.id), waiting).catch(
          (error: unknown) => {
            throw locate(error, 'open')
          },
        )
    const sent = uploadedBytes(session, file.size, stored)
    dispatch({ type: 'sessionOpened', upload: upload.id, session, sent })
    const runner = new UploadRunner({
      file,
      session,
      stored: new Set(stored),
      hasher: hasherFor(context, upload.id, file, session),
      slots: context.slots,
      client: deps.client,
      send: deps.send,
      complete: digest => completeSession(deps.api, deps.client, session.id, digest),
      report: event => {
        if (event.type === 'waiting') {
          note(context, upload.id, event.reason, event.error)
        }
        dispatch(eventOf(upload.id, event))
      },
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

function note(context: TransferContext, upload: string, reason: WaitReason, error: unknown) {
  const known = context.attempts.get(upload) ?? []
  context.attempts.set(upload, remembered(known, reason, error, context.deps.now()))
}

function waitingFor(context: TransferContext, upload: string): Waiting {
  return {
    wait: (reason, error) => {
      note(context, upload, reason, error)
      context.dispatch({ type: 'waiting', upload, reason })
    },
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

const reportTries = 3

const reportDelay = 5_000

export function sendReport(deps: UploadDeps, report: FailureReport, tries = 0) {
  reportFailure(deps.api, deps.client, report).catch(() => {
    if (tries + 1 < reportTries) {
      deps.later(() => sendReport(deps, report, tries + 1), reportDelay * 2 ** tries)
    }
  })
}
