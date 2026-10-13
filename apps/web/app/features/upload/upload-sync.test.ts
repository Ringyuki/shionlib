import { describe, expect, it } from 'vitest'
import type { Upload, UploadPhase, UploadState } from './upload'
import { elsewhereSubmission, heldSessions, orphanSubmission, syncState } from './upload-sync'
import { ongoingSession } from './upload-testing'

const file = { name: 'game.7z', size: 10, lastModified: 3 }

function upload(id: string, session: number, phase: UploadPhase, submission = 's'): Upload {
  return {
    id,
    submission,
    file,
    session: { id: session, chunkSize: 4, totalChunks: 3 },
    sent: 0,
    speed: 0,
    phase,
  }
}

function queueOf(...uploads: Upload[]): UploadState {
  return {
    submissions: [
      {
        id: 's',
        target: { kind: 'append', resourceId: 1 },
        label: 'x',
        phase: { name: 'uploading' },
      },
    ],
    uploads,
  }
}

const phases = (state: UploadState) =>
  state.uploads.map(entry => [entry.id, entry.submission, entry.phase.name, entry.sent])

describe('syncState', () => {
  it('gives way to another browser and comes back when it lets go', () => {
    const queue = queueOf(upload('a', 7, { name: 'running' }), upload('b', 8, { name: 'paused' }))
    const taken = syncState(queue, [
      ongoingSession(7, { held_elsewhere: true, uploaded_chunks: [0, 1] }),
      ongoingSession(8),
    ])
    expect(phases(taken)).toEqual([
      ['a', 's', 'heldElsewhere', 8],
      ['b', 's', 'paused', 0],
    ])
    const freed = syncState(taken, [ongoingSession(7, { uploaded_chunks: [0, 1, 2] })])
    expect(phases(freed)[0]).toEqual(['a', 's', 'needsFile', 10])
  })

  it('finishes an upload another browser completed', () => {
    const queue = queueOf(upload('a', 7, { name: 'heldElsewhere' }))
    const state = syncState(queue, [
      ongoingSession(7, { status: 'COMPLETED', held_elsewhere: true }),
    ])
    expect(phases(state)).toEqual([['a', 's', 'done', 10]])
  })

  it('leaves alone what the server does not list and what failed here', () => {
    const queue = queueOf(
      upload('a', 7, { name: 'running' }),
      upload('b', 8, { name: 'failed', reason: 'rejected' }),
    )
    expect(syncState(queue, [ongoingSession(8, { held_elsewhere: true })])).toEqual(queue)
  })

  it('sorts the sessions nobody here queued by who holds them', () => {
    const state = syncState(queueOf(), [
      ongoingSession(9, { uploaded_chunks: [1] }),
      ongoingSession(10, { held_elsewhere: true, uploaded_chunks: [0] }),
      ongoingSession(11, { held_elsewhere: true, status: 'COMPLETED' }),
    ])
    expect(state.submissions.map(submission => submission.target.kind)).toEqual([
      'append',
      'orphan',
      'heldElsewhere',
    ])
    expect(phases(state)).toEqual([
      ['session-9', orphanSubmission, 'needsFile', 4],
      ['session-10', elsewhereSubmission, 'heldElsewhere', 4],
      ['session-11', elsewhereSubmission, 'done', 10],
    ])
  })

  it('keeps an orphan that is being uploaded here and drops the ones that are gone', () => {
    const state: UploadState = {
      submissions: [],
      uploads: [
        { ...upload('session-9', 9, { name: 'running' }, orphanSubmission), sent: 6 },
        upload('session-10', 10, { name: 'needsFile' }, orphanSubmission),
        upload('session-11', 11, { name: 'heldElsewhere' }, elsewhereSubmission),
      ],
    }
    const synced = syncState(state, [ongoingSession(9), ongoingSession(11)])
    expect(synced.submissions.map(submission => submission.id)).toEqual([orphanSubmission])
    expect(phases(synced)).toEqual([
      ['session-9', orphanSubmission, 'running', 6],
      ['session-11', orphanSubmission, 'needsFile', 0],
    ])
    expect(syncState(synced, [])).toEqual({ submissions: [], uploads: [] })
  })
})

describe('heldSessions', () => {
  it('holds what is queued here and the orphans whose file was chosen here', () => {
    const state: UploadState = {
      submissions: [
        ...queueOf().submissions,
        {
          id: 'sent',
          target: { kind: 'append', resourceId: 2 },
          label: 'y',
          phase: { name: 'submitted' },
        },
      ],
      uploads: [
        upload('a', 1, { name: 'needsFile' }),
        upload('b', 2, { name: 'done' }),
        upload('c', 3, { name: 'failed', reason: 'expired' }),
        upload('d', 4, { name: 'done' }, 'sent'),
        upload('session-5', 5, { name: 'running' }, orphanSubmission),
        upload('session-6', 6, { name: 'needsFile' }, orphanSubmission),
      ],
    }
    expect(heldSessions(state, id => id === 'session-5')).toEqual([1, 2, 5])
  })
})
