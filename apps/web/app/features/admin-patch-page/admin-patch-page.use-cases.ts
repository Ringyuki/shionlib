import type { ApiClient } from '~/shared/api/client'
import type { Loaded, PatchPage } from './admin-patch-page'
import type { Assignment, Lookup } from './admin-patch-page.schema'

export async function loadPatchPages(api: ApiClient, id: number): Promise<Loaded> {
  const pages = await api.get('/admin/content/games/{id}/patch-pages', { params: { path: { id } } })
  return { id, pages }
}

export async function assignPatchPages(api: ApiClient, assignment: Assignment): Promise<null> {
  await api.put('/admin/content/games/{id}/patch-pages', {
    params: { path: { id: assignment.id } },
    body: { manual: assignment.manual, pages: assignment.manual ? assignment.pages : [] },
  })
  return null
}

export function lookUpPatchPage(api: ApiClient, lookup: Lookup): Promise<PatchPage> {
  return api.post('/admin/content/patch-pages/lookup', { body: { address: lookup.address } })
}
