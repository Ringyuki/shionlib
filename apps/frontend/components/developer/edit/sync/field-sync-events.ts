'use client'

import {
  dispatchFieldSyncApplied as dispatchSyncApplied,
  useFieldSyncAppliedEvent as useSyncAppliedEvent,
} from '@/components/edit/sync/field-sync-events'
import type { FieldSyncTarget } from '../types/field-sync'

export const DEVELOPER_FIELD_SYNC_APPLIED_EVENT = 'shionlib:developer-field-sync-applied'

export const dispatchFieldSyncApplied = (fields: FieldSyncTarget[]) => {
  dispatchSyncApplied(DEVELOPER_FIELD_SYNC_APPLIED_EVENT, fields)
}

export const useFieldSyncAppliedEvent = (onApplied: (fields: FieldSyncTarget[]) => void) => {
  useSyncAppliedEvent(DEVELOPER_FIELD_SYNC_APPLIED_EVENT, onApplied)
}
