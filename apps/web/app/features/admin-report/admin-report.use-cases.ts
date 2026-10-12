import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import {
  everyStatus,
  type Filter,
  type Opened,
  type Report,
  type ReportDetail,
} from './admin-report'
import type { Review } from './admin-report.schema'

export type Listing = {
  filter: Filter
  reports: Report[]
  total: number
  opened: Opened | undefined
}

async function loadOpened(api: ApiClient, id: number): Promise<Opened | undefined> {
  try {
    const detail = await api.get('/admin/content/download-resource-reports/{id}', {
      params: { path: { id } },
    })
    const [uploader, policy] = await Promise.all([
      api.get('/admin/users/{id}', { params: { path: { id: detail.reported_user.id } } }),
      api.get('/admin/content/download-resource-report-policy'),
    ])
    return { detail, uploader, policy }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined
    }
    throw error
  }
}

export async function loadReports(
  api: ApiClient,
  filter: Filter,
  pageSize: number,
): Promise<Listing> {
  const [page, opened] = await Promise.all([
    api.get('/admin/content/download-resource-reports', {
      params: {
        query: {
          page: filter.page,
          pageSize,
          ...(filter.status === everyStatus ? {} : { status: filter.status }),
          ...(filter.reason === undefined ? {} : { reason: filter.reason }),
          ...(filter.reporter === undefined ? {} : { reporter_id: filter.reporter }),
          ...(filter.uploader === undefined ? {} : { reported_user_id: filter.uploader }),
        },
      },
    }),
    filter.opened === undefined ? undefined : loadOpened(api, filter.opened),
  ])
  return { filter, reports: page.items ?? [], total: page.meta.totalItems, opened }
}

export function reviewReport(api: ApiClient, review: Review): Promise<ReportDetail> {
  const valid = review.verdict === 'VALID'
  return api.patch('/admin/content/download-resource-reports/{id}/review', {
    params: { path: { id: review.id } },
    body: {
      verdict: review.verdict,
      notify: review.notify,
      ...(review.note.trim() === '' ? {} : { process_note: review.note.trim() }),
      ...(valid ? { malicious_level: review.level, remove_resource: review.remove } : {}),
    },
  })
}
