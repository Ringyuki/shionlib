import { describe, expect, it } from 'vitest'
import { ApiError } from '~/shared/api/error'
import { FileReadError } from './file-hasher'
import { describeError, remembered, submissionReport, uploadReport } from './upload-report'

const failure = (requestId: string) => ({
  code: 480112,
  message: '上传已过期',
  data: { errors: null },
  requestId,
  timestamp: '',
})

describe('describeError', () => {
  it('keeps what tells an answer of the API from one of a proxy', () => {
    expect(describeError(new ApiError(410, failure('req-1'), undefined, 'ray-1'))).toEqual({
      name: 'ApiError',
      message: '上传已过期',
      status: 410,
      code: 480112,
      request_id: 'req-1',
      ray: 'ray-1',
    })
    expect(describeError(new ApiError(403, failure('')))).toEqual({
      name: 'ApiError',
      message: '上传已过期',
      status: 403,
      code: 480112,
    })
  })

  it('keeps the name and message of anything else', () => {
    expect(describeError(new FileReadError('NotReadableError', 'gone'))).toEqual({
      name: 'NotReadableError',
      message: 'gone',
    })
    expect(describeError(new TypeError('Network request failed'))).toEqual({
      name: 'TypeError',
      message: 'Network request failed',
    })
    expect(describeError('odd')).toEqual({ name: 'Unknown', message: 'odd' })
    expect(describeError(new Error('x'.repeat(3000))).message).toHaveLength(2000)
  })
})

describe('remembered', () => {
  it('keeps the last tries that were retried, newest last', () => {
    let attempts = remembered([], 'otherTab', new Error('x'), 0)
    expect(attempts).toEqual([])
    for (let at = 0; at < 12; at++) {
      attempts = remembered(
        attempts,
        at === 11 ? 'inFlight' : 'network',
        new TypeError(`${at}`),
        at * 1000,
      )
    }
    expect(attempts).toHaveLength(10)
    expect(attempts[0]).toEqual({
      at: '1970-01-01T00:00:02.000Z',
      wait: 'network',
      error: { name: 'TypeError', message: '2' },
    })
    expect(attempts.at(-1)?.wait).toBe('in_flight')
  })
})

describe('reports', () => {
  const upload = {
    id: 'u',
    submission: 's',
    file: { name: '【PC】罚抄_PLUS.zip', size: 6915224321, lastModified: 1 },
    sent: 0,
    speed: 0,
    phase: { name: 'running' as const },
  }

  it('describe a failed upload by where it stopped', () => {
    const origin = {
      reason: 'unreadable' as const,
      error: { name: 'NotReadableError', message: 'gone' },
      stage: 'read' as const,
      chunk: 0,
    }
    expect(uploadReport(upload, origin, [])).toEqual({
      stage: 'read',
      reason: 'unreadable',
      error: { name: 'NotReadableError', message: 'gone' },
      chunk: 0,
      file_name: '【PC】罚抄_PLUS.zip',
      file_size: 6915224321,
    })
    const opened = { ...upload, session: { id: 7780, chunkSize: 4, totalChunks: 2 } }
    expect(
      uploadReport(opened, { ...origin, reason: 'changedFile', stage: 'chunk' }, []),
    ).toMatchObject({
      session_id: 7780,
      stage: 'chunk',
      reason: 'changed_file',
    })
  })

  it('describe a resource that could not be made', () => {
    expect(
      submissionReport('Rewrite+', [upload, upload], new TypeError('Failed to fetch')),
    ).toEqual({
      stage: 'submit',
      reason: 'rejected',
      error: { name: 'TypeError', message: 'Failed to fetch' },
      file_name: 'Rewrite+',
      file_size: 13830448642,
    })
  })

  it('names the uploads of a resource that could not be made', () => {
    const opened = { ...upload, session: { id: 7781, chunkSize: 4, totalChunks: 2 } }
    expect(
      submissionReport('Rewrite+', [opened, upload], new TypeError('Failed to fetch')),
    ).toEqual({
      session_ids: [7781],
      stage: 'submit',
      reason: 'rejected',
      error: { name: 'TypeError', message: 'Failed to fetch' },
      file_name: 'Rewrite+',
      file_size: 13830448642,
    })
  })
})
