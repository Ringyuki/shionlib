import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { CaseDetail, Filter } from './admin-check'
import { changeStalled, loadChecks, reviewCase, reviewCases } from './admin-check.use-cases'

const meta = { currentPage: 1, itemCount: 0, itemsPerPage: 20, totalItems: 2, totalPages: 1 }

const detail: CaseDetail = {
  id: 3,
  status: 'PENDING',
  decision_source: null,
  review_note: null,
  review_deadline: '2026-10-13T00:00:00.000Z',
  reviewed_at: null,
  detector: 'clamscan',
  detected_viruses: ['Eicar'],
  scan_result: null,
  scan_log_path: null,
  scan_log_excerpt: null,
  file_name: 'a.zip',
  file_size: 1,
  file_hash: 'h',
  hash_algorithm: 'sha256',
  notify_uploader_on_allow: true,
  uploader_notified_at: null,
  created: '2026-10-12T00:00:00.000Z',
  updated: '2026-10-12T00:00:00.000Z',
  file: null,
  resource: null,
  uploader: { id: 9, name: 'kotori', avatar: null, is_sponsor: false, role: 1, status: 1 },
  reviewer: null,
}

const filter: Filter = { outcome: undefined, page: 1, opened: undefined }

const listed = () =>
  fakeApi()
    .on('get', '/admin/content/malware-scan-cases', { items: null, meta })
    .on('get', '/admin/content/stalled-checks', null)

describe('loadChecks', () => {
  it('asks for what waits by deadline and for the decided cases by page', async () => {
    const fake = listed()
    const listing = await loadChecks(fake.api, { ...filter, outcome: 'ADMIN_ALLOW', page: 2 }, 20)
    expect(listing).toMatchObject({ waiting: [], stalled: [], records: [], total: 2 })
    const [waiting, decided] = fake.requests
      .map(request => new URL(request.url))
      .filter(url => url.pathname === '/admin/content/malware-scan-cases')
      .map(url => Object.fromEntries(url.searchParams))
    expect(waiting).toEqual({
      page: '1',
      pageSize: '50',
      status: 'PENDING',
      sortBy: 'review_deadline',
      sortOrder: 'asc',
    })
    expect(decided).toEqual({
      page: '2',
      pageSize: '20',
      reviewed: 'true',
      sortBy: 'reviewed_at',
      sortOrder: 'desc',
      decision_source: 'ADMIN_ALLOW',
    })
  })

  it('opens nothing when the case is gone', async () => {
    const fake = listed().fail('get', '/admin/content/malware-scan-cases/{id}', 404, {
      code: 440206,
      message: 'not found',
    })
    await expect(loadChecks(fake.api, { ...filter, opened: 3 }, 20)).resolves.toMatchObject({
      opened: undefined,
    })
  })

  it('opens a case without a resource without asking for its inspection', async () => {
    const fake = listed()
      .on('get', '/admin/content/malware-scan-cases/{id}', detail)
      .on('get', '/admin/content/malware-scan-policy', { auto_ban_threshold: 3, auto_ban_days: 30 })
      .fail('get', '/admin/users/{id}', 500, { code: 500, message: 'down' })
    await expect(loadChecks(fake.api, { ...filter, opened: 3 }, 20)).rejects.toMatchObject({
      status: 500,
    })
    expect(
      fake.requests.some(request => new URL(request.url).pathname.startsWith('/inspection/')),
    ).toBe(false)
  })
})

describe('reviewCase', () => {
  it('sends the decision and leaves an empty note out', async () => {
    const fake = fakeApi().on('patch', '/admin/content/malware-scan-cases/{id}/review', detail)
    await reviewCase(fake.api, { id: 3, decision: 'ALLOW', note: ' ', notify: false })
    await reviewCase(fake.api, { id: 3, decision: 'DELETE', note: ' confirmed ', notify: true })
    const [allowed, deleted] = await Promise.all(fake.requests.map(request => request.json()))
    expect(allowed).toEqual({ decision: 'ALLOW', notify_uploader: false })
    expect(deleted).toEqual({ decision: 'DELETE', notify_uploader: true, review_note: 'confirmed' })
  })
})

describe('reviewCases', () => {
  it('decides each chosen case in turn and tells each uploader', async () => {
    const fake = fakeApi().on('patch', '/admin/content/malware-scan-cases/{id}/review', detail)
    await reviewCases(fake.api, { ids: [3, 8], decision: 'DELETE' })
    expect(fake.requests.map(request => new URL(request.url).pathname)).toEqual([
      '/admin/content/malware-scan-cases/3/review',
      '/admin/content/malware-scan-cases/8/review',
    ])
    const bodies = await Promise.all(fake.requests.map(request => request.json()))
    expect(bodies).toEqual([
      { decision: 'DELETE', notify_uploader: true },
      { decision: 'DELETE', notify_uploader: true },
    ])
  })
})

const paths = (requests: readonly Request[]) =>
  requests.map(request => [request.method, new URL(request.url).pathname])

describe('changeStalled', () => {
  it('checks each chosen file again or removes it, one after another', async () => {
    const fake = fakeApi()
      .on('post', '/admin/content/stalled-checks/{file_id}/recheck', undefined)
      .on('delete', '/admin/content/stalled-checks/{file_id}', undefined)
    await changeStalled(fake.api, { fileIds: [5, 6], action: 'recheck' })
    await changeStalled(fake.api, { fileIds: [5], action: 'remove' })
    expect(paths(fake.requests)).toEqual([
      ['POST', '/admin/content/stalled-checks/5/recheck'],
      ['POST', '/admin/content/stalled-checks/6/recheck'],
      ['DELETE', '/admin/content/stalled-checks/5'],
    ])
  })

  it('passes over a file that went with an earlier volume of its set', async () => {
    const fake = fakeApi().fail('delete', '/admin/content/stalled-checks/{file_id}', 404, {
      code: 440208,
      message: 'not stalled',
    })
    await expect(changeStalled(fake.api, { fileIds: [5, 6], action: 'remove' })).resolves.toBeNull()
    expect(paths(fake.requests)).toHaveLength(2)
  })

  it('stops at any other failure', async () => {
    const fake = fakeApi().fail('post', '/admin/content/stalled-checks/{file_id}/recheck', 500, {
      code: 500,
      message: 'down',
    })
    await expect(
      changeStalled(fake.api, { fileIds: [5, 6], action: 'recheck' }),
    ).rejects.toMatchObject({ status: 500 })
    expect(paths(fake.requests)).toHaveLength(1)
  })
})
