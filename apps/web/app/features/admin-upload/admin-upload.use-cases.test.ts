import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { Filter, UploadDetail } from './admin-upload'
import { loadUploads, terminateUpload } from './admin-upload.use-cases'

const meta = { currentPage: 1, itemCount: 0, itemsPerPage: 20, totalItems: 7750, totalPages: 388 }

const filter: Filter = {
  stage: 'all',
  query: '',
  user: undefined,
  failed: false,
  page: 1,
  opened: undefined,
}

const attempt: UploadDetail = {
  kind: 'attempt',
  id: 3,
  file_name: 'e2e-unreadable.7z',
  size: 1024,
  uploader: { id: 9, name: 'ringyuki' },
  stage: 'not_started',
  file_stage: null,
  rejection: null,
  received: 0,
  chunks: 0,
  game: null,
  failure_count: 1,
  started: '2026-10-15T08:00:00Z',
  session: null,
  target: null,
  held: false,
  failures: [],
}

const listed = () => fakeApi().on('get', '/admin/uploads', { items: null, meta })

const queryOf = (requests: Request[]) =>
  Object.fromEntries(new URL(requests[0]?.url ?? '').searchParams)

describe('loadUploads', () => {
  it('asks for one page of every upload', async () => {
    const fake = listed()
    await expect(loadUploads(fake.api, filter, 20)).resolves.toMatchObject({
      uploads: [],
      total: 7750,
      opened: undefined,
    })
    expect(queryOf(fake.requests)).toEqual({ page: '1', pageSize: '20' })
  })

  it('asks for the narrowed list', async () => {
    const fake = listed()
    await loadUploads(
      fake.api,
      { ...filter, stage: 'pending', query: 'zip', user: 9, failed: true },
      20,
    )
    expect(queryOf(fake.requests)).toMatchObject({
      stage: 'pending',
      search: 'zip',
      userId: '9',
      failed: 'true',
    })
  })

  it('opens an upload that never started through its failure', async () => {
    const fake = listed().on('get', '/admin/uploads/attempts/{id}', attempt)
    await expect(
      loadUploads(fake.api, { ...filter, opened: { kind: 'attempt', id: 3 } }, 20),
    ).resolves.toMatchObject({ opened: { id: 3 } })
    expect(fake.requests.map(request => new URL(request.url).pathname)).toContain(
      '/admin/uploads/attempts/3',
    )
  })

  it('opens nothing when the upload is gone', async () => {
    const fake = listed().fail('get', '/admin/uploads/{id}', 404, {
      code: 480101,
      message: 'gone',
    })
    await expect(
      loadUploads(fake.api, { ...filter, opened: { kind: 'session', id: 8 } }, 20),
    ).resolves.toMatchObject({ opened: undefined })
  })
})

describe('terminateUpload', () => {
  it('terminates the session', async () => {
    const fake = fakeApi().on('post', '/admin/uploads/{id}/terminate', undefined)
    await expect(terminateUpload(fake.api, { id: 8 })).resolves.toBeNull()
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/admin/uploads/8/terminate')
  })
})
