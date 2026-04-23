import type { FieldSyncTarget } from '../types/field-sync'

export const batchPreviewEndpoint = (characterId: number) =>
  `/character/${characterId}/edit/sync/preview`

export const applyEndpoint = (characterId: number) =>
  `/character/${characterId}/edit/scalar/sync/apply`

export const applyData = (field: FieldSyncTarget, candidateIds: string[]) => ({
  field,
  candidateIds,
})
