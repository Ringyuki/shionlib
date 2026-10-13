import { describe, expect, it } from 'vitest'
import { fakeServer, ongoingSession } from './upload-testing'
import { syncSessions } from './upload.use-cases'

describe('syncSessions', () => {
  it('only reads what is ongoing when nothing here needs holding', async () => {
    const server = fakeServer([ongoingSession(3, { held_elsewhere: true })])
    const picture = await syncSessions(server.api, 'this-browser', [])
    expect(picture).toEqual({
      ongoing: [ongoingSession(3, { held_elsewhere: true })],
      renewEvery: undefined,
    })
    expect(server.calls.map(call => [call.method, call.path, call.client])).toEqual([
      ['GET', '/uploads/large/ongoing', 'this-browser'],
    ])
  })

  it('holds its sessions first, in batches the API accepts, and paces itself by the hold', async () => {
    const server = fakeServer()
    const held = Array.from({ length: 150 }, (_unused, index) => index + 1)
    const picture = await syncSessions(server.api, 'this-browser', held)
    expect(picture.renewEvery).toBe(20_000)
    expect(server.calls.map(call => call.path)).toEqual([
      '/uploads/large/hold',
      '/uploads/large/hold',
      '/uploads/large/ongoing',
    ])
    expect(server.calls[0]?.body).toEqual({ upload_session_ids: held.slice(0, 100) })
    expect(server.calls[1]?.body).toEqual({ upload_session_ids: held.slice(100) })
  })
})
