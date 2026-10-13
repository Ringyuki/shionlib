import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import {
  flagged,
  pendingStatus,
  waitingLimit,
  type CaseDetail,
  type Filter,
  type Opened,
  type ScanCase,
  type Stalled,
} from './admin-check'
import type { CaseReview, StalledChange } from './admin-check.schema'

export type Listing = {
  filter: Filter
  waiting: ScanCase[]
  stalled: Stalled[]
  records: ScanCase[]
  total: number
  opened: Opened | undefined
}

async function inspectionOf(api: ApiClient, detail: CaseDetail) {
  if (detail.resource === null) {
    return undefined
  }
  try {
    const inspections = await api.get('/inspection/resource/{resource_id}', {
      params: { path: { resource_id: detail.resource.id } },
    })
    return flagged(inspections ?? [], detail.detected_viruses ?? [])
  } catch (error) {
    if (error instanceof ApiError) {
      return undefined
    }
    throw error
  }
}

async function loadOpened(api: ApiClient, id: number): Promise<Opened | undefined> {
  try {
    const detail = await api.get('/admin/content/malware-scan-cases/{id}', {
      params: { path: { id } },
    })
    const [uploader, policy, inspection] = await Promise.all([
      api.get('/admin/users/{id}', { params: { path: { id: detail.uploader.id } } }),
      api.get('/admin/content/malware-scan-policy'),
      inspectionOf(api, detail),
    ])
    return { detail, uploader, policy, inspection }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined
    }
    throw error
  }
}

export async function loadChecks(
  api: ApiClient,
  filter: Filter,
  pageSize: number,
): Promise<Listing> {
  const [waiting, stalled, records, opened] = await Promise.all([
    api.get('/admin/content/malware-scan-cases', {
      params: {
        query: {
          page: 1,
          pageSize: waitingLimit,
          status: pendingStatus,
          sortBy: 'review_deadline',
          sortOrder: 'asc',
        },
      },
    }),
    api.get('/admin/content/stalled-checks'),
    api.get('/admin/content/malware-scan-cases', {
      params: {
        query: {
          page: filter.page,
          pageSize,
          reviewed: true,
          sortBy: 'reviewed_at',
          sortOrder: 'desc',
          ...(filter.outcome === undefined ? {} : { decision_source: filter.outcome }),
        },
      },
    }),
    filter.opened === undefined ? undefined : loadOpened(api, filter.opened),
  ])
  return {
    filter,
    waiting: waiting.items ?? [],
    stalled: stalled ?? [],
    records: records.items ?? [],
    total: records.meta.totalItems,
    opened,
  }
}

export function reviewCase(api: ApiClient, review: CaseReview): Promise<CaseDetail> {
  return api.patch('/admin/content/malware-scan-cases/{id}/review', {
    params: { path: { id: review.id } },
    body: {
      decision: review.decision,
      notify_uploader: review.notify,
      ...(review.note.trim() === '' ? {} : { review_note: review.note.trim() }),
    },
  })
}

export async function changeStalled(api: ApiClient, change: StalledChange): Promise<null> {
  const params = { path: { file_id: change.fileId } }
  if (change.action === 'recheck') {
    await api.post('/admin/content/stalled-checks/{file_id}/recheck', { params })
  } else {
    await api.delete('/admin/content/stalled-checks/{file_id}', { params })
  }
  return null
}
