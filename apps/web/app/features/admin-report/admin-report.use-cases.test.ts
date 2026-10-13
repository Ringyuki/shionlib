import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { Schema } from '~/shared/api/types'
import type { Filter, ReportDetail } from './admin-report'
import { loadReports, reviewReport } from './admin-report.use-cases'

const meta = { currentPage: 1, itemCount: 0, itemsPerPage: 20, totalItems: 46, totalPages: 3 }

const member = { id: 7, name: 'haruka', avatar: null, is_sponsor: false, role: 1, status: 1 }

const detail: ReportDetail = {
  id: 47,
  reason: 'MALWARE',
  detail: 'flagged',
  status: 'PENDING',
  malicious_level: 'CRITICAL',
  process_note: null,
  processed_at: null,
  reporter_penalty_applied: false,
  reported_penalty_applied: false,
  created: '2026-10-12T00:00:00.000Z',
  updated: '2026-10-12T00:00:00.000Z',
  resource: {
    id: 3,
    game_id: 1,
    note: null,
    game: { id: 1, title_jp: 'ゲーム', title_zh: '', title_en: '' },
    files: null,
  },
  reporter: member,
  reporter_record: { filed: 4, invalid: 3, next_invalid: 4 },
  reported_user: { ...member, id: 9, name: 'sakura' },
  processor: null,
}

const uploader: Schema<'AdminUserDetailDTO'> = {
  id: 9,
  name: 'sakura',
  email: 'sakura@example.test',
  avatar: null,
  cover: null,
  role: 1,
  status: 1,
  lang: 'zh',
  content_limit: 1,
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-01T00:00:00.000Z',
  last_login_at: null,
  two_factor_enabled: false,
  sponsor_expires_at: null,
  upload: {
    tier: 'trusted',
    approved: 86,
    trusted: true,
    frozen_until: null,
    stored: 0,
    stored_limit: null,
    in_flight: 0,
    in_flight_limit: 1,
    max_file_size: null,
  },
  violations: 0,
  counts: { comments: 0, resources: 86, favorites: 0, edits: 0 },
  latest_ban: null,
}

const policy: Schema<'ReportPolicyDTO'> = {
  levels: null,
  false_report_steps: null,
  false_report_window_days: 30,
  violation_freeze_seconds: 0,
}

const filter: Filter = {
  status: 'PENDING',
  reason: undefined,
  reporter: undefined,
  uploader: undefined,
  page: 1,
  opened: undefined,
}

const listed = () =>
  fakeApi().on('get', '/admin/content/download-resource-reports', { items: null, meta })

const queryOf = (requests: Request[], path: string) =>
  requests.map(request => new URL(request.url)).find(url => url.pathname === path)?.searchParams

describe('loadReports', () => {
  it('asks for one page of the chosen status and reason', async () => {
    const fake = listed()
    const listing = await loadReports(
      fake.api,
      { ...filter, reason: 'MALWARE', reporter: 7, uploader: 9, page: 2 },
      20,
    )
    expect(listing).toMatchObject({ reports: [], total: 46, opened: undefined })
    const query = queryOf(fake.requests, '/admin/content/download-resource-reports')
    expect(Object.fromEntries(query ?? [])).toEqual({
      page: '2',
      pageSize: '20',
      status: 'PENDING',
      reason: 'MALWARE',
      reporter_id: '7',
      reported_user_id: '9',
    })
  })

  it('leaves the status out when every report is wanted', async () => {
    const fake = listed()
    await loadReports(fake.api, { ...filter, status: 'ALL' }, 20)
    expect(queryOf(fake.requests, '/admin/content/download-resource-reports')?.has('status')).toBe(
      false,
    )
  })

  it('loads the opened report with its uploader and the policy', async () => {
    const fake = listed()
      .on('get', '/admin/content/download-resource-reports/{id}', detail)
      .on('get', '/admin/users/{id}', uploader)
      .on('get', '/admin/content/download-resource-report-policy', policy)
    const listing = await loadReports(fake.api, { ...filter, opened: 47 }, 20)
    expect(listing.opened).toEqual({ detail, uploader, policy })
    expect(fake.requests.map(request => new URL(request.url).pathname)).toContain('/admin/users/9')
  })

  it('opens nothing when the report is gone', async () => {
    const fake = listed().fail('get', '/admin/content/download-resource-reports/{id}', 404, {
      code: 440301,
      message: 'not found',
    })
    await expect(loadReports(fake.api, { ...filter, opened: 47 }, 20)).resolves.toMatchObject({
      opened: undefined,
    })
  })

  it('surfaces other failures of the opened report', async () => {
    const fake = listed().fail('get', '/admin/content/download-resource-reports/{id}', 500, {
      code: 500,
      message: 'down',
    })
    await expect(loadReports(fake.api, { ...filter, opened: 47 }, 20)).rejects.toMatchObject({
      status: 500,
    })
  })
})

describe('reviewReport', () => {
  const review = {
    id: 47,
    level: 'HIGH',
    remove: true,
    note: '  misleading  ',
    notify: true,
  } as const

  it('sends the level and the removal only with a valid verdict', async () => {
    const fake = fakeApi().on(
      'patch',
      '/admin/content/download-resource-reports/{id}/review',
      detail,
    )
    await reviewReport(fake.api, { ...review, verdict: 'VALID' })
    await reviewReport(fake.api, { ...review, verdict: 'INVALID', note: ' ', notify: false })
    const [valid, invalid] = await Promise.all(fake.requests.map(request => request.json()))
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe(
      '/admin/content/download-resource-reports/47/review',
    )
    expect(valid).toEqual({
      verdict: 'VALID',
      notify: true,
      process_note: 'misleading',
      malicious_level: 'HIGH',
      remove_resource: true,
    })
    expect(invalid).toEqual({ verdict: 'INVALID', notify: false })
  })
})
