'use client'

import { useCallback, useEffect } from 'react'
import type { FieldSyncTarget } from '../types/field-sync'

interface FieldSyncAppliedDetail<TField extends FieldSyncTarget = FieldSyncTarget> {
  fields: TField[]
}

export const dispatchFieldSyncApplied = <TField extends FieldSyncTarget>(
  eventName: string,
  fields: TField[],
) => {
  window.dispatchEvent(
    new CustomEvent<FieldSyncAppliedDetail<TField>>(eventName, {
      detail: { fields },
    }),
  )
}

export const useFieldSyncAppliedEvent = <TField extends FieldSyncTarget>(
  eventName: string,
  onApplied: (fields: TField[]) => void,
) => {
  useEffect(() => {
    const listener = (event: Event) => {
      onApplied((event as CustomEvent<FieldSyncAppliedDetail<TField>>).detail.fields)
    }

    window.addEventListener(eventName, listener)
    return () => window.removeEventListener(eventName, listener)
  }, [eventName, onApplied])
}

export const useFieldSyncApplied = <TField extends FieldSyncTarget>(
  eventName: string,
  field: TField,
  onApplied: () => void | Promise<void>,
) => {
  const handleApplied = useCallback(
    (fields: TField[]) => {
      if (fields.includes(field)) void onApplied()
    },
    [field, onApplied],
  )

  useFieldSyncAppliedEvent(eventName, handleApplied)
}
