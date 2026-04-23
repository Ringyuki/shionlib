import type { FieldSyncTarget } from '../types/field-sync'

export const batchPreviewEndpoint = (developerId: number) =>
  `/developer/${developerId}/edit/sync/preview`

export const applyEndpoint = (developerId: number) =>
  `/developer/${developerId}/edit/scalar/sync/apply`

export const applyData = (field: FieldSyncTarget, candidateIds: string[]) => ({
  field,
  candidateIds,
})
