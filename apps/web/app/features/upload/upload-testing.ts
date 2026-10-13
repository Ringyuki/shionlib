import type { ChunkUpload } from '~/shared/api/chunk'
import { createApi } from '~/shared/api/client'
import type { HashWorker } from './file-hasher'
import type { OngoingUpload } from './upload'
import { hashFile } from './upload-hash'
import { UploadManager } from './upload-manager'
import type { UploadDeps } from './upload-transfer'
import type { SavedState } from './upload.schema'

type Call = { method: string; path: string; body: unknown; client: string | null }

const sizeOf = (body: unknown) =>
  typeof body === 'object' &&
  body !== null &&
  'total_size' in body &&
  typeof body.total_size === 'number'
    ? body.total_size
    : 0

export function fakeServer(ongoing: OngoingUpload[] = []) {
  const calls: Call[] = []
  let next = 1
  const reply = (data: unknown) => Response.json({ code: 0, message: 'ok', data })
  const api = createApi({
    baseUrl: 'http://api.test',
    fetch: async sent => {
      const path = new URL(sent.url).pathname
      const body: unknown = sent.body === null ? undefined : await sent.json()
      calls.push({
        method: sent.method,
        path,
        body,
        client: sent.headers.get('X-Upload-Client'),
      })
      if (path === '/uploads/large/ongoing') return reply(ongoing)
      if (path === '/uploads/large/hold') return reply({ held: [], elsewhere: [], ttl_seconds: 80 })
      if (path === '/uploads/large/init') {
        const size = sizeOf(body)
        return reply({
          upload_session_id: next++,
          chunk_size: 4,
          total_chunks: Math.ceil(size / 4),
          expires_at: '',
        })
      }
      if (path.endsWith('/status')) {
        const known = ongoing.find(
          session => path === `/uploads/large/${session.upload_session_id}/status`,
        )
        return reply({
          status: 'UPLOADING',
          uploaded_chunks: known?.uploaded_chunks ?? [],
          file_sha256: null,
        })
      }
      if (path === '/game/3/download-source') return reply({ id: 99 })
      return reply(path.endsWith('/complete') ? { ok: true } : null)
    },
  })
  return {
    api,
    calls,
    called: (method: string, path: string) =>
      calls.find(call => call.method === method && call.path === path),
  }
}

const inProcess = (): HashWorker => ({
  start: (file, chunkSize, receive) => void hashFile(file, chunkSize, receive),
  terminate: () => undefined,
})

export function setupManager(
  server: ReturnType<typeof fakeServer>,
  changes: Partial<UploadDeps> = {},
) {
  const sent: number[][] = []
  const writes: SavedState[] = []
  const later: Array<{ task: () => void; milliseconds: number }> = []
  let ids = 0
  const deps: UploadDeps = {
    api: server.api,
    client: 'this-browser',
    send: async upload => void sent.push([upload.id, upload.index]),
    hashWorker: inProcess,
    storage: {
      read: () => ({ submissions: [], uploads: [] }),
      write: state => void writes.push(state),
    },
    lock: async (_name, task) => {
      await task()
      return true
    },
    later: (task, milliseconds) => void later.push({ task, milliseconds }),
    now: () => Date.now(),
    random: () => 0,
    newId: () => `id${++ids}`,
    ...changes,
  }
  return { manager: new UploadManager(deps), sent, writes, later }
}

export const tenBytes = () => new File(['0123456789'], 'game.7z', { lastModified: 7 })

export function hanging(upload: ChunkUpload): Promise<unknown> {
  return new Promise((_resolve, reject) => {
    upload.signal?.throwIfAborted()
    upload.signal?.addEventListener('abort', () => reject(upload.signal?.reason))
  })
}

export function ongoingSession(id: number, changes: Partial<OngoingUpload> = {}): OngoingUpload {
  return {
    upload_session_id: id,
    status: 'UPLOADING',
    file_name: 'game.7z',
    total_size: 10,
    chunk_size: 4,
    total_chunks: 3,
    uploaded_chunks: [],
    expires_at: '',
    held_elsewhere: false,
    ...changes,
  }
}

export function savedUpload(sessionId?: number): SavedState {
  return {
    submissions: [
      { id: 's', target: { kind: 'append', resourceId: 4 }, label: 'ゲーム', submitting: false },
    ],
    uploads: [
      {
        id: 'u',
        submission: 's',
        file: { name: 'game.7z', size: 10, lastModified: 7 },
        session:
          sessionId === undefined ? undefined : { id: sessionId, chunkSize: 4, totalChunks: 3 },
        done: false,
      },
    ],
  }
}
