import { describe, expect, it } from 'vitest'
import {
  allReceivedUnsubmitted,
  browserOf,
  detached,
  everyStage,
  narrowed,
  percentOf,
  searchOf,
  searchWith,
  shortHash,
  startedBeforeFailureLog,
  terminable,
  type UploadDetail,
} from './admin-upload'

const everything = { stage: everyStage, query: '', user: undefined, failed: false } as const

const ended: UploadDetail = {
  kind: 'session',
  id: 7780,
  file_name: 'ANGEL TYPE_cn.zip',
  size: 4_650_000_000,
  uploader: { id: 9, name: 'ringyuki' },
  stage: 'expired',
  file_stage: null,
  rejection: null,
  received: 89,
  chunks: 89,
  game: null,
  failure_count: 0,
  started: '2026-10-13T09:12:00Z',
  session: {
    chunk_size: 52_428_800,
    hash_algorithm: 'blake3',
    file_hash: '',
    expires_at: '2026-10-14T09:12:00Z',
    last_chunk_at: '2026-10-13T10:02:00Z',
    completed_at: null,
    submitted_at: null,
    aborted_at: null,
    ended_at: '2026-10-14T09:20:00Z',
    updated: '2026-10-14T09:20:00Z',
  },
  target: null,
  held: false,
  failures: null,
}

describe('searchOf', () => {
  it('writes only what narrows the list', () => {
    expect(searchOf(everything)).toBe('')
    expect(searchOf({ stage: 'pending', query: '罚抄', user: 9, failed: true })).toBe(
      '?stage=pending&q=%E7%BD%9A%E6%8A%84&user=9&failed=1',
    )
    expect(narrowed(everything)).toBe(false)
    expect(narrowed({ ...everything, failed: true })).toBe(true)
  })
})

describe('searchWith', () => {
  it('opens a session or an attempt by its own key, one at a time', () => {
    expect(searchWith('?stage=pending', { kind: 'session', id: 8 })).toBe('?stage=pending&id=8')
    expect(searchWith('?stage=pending&id=8', { kind: 'attempt', id: 3 })).toBe(
      '?stage=pending&attempt=3',
    )
    expect(searchWith('?attempt=3', undefined)).toBe('')
  })
})

describe('the rules of an upload', () => {
  it('counts the progress in whole percents', () => {
    expect(percentOf({ received: 2, chunks: 3 })).toBe(66)
    expect(percentOf({ received: 0, chunks: 0 })).toBe(0)
  })

  it('terminates only what is still open', () => {
    expect(terminable({ stage: 'uploading' })).toBe(true)
    expect(terminable({ stage: 'pending' })).toBe(true)
    expect(terminable({ stage: 'processing' })).toBe(false)
    expect(terminable({ stage: 'expired' })).toBe(false)
  })

  it('tells an ended upload whose chunks all arrived but was never submitted', () => {
    expect(allReceivedUnsubmitted(ended)).toBe(true)
    expect(allReceivedUnsubmitted({ ...ended, received: 88 })).toBe(false)
    expect(allReceivedUnsubmitted({ ...ended, stage: 'pending' })).toBe(false)
  })

  it('tells an upload that began before failures were recorded', () => {
    expect(startedBeforeFailureLog({ started: '2026-10-13T15:59:00Z' })).toBe(true)
    expect(startedBeforeFailureLog({ started: '2026-10-13T16:00:00Z' })).toBe(false)
  })

  it('shortens a hash to its first twelve characters', () => {
    expect(shortHash('ff62c0ce275d8a1b')).toBe('ff62c0ce275d…')
    expect(shortHash('ff62c0ce275d')).toBe('ff62c0ce275d')
  })

  it('tells a published upload whose file was replaced since', () => {
    expect(detached({ stage: 'published', file_stage: null })).toBe(true)
    expect(detached({ stage: 'published', file_stage: 'stored' })).toBe(false)
  })
})

describe('browserOf', () => {
  it('names the browser, its version and the system', () => {
    expect(
      browserOf(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      ),
    ).toEqual({ name: 'Edge', version: '141', system: 'Windows' })
    expect(
      browserOf(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      ),
    ).toEqual({ name: 'Safari', version: '26', system: 'macOS' })
    expect(browserOf('curl/8.7.1')).toBeUndefined()
  })
})
