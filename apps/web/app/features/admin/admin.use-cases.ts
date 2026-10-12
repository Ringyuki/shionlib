import type { ApiClient } from '~/shared/api/client'
import type { Pending } from './admin'
import { queueLength, queueOf } from './admin-queue'
import type { TrendRange } from './admin-stats'

export function loadPending(api: ApiClient): Promise<Pending> {
  return api.get('/admin/pending')
}

export async function loadQueue(api: ApiClient) {
  const first = { page: 1, pageSize: queueLength }
  const [cases, stalled, reports] = await Promise.all([
    api.get('/admin/content/malware-scan-cases', {
      params: {
        query: { ...first, status: 'PENDING', sortBy: 'review_deadline', sortOrder: 'asc' },
      },
    }),
    api.get('/admin/content/stalled-checks'),
    api.get('/admin/content/download-resource-reports', {
      params: { query: { ...first, status: 'PENDING' } },
    }),
  ])
  return queueOf({
    cases: cases.items ?? [],
    stalled: stalled ?? [],
    reports: reports.items ?? [],
  })
}

export async function loadOverview(api: ApiClient, days: TrendRange) {
  const [queue, overview, trends, storage] = await Promise.all([
    loadQueue(api),
    api.get('/admin/stats/overview'),
    api.get('/admin/stats/trends', { params: { query: { days } } }),
    api.get('/admin/stats/storage'),
  ])
  return { queue, overview, trends: trends ?? [], storage, days }
}
