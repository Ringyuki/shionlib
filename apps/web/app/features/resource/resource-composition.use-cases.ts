import type { ApiClient } from '~/shared/api/client'
import { ApiError } from '~/shared/api/error'
import type { Composer, Composition, WizardStep } from './resource-composition'
import { reachedStep, usableFirst } from './resource-composition'
import type { CompositionCommand, CompositionEdit } from './resource-composition.schema'

type ComposerQuery = { gameId: number | undefined; compositionId?: number; step?: WizardStep }

function absent(error: unknown) {
  if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
    return null
  }
  throw error
}

export async function loadComposer(api: ApiClient, query: ComposerQuery): Promise<Composer> {
  const composition =
    query.compositionId === undefined
      ? null
      : await api
          .get('/composition/{id}', { params: { path: { id: query.compositionId } } })
          .catch(absent)
  const gameId = composition?.game_id ?? query.gameId
  const bases =
    gameId === undefined
      ? null
      : await api
          .get('/game/{gameId}/composition/bases', { params: { path: { gameId } } })
          .catch(absent)
  return {
    composition,
    bases: usableFirst(bases ?? []),
    step: reachedStep(query.step, composition),
  }
}

function editBody(edit: CompositionEdit) {
  const translation = edit.translation === '' ? undefined : edit.translation
  const patched = translation === 'group' || translation === 'machine'
  return {
    language: edit.language,
    translation,
    translators: translation === 'group' ? edit.translators : [],
    patch_version: patched ? edit.patchVersion.trim() : undefined,
    release_url: patched ? edit.releaseUrl.trim() : undefined,
    keep_patch: edit.keepPatch,
    game_dir: edit.gameDir,
    patch_dir: edit.patchDir,
  }
}

export async function runCompositionCommand(
  api: ApiClient,
  command: CompositionCommand,
): Promise<Composition | null> {
  switch (command.intent) {
    case 'begin':
      if (command.replacing !== undefined) {
        await discardComposition(api, command.replacing)
      }
      return api.post('/game/{gameId}/composition', {
        params: { path: { gameId: command.gameId } },
        body: { base_resource_id: command.baseResourceId },
      })
    case 'edit':
      return api.patch('/composition/{id}', {
        params: { path: { id: command.compositionId } },
        body: editBody(command),
      })
    case 'start':
      return api.post('/composition/{id}/start', {
        params: { path: { id: command.compositionId } },
      })
    case 'retry':
      return api.post('/composition/{id}/retry', {
        params: { path: { id: command.compositionId } },
      })
    case 'discard':
      await discardComposition(api, command.compositionId)
      return null
    case 'detach':
      return api.delete(`/composition/{id}/${command.role}`, {
        params: { path: { id: command.compositionId } },
      })
  }
}

async function discardComposition(api: ApiClient, id: number) {
  await api.delete('/composition/{id}', { params: { path: { id } } }).catch(absent)
}

export async function loadOwnCompositions(api: ApiClient): Promise<Composition[]> {
  const found = await api.get('/composition/mine').catch(absent)
  return found ?? []
}

export function loadLineage(api: ApiClient, resourceId: number) {
  return api.get('/game/download-source/{resourceId}/composition', {
    params: { path: { resourceId } },
  })
}
