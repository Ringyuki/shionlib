import { describe, expect, it } from 'vitest'
import { emptyState, type Submission, type Upload } from './upload'
import { nextToStart, readyToSubmit, reduce } from './upload-state'

const submission: Submission = {
  id: 's',
  target: { kind: 'append', resourceId: 1 },
  phase: { name: 'uploading' },
}

function upload(id: string, changes: Partial<Upload> = {}): Upload {
  return {
    id,
    submission: 's',
    file: { name: id, size: 10, lastModified: 1 },
    sent: 0,
    speed: 0,
    phase: { name: 'queued' },
    ...changes,
  }
}

describe('reduce', () => {
  it('adds a submission with its uploads and finishes them in full', () => {
    let state = reduce(emptyState, {
      type: 'added',
      submission,
      uploads: [upload('a'), upload('b')],
    })
    state = reduce(state, { type: 'started', upload: 'a' })
    state = reduce(state, { type: 'progressed', upload: 'a', sent: 4, speed: 2 })
    expect(state.uploads[0]).toMatchObject({ phase: { name: 'running' }, sent: 4, speed: 2 })
    state = reduce(state, { type: 'finished', upload: 'a' })
    expect(state.uploads[0]).toMatchObject({ phase: { name: 'done' }, sent: 10, speed: 0 })
  })

  it('drops a submission with its last upload', () => {
    let state = reduce(emptyState, {
      type: 'added',
      submission,
      uploads: [upload('a'), upload('b')],
    })
    state = reduce(state, { type: 'removed', upload: 'a' })
    expect(state.submissions).toHaveLength(1)
    state = reduce(state, { type: 'removed', upload: 'b' })
    expect(state).toEqual(emptyState)
  })

  it('pauses, waits and resumes', () => {
    let state = reduce(emptyState, {
      type: 'added',
      submission,
      uploads: [upload('a', { speed: 5 })],
    })
    state = reduce(state, { type: 'waiting', upload: 'a', reason: 'network' })
    expect(state.uploads[0]).toMatchObject({
      phase: { name: 'waiting', reason: 'network' },
      speed: 0,
    })
    state = reduce(state, { type: 'paused', upload: 'a' })
    state = reduce(state, { type: 'resumed', upload: 'a' })
    expect(state.uploads[0]?.phase).toEqual({ name: 'queued' })
  })
})

describe('selectors', () => {
  it('starts queued uploads with a file, two at a time', () => {
    const state = reduce(emptyState, {
      type: 'added',
      submission,
      uploads: [upload('a', { phase: { name: 'running' } }), upload('b'), upload('c'), upload('d')],
    })
    expect(nextToStart(state, id => id !== 'b').map(next => next.id)).toEqual(['c'])
  })

  it('submits once every upload is done, never orphans', () => {
    const done = { phase: { name: 'done' } } as const
    const ready = reduce(emptyState, { type: 'added', submission, uploads: [upload('a', done)] })
    expect(readyToSubmit(ready).map(entry => entry.id)).toEqual(['s'])
    const waiting = reduce(ready, {
      type: 'added',
      submission: { ...submission, id: 't' },
      uploads: [upload('b', { submission: 't' })],
    })
    expect(readyToSubmit(waiting).map(entry => entry.id)).toEqual(['s'])
    const orphans = reduce(emptyState, {
      type: 'added',
      submission: { ...submission, target: { kind: 'orphan' } },
      uploads: [upload('a', done)],
    })
    expect(readyToSubmit(orphans)).toEqual([])
  })
})
