import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import { fileBody } from '~/shared/api/file-body'
import {
  draftOf,
  rangeDays,
  valuesOf,
  type AdminAd,
  type Filter,
  type ImageKind,
  type Overview,
  type Report,
  type SlotSummary,
} from './admin-ad'
import type { AdChange } from './admin-ad.schema'

export type Opened = {
  ad: AdminAd
  report: Report
}

export type Listing = {
  filter: Filter
  overview: Overview
  ads: AdminAd[]
  total: number
  opened: Opened | undefined
}

async function loadOpened(api: ApiClient, filter: Filter): Promise<Opened | undefined> {
  if (filter.ad === undefined) {
    return undefined
  }
  const path = { id: filter.ad }
  try {
    const [ad, report] = await Promise.all([
      api.get('/admin/ad/{id}', { params: { path } }),
      api.get('/admin/ad/{id}/report', {
        params: { path, query: { days: rangeDays[filter.days] } },
      }),
    ])
    return { ad, report }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined
    }
    throw error
  }
}

export async function loadAds(api: ApiClient, filter: Filter, pageSize: number): Promise<Listing> {
  const [overview, page, opened] = await Promise.all([
    api.get('/admin/ad/overview'),
    api.get('/admin/ad', {
      params: {
        query: {
          page: filter.page,
          pageSize,
          ...(filter.status === undefined ? {} : { status: filter.status }),
          ...(filter.slot === undefined ? {} : { slot: filter.slot }),
        },
      },
    }),
    loadOpened(api, filter),
  ])
  return { filter, overview, ads: page.items ?? [], total: page.meta.totalItems, opened }
}

export async function loadSlots(api: ApiClient): Promise<{ slots: SlotSummary[] }> {
  return { slots: (await api.get('/admin/ad/slots')) ?? [] }
}

export async function changeAd(api: ApiClient, change: AdChange): Promise<null> {
  switch (change.action) {
    case 'create':
      await api.post('/admin/ad', { body: draftOf(change.values) })
      return null
    case 'update':
      await api.put('/admin/ad/{id}', {
        params: { path: { id: change.id } },
        body: draftOf(change.values),
      })
      return null
    case 'enabled': {
      const path = { id: change.id }
      const ad = await api.get('/admin/ad/{id}', { params: { path } })
      await api.put('/admin/ad/{id}', {
        params: { path },
        body: draftOf({ ...valuesOf(ad), enabled: change.enabled }),
      })
      return null
    }
    case 'remove':
      await api.delete('/admin/ad/{id}', { params: { path: { id: change.id } } })
      return null
  }
}

export async function uploadImage(api: ApiClient, kind: ImageKind, image: File): Promise<string> {
  const body = fileBody('file', image)
  const uploaded =
    kind === 'banner'
      ? await api.put('/uploads/small/ad/banner', body)
      : kind === 'side-image'
        ? await api.put('/uploads/small/ad/side-image', body)
        : await api.put('/uploads/small/ad/side-icon', body)
  return uploaded.key
}
