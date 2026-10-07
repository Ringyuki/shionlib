import { describe, expect, it } from 'vitest'
import {
  admit,
  fileLimit,
  matchFiles,
  chunkLength,
  pausable,
  progress,
  queueStatus,
  sameFile,
  submitted,
  totals,
  unsubmitted,
  uploadedBytes,
  type Allowance,
  type Submission,
  type Upload,
  type UploadPhase,
  type UploadState,
} from './upload'

const allowance: Allowance = {
  tier: 'new',
  approved: 0,
  trusted: false,
  frozen_until: null,
  stored: 40,
  stored_limit: 100,
  in_flight: 10,
  in_flight_limit: 50,
  max_file_size: 30,
}

describe('upload rules', () => {
  it('matches a chosen file by name, size and, when known, modification time', () => {
    const known = { name: 'game.7z', size: 10, lastModified: 5 }
    expect(sameFile({ ...known }, known)).toBe(true)
    expect(sameFile({ ...known, lastModified: 6 }, known)).toBe(false)
    expect(sameFile({ ...known, lastModified: 6 }, { ...known, lastModified: 0 })).toBe(true)
    expect(sameFile({ ...known, size: 11 }, known)).toBe(false)
  })

  it('admits files that fit the allowance and names the first that does not', () => {
    const file = (name: string, size: number) => ({ name, size })
    expect(admit(allowance, [file('a', 20), file('b', 30)])).toBe(undefined)
    expect(admit(allowance, [file('a', 3), file('b', 0)])).toEqual({ kind: 'empty', file: 'b' })
    expect(admit(allowance, [file('a', 31)])).toEqual({
      kind: 'tooLarge',
      file: 'a',
      size: 31,
      limit: 30,
    })
    expect(admit(allowance, [file('a', 30), file('b', 30)])).toEqual({
      kind: 'overQuota',
      total: 60,
      left: 50,
    })
    expect(admit({ ...allowance, stored: 90 }, [])).toEqual({ kind: 'full' })
    expect(admit({ ...allowance, stored: 120 }, [file('a', 1)])).toEqual({ kind: 'full' })
    expect(admit(undefined, [file('a', 500)])).toBe(undefined)
    expect(admit(undefined, [file('a', 0)])).toEqual({ kind: 'empty', file: 'a' })
  })

  it('caps a file by the in-flight limit when the tier has no file limit', () => {
    const unlimited = { ...allowance, max_file_size: null, stored_limit: null }
    expect(fileLimit(unlimited)).toBe(50)
    expect(fileLimit(allowance)).toBe(30)
    expect(admit(unlimited, [{ name: 'a', size: 51 }])).toMatchObject({
      kind: 'tooLarge',
      limit: 50,
    })
    expect(admit(unlimited, [{ name: 'a', size: 50 }])).toBe(undefined)
  })

  it('measures chunks, the last one shorter', () => {
    const session = { id: 1, chunkSize: 4, totalChunks: 3 }
    expect(chunkLength(session, 10, 2)).toBe(2)
    expect(uploadedBytes(session, 10, [0, 2])).toBe(6)
  })

  it('leaves failed uploads out of the totals', () => {
    const base = { submission: 's', sent: 5, speed: 0, phase: { name: 'running' } } as const
    const uploads: Upload[] = [
      { ...base, id: 'a', file: { name: 'a', size: 10, lastModified: 0 } },
      {
        ...base,
        id: 'b',
        file: { name: 'b', size: 10, lastModified: 0 },
        phase: { name: 'failed', reason: 'expired' },
      },
    ]
    expect(totals(uploads)).toEqual({ size: 10, sent: 5, ratio: 0.5 })
  })

  it('pairs chosen files with the uploads waiting for them', () => {
    const base = { submission: 's', sent: 0, speed: 0 } as const
    const uploads: Upload[] = [
      {
        ...base,
        id: 'a',
        file: { name: 'a.rar', size: 4, lastModified: 1 },
        phase: { name: 'needsFile' },
      },
      {
        ...base,
        id: 'b',
        file: { name: 'b.rar', size: 4, lastModified: 0 },
        phase: { name: 'needsFile' },
      },
      {
        ...base,
        id: 'c',
        file: { name: 'c.rar', size: 4, lastModified: 1 },
        phase: { name: 'running' },
      },
    ]
    const file = (name: string, lastModified: number) => new File(['data'], name, { lastModified })
    const chosen = [file('a.rar', 1), file('b.rar', 9), file('c.rar', 1), file('a.rar', 2)]
    const { matches, unmatched } = matchFiles(uploads, chosen)
    expect([...matches.keys()]).toEqual(['a', 'b'])
    expect(unmatched.map(entry => entry.name)).toEqual(['a.rar'])
  })
})

describe('the upload queue', () => {
  const upload = (phase: UploadPhase, sent = 0): Upload => ({
    id: 'u',
    submission: 's',
    file: { name: 'a.rar', size: 8, lastModified: 1 },
    sent,
    speed: 0,
    phase,
  })
  const submission = (id: string, phase: Submission['phase']): Submission => ({
    id,
    target: { kind: 'append', resourceId: 1 },
    label: 'a.rar',
    phase,
  })
  const state = (submissions: Submission[], uploads: Upload[] = []): UploadState => ({
    submissions,
    uploads,
  })

  it('can pause what is moving or about to', () => {
    expect(pausable(upload({ name: 'running' }))).toBe(true)
    expect(pausable(upload({ name: 'queued' }))).toBe(true)
    expect(pausable(upload({ name: 'waiting', reason: 'network' }))).toBe(true)
    expect(pausable(upload({ name: 'paused' }))).toBe(false)
    expect(pausable(upload({ name: 'needsFile' }))).toBe(false)
    expect(pausable(upload({ name: 'done' }))).toBe(false)
  })

  it('measures progress in percent, also for an empty file', () => {
    expect(progress(upload({ name: 'running' }, 2))).toBe(25)
    expect(
      progress({ ...upload({ name: 'done' }), file: { name: 'a', size: 0, lastModified: 0 } }),
    ).toBe(0)
  })

  it('splits submissions into those still to submit and those submitted', () => {
    const queue = state([
      submission('a', { name: 'uploading' }),
      submission('b', { name: 'submitted' }),
      submission('c', { name: 'failed' }),
      submission('d', { name: 'submitting' }),
    ])
    expect(unsubmitted(queue).map(entry => entry.id)).toEqual(['a', 'c', 'd'])
    expect(submitted(queue).map(entry => entry.id)).toEqual(['b'])
  })

  it('sums the queue up for the header', () => {
    expect(queueStatus(state([]))).toBe('idle')
    expect(
      queueStatus(state([submission('a', { name: 'uploading' })], [upload({ name: 'running' })])),
    ).toBe('active')
    expect(
      queueStatus(state([submission('a', { name: 'uploading' })], [upload({ name: 'needsFile' })])),
    ).toBe('attention')
    expect(queueStatus(state([submission('a', { name: 'failed' })]))).toBe('attention')
    expect(
      queueStatus(state([submission('a', { name: 'submitted' })], [upload({ name: 'done' })])),
    ).toBe('finished')
  })
})
