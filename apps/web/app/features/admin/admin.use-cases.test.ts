import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import { loadOverview, loadPending } from './admin.use-cases'

const meta = { currentPage: 1, itemCount: 0, itemsPerPage: 10, totalItems: 0, totalPages: 0 }

const pending = { reports: 1, malware_cases: 0, stalled_files: 0, comments: 0, walkthroughs: 0 }

function overviewApi() {
  return fakeApi()
    .on('get', '/admin/content/malware-scan-cases', { items: null, meta })
    .on('get', '/admin/content/stalled-checks', null)
    .on('get', '/admin/content/download-resource-reports', { items: null, meta })
    .on('get', '/admin/comments', { items: null, meta })
    .on('get', '/admin/walkthroughs', { items: null, meta })
    .on('get', '/admin/stats/overview', {
      totalGames: 1,
      totalUsers: 2,
      totalComments: 3,
      totalDownloads: 4,
      totalViews: 5,
      totalResources: 6,
      totalCharacters: 7,
      totalDevelopers: 8,
      newGamesToday: 0,
      newUsersToday: 0,
      newResourcesToday: 0,
      newCommentsToday: 0,
      downloadsToday: 0,
      viewsToday: 0,
    })
    .on('get', '/admin/stats/trends', null)
    .on('get', '/admin/stats/storage', {
      spool_capacity: 10,
      spool_available: 4,
      spool_reserve: 1,
      uploading: { files: 0, bytes: 0 },
      awaiting_check: 0,
      awaiting_store: 0,
      stored: { files: 6, bytes: 60 },
    })
}

describe('loadPending', () => {
  it('reads the counts the sidebar shows', async () => {
    const { api } = fakeApi().on('get', '/admin/pending', pending)
    await expect(loadPending(api)).resolves.toEqual(pending)
  })
})

describe('loadOverview', () => {
  it('asks only for what is still waiting and for the chosen range', async () => {
    const fake = overviewApi()
    const overview = await loadOverview(fake.api, 7)
    expect(overview).toMatchObject({ queue: [], trends: [], days: 7 })
    expect(overview.overview.totalResources).toBe(6)
    const asked = fake.requests.map(request => new URL(request.url))
    const cases = asked.find(url => url.pathname === '/admin/content/malware-scan-cases')
    expect(cases?.searchParams.get('status')).toBe('PENDING')
    expect(cases?.searchParams.get('sortBy')).toBe('review_deadline')
    expect(cases?.searchParams.get('sortOrder')).toBe('asc')
    const reports = asked.find(url => url.pathname === '/admin/content/download-resource-reports')
    expect(reports?.searchParams.get('status')).toBe('PENDING')
    expect(asked.find(url => url.pathname === '/admin/comments')?.searchParams.get('status')).toBe(
      '2',
    )
    expect(
      asked.find(url => url.pathname === '/admin/walkthroughs')?.searchParams.get('held'),
    ).toBe('true')
    const trends = asked.find(url => url.pathname === '/admin/stats/trends')
    expect(trends?.searchParams.get('days')).toBe('7')
  })
})
