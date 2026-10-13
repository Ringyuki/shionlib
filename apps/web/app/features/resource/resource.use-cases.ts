import { loadInspections } from '~/features/inspection'
import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import type { ComposeMode, WizardStep } from './resource-composition'
import { loadComposer, loadLineage } from './resource-composition.use-cases'
import { needsSimulator } from './resource'
import { resourceInfo } from './resource-info'
import { nameBody, type NameQuery } from './resource-name'
import type { ResourcePage } from './resource-page'
import type {
  FileRemoval,
  FileRename,
  ResourceDeletion,
  ResourceEdit,
  ResourceReport,
} from './resource.schema'

export async function loadGameResources(api: ApiClient, gameId: number) {
  const resources = await api.get('/game/{id}/download-source', {
    params: { path: { id: gameId } },
  })
  return resources ?? []
}

export async function loadMoyuEntries(api: ApiClient, gameId: number) {
  try {
    const entries = await api.get('/moyu/game/{gameId}/patches', {
      params: { path: { gameId } },
    })
    return entries ?? []
  } catch (error) {
    if (error instanceof ApiError) {
      return []
    }
    throw error
  }
}

export async function loadResourcePage(api: ApiClient, id: number): Promise<ResourcePage> {
  const { resource, game } = await api.get('/game/download-source/{id}', {
    params: { path: { id } },
  })
  const [header, inspections, lineage] = await Promise.all([
    api.get('/game/{id}/header', { params: { path: { id: game.id } } }),
    loadInspections(api, id),
    loadLineage(api, id),
  ])
  return { resource, game: header, inspections, lineage }
}

export async function loadResourceEvents(api: ApiClient, id: number) {
  const events = await api.get('/game/download-source/{id}/events', { params: { path: { id } } })
  return events ?? []
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
      ...resourceInfo(edit, edit.language),
    },
  })
}

export function previewName(api: ApiClient, query: NameQuery) {
  return api.post('/game/{id}/download-source/name', {
    params: { path: { id: query.gameId } },
    body: nameBody(query),
  })
}

export function readName(api: ApiClient, fileName: string) {
  return api.post('/game/download-source/name/read', { body: { file_name: fileName } })
}

export async function deleteResource(api: ApiClient, deletion: ResourceDeletion) {
  await api.delete('/game/download-source/{id}', { params: { path: { id: deletion.resourceId } } })
}

export async function renameFile(api: ApiClient, rename: FileRename) {
  await api.patch('/game/download-source/file/{fileId}', {
    params: { path: { fileId: rename.fileId } },
    body: { file_name: rename.name.trim() },
  })
}

export async function removeFile(api: ApiClient, removal: FileRemoval) {
  await api.delete('/game/download-source/file/{fileId}', {
    params: { path: { fileId: removal.fileId } },
  })
}

type UploadQuery = {
  gameId: number | undefined
  mode: ComposeMode
  compositionId: number | undefined
  step: WizardStep | undefined
}

export async function loadUploadPage(api: ApiClient, query: UploadQuery) {
  const composer = query.mode === 'compose' ? await loadComposer(api, query) : null
  const gameId = composer?.composition?.game_id ?? query.gameId
  const [game, allowance] = await Promise.all([
    gameId === undefined
      ? null
      : api.get('/game/{id}/header', { params: { path: { id: gameId } } }),
    loadAllowance(api),
  ])
  return { game, allowance, mode: query.mode, composer }
}

export function loadAllowance(api: ApiClient) {
  return api.get('/uploads/quota').catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }
    throw error
  })
}
