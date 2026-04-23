'use client'

import {
  dispatchFieldSyncApplied as dispatchSyncApplied,
  useFieldSyncApplied as useSyncApplied,
  useFieldSyncAppliedEvent as useSyncAppliedEvent,
} from '@/components/edit/sync/field-sync-events'
import type { FieldSyncTarget } from '../types/field-sync'

export const FIELD_SYNC_APPLIED_EVENT = 'shionlib:game-field-sync-applied'

export const dispatchFieldSyncApplied = (fields: FieldSyncTarget[]) => {
  dispatchSyncApplied(FIELD_SYNC_APPLIED_EVENT, fields)
}

export const useFieldSyncAppliedEvent = (onApplied: (fields: FieldSyncTarget[]) => void) => {
  useSyncAppliedEvent(FIELD_SYNC_APPLIED_EVENT, onApplied)
}

export const useFieldSyncApplied = (
  field: FieldSyncTarget,
  onApplied: () => void | Promise<void>,
) => {
  useSyncApplied(FIELD_SYNC_APPLIED_EVENT, field, onApplied)
}
