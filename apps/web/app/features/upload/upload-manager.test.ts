import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '~/shared/api/error'
import { BusinessCode } from '~/shared/api/generated/business-codes'
import type { OngoingUpload } from './upload'
import {
  fakeServer,
  hanging,
  ongoingSession,
  savedUpload,
  setupManager,
  tenBytes,
} from './upload-testing'

const heldElsewhere = new ApiError(409, {
  code: BusinessCode.GAME_UPLOAD_SESSION_HELD_ELSEWHERE,
  message: 'held',
  data: { errors: null },
  requestId: '',
  timestamp: '',
})

const kindOf = (submission: { target: { kind: string } }) => submission.target.kind

const phaseOf = (upload: { phase: { name: string } }) => upload.phase.name

describe('UploadManager', () => {
  it('uploads every file of a resource, then creates it', async () => {
    const server = fakeServer()
    const { manager, writes } = setupManager(server)
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
    const server = fakeServer([ongoingSession(5, { uploaded_chunks: [0] })])
    const { manager, sent } = setupManager(server, {
      storage: { read: () => savedUpload(5), write: () => undefined },
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
    const { manager } = setupManager(fakeServer(), {
      storage: { read: () => savedUpload(), write: () => undefined },
    })
    const first = manager.start()
    manager.dispose()
    await Promise.all([first, manager.start()])
    expect(manager.getSnapshot().uploads.map(upload => upload.id)).toEqual(['u'])
  })

  it('pauses and resumes', async () => {
    let paused = false
    const { manager } = setupManager(fakeServer(), {
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
    const { manager, later } = setupManager(fakeServer(), {
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
        reason: 'otherTab',
      }),
    )
    taken = false
    later[0]?.task()
    await vi.waitFor(() =>
      expect(manager.getSnapshot().uploads[0]?.phase).toEqual({ name: 'done' }),
    )
  })

  it('discards the session of a cancelled upload', async () => {
    const server = fakeServer()
    const { manager } = setupManager(server, { send: hanging })
    manager.add({ kind: 'append', resourceId: 4 }, 'ゲーム', [{ file: tenBytes() }])
    await vi.waitFor(() => expect(manager.getSnapshot().uploads[0]?.session?.id).toBe(1))
    manager.cancel('id2')
    await vi.waitFor(() => expect(server.called('DELETE', '/uploads/large/1')).toBeDefined())
    expect(manager.getSnapshot()).toEqual({ submissions: [], uploads: [] })
  })

  it('holds the sessions in its queue and shows what another browser holds', async () => {
    const server = fakeServer([
      ongoingSession(5, { uploaded_chunks: [0] }),
      ongoingSession(6, { held_elsewhere: true }),
    ])
    const { manager, later } = setupManager(server, {
      storage: { read: () => savedUpload(5), write: () => undefined },
    })
    await manager.start()
    expect(server.called('POST', '/uploads/large/hold')).toMatchObject({
      body: { upload_session_ids: [5] },
      client: 'this-browser',
    })
    expect(manager.getSnapshot().submissions.map(kindOf)).toEqual(['append', 'heldElsewhere'])
    expect(manager.getSnapshot().uploads.map(phaseOf)).toEqual(['needsFile', 'heldElsewhere'])
    expect(later[0]?.milliseconds).toBe(20_000)
  })

  it('offers a session here once the other browser lets go of it', async () => {
    const sessions: OngoingUpload[] = [ongoingSession(6, { held_elsewhere: true })]
    const { manager, later } = setupManager(fakeServer(sessions))
    await manager.start()
    expect(manager.getSnapshot().submissions.map(kindOf)).toEqual(['heldElsewhere'])
    sessions[0] = ongoingSession(6)
    later[0]?.task()
    await vi.waitFor(() =>
      expect(manager.getSnapshot().submissions.map(kindOf)).toEqual(['orphan']),
    )
    expect(manager.getSnapshot().uploads.map(phaseOf)).toEqual(['needsFile'])
  })

  it('yields a session another browser holds and takes it up again when it is free', async () => {
    const sessions: OngoingUpload[] = []
    let held = true
    const server = fakeServer(sessions)
    const { manager, later } = setupManager(server, {
      send: () => (held ? Promise.reject(heldElsewhere) : Promise.resolve()),
    })
    await manager.start()
    manager.add({ kind: 'append', resourceId: 4 }, 'ゲーム', [{ file: tenBytes() }])
    await vi.waitFor(() =>
      expect(manager.getSnapshot().uploads.map(phaseOf)).toEqual(['heldElsewhere']),
    )
    held = false
    sessions.push(ongoingSession(1))
    later[0]?.task()
    await vi.waitFor(() =>
      expect(manager.getSnapshot().submissions[0]?.phase.name).toBe('submitted'),
    )
    expect(server.called('POST', '/uploads/large/hold')?.body).toEqual({ upload_session_ids: [1] })
  })

  it('does not bring back a session it discarded', async () => {
    const server = fakeServer([ongoingSession(9), ongoingSession(10)])
    const { manager, later } = setupManager(server)
    await manager.start()
    manager.cancel('session-9')
    later[0]?.task()
    await vi.waitFor(() =>
      expect(server.calls.filter(call => call.path === '/uploads/large/ongoing')).toHaveLength(2),
    )
    expect(manager.getSnapshot().uploads.map(upload => upload.id)).toEqual(['session-10'])
    expect(server.called('DELETE', '/uploads/large/9')?.client).toBe('this-browser')
  })
})
