import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import {
  everyStage,
  type Filter,
  type Opened,
  type UploadDetail,
  type UploadItem,
} from './admin-upload'
import type { UploadTermination } from './admin-upload.schema'

export type Listing = {
  filter: Filter
  uploads: UploadItem[]
  total: number
  opened: UploadDetail | undefined
}

async function loadOpened(api: ApiClient, opened: Opened): Promise<UploadDetail | undefined> {
  const params = { params: { path: { id: opened.id } } }
  try {
    return opened.kind === 'session'
      ? await api.get('/admin/uploads/{id}', params)
      : await api.get('/admin/uploads/attempts/{id}', params)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined
    }
    throw error
  }
}

export async function loadUploads(
  api: ApiClient,
  filter: Filter,
  pageSize: number,
): Promise<Listing> {
  const [page, opened] = await Promise.all([
    api.get('/admin/uploads', {
      params: {
        query: {
          page: filter.page,
          pageSize,
          ...(filter.stage === everyStage ? {} : { stage: filter.stage }),
          ...(filter.query === '' ? {} : { search: filter.query }),
          ...(filter.user === undefined ? {} : { userId: filter.user }),
          ...(filter.failed ? { failed: true } : {}),
        },
      },
    }),
    filter.opened === undefined ? undefined : loadOpened(api, filter.opened),
  ])
  return { filter, uploads: page.items ?? [], total: page.meta.totalItems, opened }
}

export async function terminateUpload(
  api: ApiClient,
  termination: UploadTermination,
): Promise<null> {
  await api.post('/admin/uploads/{id}/terminate', { params: { path: { id: termination.id } } })
  return null
}
