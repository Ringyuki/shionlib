import type { ApiClient } from '~/shared/api/client'
import { needsSimulator } from './resource'
import type { ResourceDeletion, ResourceEdit, ResourceReport } from './resource.schema'

export async function loadGameResources(api: ApiClient, gameId: number) {
  const resources = await api.get('/game/{id}/download-source', {
    params: { path: { id: gameId } },
  })
  return resources ?? []
}

export async function loadFileHistory(api: ApiClient, fileId: number) {
  const history = await api.get('/game/download-source/file/{fileId}/history', {
    params: { path: { fileId } },
  })
  return history ?? []
}

export async function reportResource(api: ApiClient, report: ResourceReport) {
  const detail = report.detail.trim()
  await api.post('/game/download-source/{id}/report', {
    params: { path: { id: report.resourceId } },
    body: { reason: report.reason, ...(detail === '' ? {} : { detail }) },
  })
}

export async function editResource(api: ApiClient, edit: ResourceEdit) {
  const simulator =
    needsSimulator(edit.platform) && edit.simulator !== '' ? edit.simulator : undefined
  await api.patch('/game/download-source/{id}', {
    params: { path: { id: edit.resourceId } },
    body: {
      platform: edit.platform,
      language: edit.language,
      note: edit.note.trim(),
      ...(simulator === undefined ? {} : { simulator }),
    },
  })
}

export async function deleteResource(api: ApiClient, deletion: ResourceDeletion) {
  await api.delete('/game/download-source/{id}', { params: { path: { id: deletion.resourceId } } })
}
