import type { FieldSyncTarget, GameScalarSyncField } from './types'

const scalarSyncFields = new Set<GameScalarSyncField>([
  'titles',
  'aliases',
  'intros',
  'release',
  'type',
  'platform',
  'extra',
  'staffs',
  'tags',
])

export const isScalarSyncField = (field: FieldSyncTarget): field is GameScalarSyncField =>
  scalarSyncFields.has(field as GameScalarSyncField)

export const previewEndpoint = (gameId: number, field: FieldSyncTarget) =>
  isScalarSyncField(field)
    ? `/game/${gameId}/edit/scalar/sync/preview`
    : `/game/${gameId}/edit/${field}/sync/preview`

export const applyEndpoint = (gameId: number, field: FieldSyncTarget) =>
  isScalarSyncField(field)
    ? `/game/${gameId}/edit/scalar/sync/apply`
    : `/game/${gameId}/edit/${field}/sync/apply`
