import { describe, expect, it, vi } from 'vitest'
import type { ChunkUpload } from '~/shared/api/chunk'
import { createApi } from '~/shared/api/client'
import type { HashWorker } from './file-hasher'
import type { OngoingUpload } from './upload'
import { hashFile } from './upload-hash'
import { UploadManager } from './upload-manager'
import type { UploadDeps } from './upload-transfer'
import type { SavedState } from './upload.schema'

type Call = { method: string; path: string; body: unknown }

const sizeOf = (body: unknown) =>
  typeof body === 'object' &&
  body !== null &&
  'total_size' in body &&
  typeof body.total_size === 'number'
    ? body.total_size
    : 0

function fakeServer(ongoing: OngoingUpload[] = []) {
  const calls: Call[] = []
  let next = 1
  const reply = (data: unknown) => Response.json({ code: 0, message: 'ok', data })
  const api = createApi({
    baseUrl: 'http://api.test',
    fetch: async request => {
      const path = new URL(request.url).pathname
      const body: unknown = request.body === null ? undefined : await request.json()
      calls.push({ method: request.method, path, body })
      if (path === '/uploads/large/ongoing') return reply(ongoing)
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

function setup(server: ReturnType<typeof fakeServer>, changes: Partial<UploadDeps> = {}) {
  const sent: number[][] = []
  const writes: SavedState[] = []
  const later: Array<() => void> = []
  let ids = 0
  const deps: UploadDeps = {
    api: server.api,
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
    later: task => void later.push(task),
    now: () => Date.now(),
    random: () => 0,
    newId: () => `id${++ids}`,
    ...changes,
  }
  return { manager: new UploadManager(deps), sent, writes, later }
}

const tenBytes = () => new File(['0123456789'], 'game.7z', { lastModified: 7 })

function hanging(upload: ChunkUpload): Promise<unknown> {
  return new Promise((_resolve, reject) => {
    upload.signal?.throwIfAborted()
    upload.signal?.addEventListener('abort', () => reject(upload.signal?.reason))
  })
}

describe('UploadManager', () => {
  it('uploads every file of a resource, then creates it', async () => {
    const server = fakeServer()
    const { manager, writes } = setup(server)
    manager.add(
      { kind: 'create', gameId: 3, resource: { platform: ['win'], language: ['jp'] } },
      'ゲーム',
      [{ file: tenBytes() }, { file: new File(['abcd'], 'game.part2.rar'), name: '第二卷.rar' }],
    )
    await vi.waitFor(() =>
      expect(manager.getSnapshot().submissions[0]?.phase.name).toBe('submitted'),
    )
    expect(server.called('POST', '/game/3/download-source')?.body).toEqual({
      platform: ['win'],
      language: ['jp'],
      files: [{ upload_session_id: 1 }, { upload_session_id: 2, file_name: '第二卷.rar' }],
    })
    expect(server.called('PATCH', '/uploads/large/1/complete')?.body).toMatchObject({
      file_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
    expect(writes.at(-1)).toEqual({ submissions: [], uploads: [] })
  })

  it('resumes a restored upload once its file is chosen again', async () => {
    const session: OngoingUpload = {
      upload_session_id: 5,
      status: 'UPLOADING',
      file_name: 'game.7z',
      total_size: 10,
      chunk_size: 4,
      total_chunks: 3,
      uploaded_chunks: [0],
      expires_at: '',
    }
    const saved: SavedState = {
      submissions: [
        { id: 's', target: { kind: 'append', resourceId: 4 }, label: 'ゲーム', submitting: false },
      ],
      uploads: [
        {
          id: 'u',
          submission: 's',
          file: { name: 'game.7z', size: 10, lastModified: 7 },
          session: { id: 5, chunkSize: 4, totalChunks: 3 },
          done: false,
        },
      ],
    }
    const server = fakeServer([session])
    const { manager, sent } = setup(server, {
      storage: { read: () => saved, write: () => undefined },
    })
    await manager.start()
    expect(manager.getSnapshot().uploads[0]).toMatchObject({
      phase: { name: 'needsFile' },
      sent: 4,
    })
    const unmatched = manager.attach([new File(['xxxx'], 'other.7z'), tenBytes()])
    expect(unmatched.map(file => file.name)).toEqual(['other.7z'])
    await vi.waitFor(() =>
      expect(manager.getSnapshot().submissions[0]?.phase.name).toBe('submitted'),
    )
    expect(sent).toEqual([
      [5, 1],
      [5, 2],
    ])
    expect(server.called('POST', '/game/download-source/4/files')?.body).toEqual({
      files: [{ upload_session_id: 5 }],
    })
  })

  it('restores once even when started twice and stopped in between', async () => {
    const saved: SavedState = {
      submissions: [
        { id: 's', target: { kind: 'append', resourceId: 4 }, label: 'ゲーム', submitting: false },
      ],
      uploads: [
        {
          id: 'u',
          submission: 's',
          file: { name: 'game.7z', size: 10, lastModified: 7 },
          done: false,
        },
      ],
    }
    const { manager } = setup(fakeServer(), {
      storage: { read: () => saved, write: () => undefined },
    })
    const first = manager.start()
    manager.dispose()
    await Promise.all([first, manager.start()])
    expect(manager.getSnapshot().uploads.map(upload => upload.id)).toEqual(['u'])
  })

  it('pauses and resumes', async () => {
    let paused = false
    const { manager } = setup(fakeServer(), {
      send: upload => (paused ? Promise.resolve() : hanging(upload)),
    })
    manager.add({ kind: 'append', resourceId: 4 }, 'ゲーム', [{ file: tenBytes() }])
    await vi.waitFor(() => expect(manager.getSnapshot().uploads[0]?.session?.id).toBe(1))
    manager.pause('id2')
    paused = true
    expect(manager.getSnapshot().uploads[0]?.phase).toEqual({ name: 'paused' })
    manager.resume('id2')
    await vi.waitFor(() =>
      expect(manager.getSnapshot().uploads[0]?.phase).toEqual({ name: 'done' }),
    )
  })

  it('waits while another tab uploads the same session', async () => {
    let taken = true
    const { manager, later } = setup(fakeServer(), {
      lock: async (_name, task) => {
        if (taken) return false
        await task()
        return true
      },
    })
    manager.add({ kind: 'append', resourceId: 4 }, 'ゲーム', [{ file: tenBytes() }])
    await vi.waitFor(() =>
      expect(manager.getSnapshot().uploads[0]?.phase).toEqual({
        name: 'waiting',
        reason: 'elsewhere',
      }),
    )
    taken = false
    later[0]?.()
    await vi.waitFor(() =>
      expect(manager.getSnapshot().uploads[0]?.phase).toEqual({ name: 'done' }),
    )
  })

  it('discards the session of a cancelled upload', async () => {
    const server = fakeServer()
    const { manager } = setup(server, { send: hanging })
    manager.add({ kind: 'append', resourceId: 4 }, 'ゲーム', [{ file: tenBytes() }])
    await vi.waitFor(() => expect(manager.getSnapshot().uploads[0]?.session?.id).toBe(1))
    manager.cancel('id2')
    await vi.waitFor(() => expect(server.called('DELETE', '/uploads/large/1')).toBeDefined())
    expect(manager.getSnapshot()).toEqual({ submissions: [], uploads: [] })
  })
})
