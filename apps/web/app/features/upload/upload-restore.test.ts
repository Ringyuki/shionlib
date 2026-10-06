import { describe, expect, it } from 'vitest'
import type { OngoingUpload, UploadState } from './upload'
import { orphanSubmission, restoreState, savedStateOf } from './upload-restore'
import type { SavedState } from './upload.schema'

const session = { id: 7, chunkSize: 4, totalChunks: 3 }
const file = { name: 'game.7z', size: 10, lastModified: 3 }

function ongoing(id: number, status: OngoingUpload['status'], chunks: number[]): OngoingUpload {
  return {
    upload_session_id: id,
    status,
    file_name: `f${id}`,
    total_size: 10,
    chunk_size: 4,
    total_chunks: 3,
    uploaded_chunks: chunks,
    expires_at: '',
  }
}

function saved(submitting: boolean, uploads: SavedState['uploads']): SavedState {
  return {
    submissions: [{ id: 's', target: { kind: 'append', resourceId: 1 }, submitting }],
    uploads,
  }
}

describe('restoreState', () => {
  it('asks for the file again and keeps the uploaded part', () => {
    const state = restoreState(
      saved(false, [{ id: 'a', submission: 's', file, session, done: false }]),
      [ongoing(7, 'UPLOADING', [0, 2])],
    )
    expect(state.uploads[0]).toMatchObject({ phase: { name: 'needsFile' }, sent: 6 })
    expect(state.submissions[0]?.phase).toEqual({ name: 'uploading' })
  })

  it('finishes uploads the server completed and expires the ones it lost', () => {
    const state = restoreState(
      saved(false, [
        { id: 'a', submission: 's', file, session, done: false },
        { id: 'b', submission: 's', file, session: { ...session, id: 8 }, done: true },
        { id: 'c', submission: 's', file, done: false },
      ]),
      [ongoing(7, 'COMPLETED', [0, 1, 2])],
    )
    expect(state.uploads.map(upload => upload.phase.name)).toEqual(['done', 'failed', 'needsFile'])
  })

  it('treats a submission whose sessions were consumed as submitted', () => {
    const state = restoreState(
      saved(true, [{ id: 'a', submission: 's', file, session, done: true }]),
      [],
    )
    expect(state.submissions[0]?.phase).toEqual({ name: 'submitted' })
    expect(state.uploads[0]?.phase).toEqual({ name: 'done' })
  })

  it('collects server sessions nobody here knows as orphans', () => {
    const state = restoreState({ submissions: [], uploads: [] }, [
      ongoing(9, 'UPLOADING', [1]),
      ongoing(10, 'COMPLETED', [0, 1, 2]),
    ])
    expect(state.submissions).toEqual([
      { id: orphanSubmission, target: { kind: 'orphan' }, phase: { name: 'uploading' } },
    ])
    expect(
      state.uploads.map(upload => [upload.file.lastModified, upload.sent, upload.phase.name]),
    ).toEqual([
      [0, 4, 'needsFile'],
      [0, 10, 'done'],
    ])
  })
})

describe('savedStateOf', () => {
  it('keeps what the server cannot tell', () => {
    const state: UploadState = {
      submissions: [
        { id: 's', target: { kind: 'append', resourceId: 1 }, phase: { name: 'submitting' } },
        { id: 'gone', target: { kind: 'append', resourceId: 2 }, phase: { name: 'submitted' } },
      ],
      uploads: [
        { id: 'a', submission: 's', file, session, sent: 10, speed: 0, phase: { name: 'done' } },
        {
          id: 'b',
          submission: 's',
          file,
          sent: 0,
          speed: 0,
          phase: { name: 'failed', reason: 'expired' },
        },
        { id: 'c', submission: 'gone', file, sent: 10, speed: 0, phase: { name: 'done' } },
      ],
    }
    expect(savedStateOf(state)).toEqual({
      submissions: [{ id: 's', target: { kind: 'append', resourceId: 1 }, submitting: true }],
      uploads: [{ id: 'a', submission: 's', file, name: undefined, session, done: true }],
    })
  })
})
