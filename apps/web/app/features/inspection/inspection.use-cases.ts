import type { ApiClient } from '~/shared/api/client'
import {
  branchKey,
  entryPageSize,
  expandable,
  type Branches,
  type Contents,
  type EntryPage,
  type Inspection,
  type View,
} from './inspection'
import type { WantedPage, WantedView } from './inspection.schema'

export async function loadInspections(api: ApiClient, resourceId: number): Promise<Inspection[]> {
  const inspections = await api.get('/inspection/resource/{resource_id}', {
    params: { path: { resource_id: resourceId } },
  })
  return inspections ?? []
}

export async function loadEntryPage(api: ApiClient, request: WantedPage): Promise<EntryPage> {
  const path = { id: request.inspectionId }
  if (request.query !== '') {
    const found = await api.get('/inspection/{id}/search', {
      params: { path, query: { q: request.query, page: request.page, pageSize: entryPageSize } },
    })
    return { entries: found.items ?? [], total: found.meta.totalItems }
  }
  const listed = await api.get('/inspection/{id}/entries', {
    params: {
      path,
      query: {
        page: request.page,
        pageSize: entryPageSize,
        ...(request.parent === null ? {} : { parent_id: request.parent }),
      },
    },
  })
  return { entries: listed.items ?? [], total: listed.meta.totalItems }
}

export function chosenInspection(
  inspections: readonly Inspection[],
  file: number | null,
): Inspection | undefined {
  return inspections.find(inspection => inspection.id === file) ?? inspections[0]
}

export async function loadContents(
  api: ApiClient,
  resourceId: number,
  wanted: WantedView,
): Promise<Contents | null> {
  const chosen = chosenInspection(await loadInspections(api, resourceId), wanted.file)
  if (chosen === undefined) {
    return null
  }
  const view: View = { inspectionId: chosen.id, query: wanted.query }
  if (chosen.status !== 'ready') {
    return { view, branches: {}, expanded: [] }
  }
  const request = { ...view, parent: null, page: 1 }
  const top = await loadEntryPage(api, request)
  const branches: Branches = { [branchKey(null)]: { ...top, loading: false } }
  const [only] = top.entries
  if (view.query !== '' || top.total !== 1 || only === undefined || !expandable(only)) {
    return { view, branches, expanded: [] }
  }
  const inside = await loadEntryPage(api, { ...request, parent: only.id })
  return {
    view,
    branches: { ...branches, [branchKey(only.id)]: { ...inside, loading: false } },
    expanded: [only.id],
  }
}

export function loadTextPreview(api: ApiClient, entryId: number) {
  return api.get('/inspection/entry/{entry_id}/text', { params: { path: { entry_id: entryId } } })
}

export function loadImagePreview(api: ApiClient, entryId: number) {
  return api.file('/inspection/entry/{entry_id}/image', {
    params: { path: { entry_id: entryId } },
  })
}
