'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { FieldSyncButton } from '@/components/edit/sync/FieldSyncButton'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { applyEndpoint, batchPreviewEndpoint, isScalarSyncField } from './endpoints'
import { dispatchFieldSyncApplied } from './field-sync-events'
import { getAvailableFieldSyncTargets } from './field-sync-config'
import type { FieldSyncTarget } from '../types/field-sync'

interface GameFieldSyncButtonProps {
  gameId: number
}

export const GameFieldSyncButton = ({ gameId }: GameFieldSyncButtonProps) => {
  const t = useTranslations('Components.Common.Edit.FieldSync')
  const { gamePermissions: permissions } = useEditPermissionStore()
  const fields = useMemo(() => getAvailableFieldSyncTargets(permissions), [permissions])

  return (
    <FieldSyncButton
      fields={fields}
      batchPreviewEndpoint={batchPreviewEndpoint(gameId)}
      applyEndpoint={(field: FieldSyncTarget) => applyEndpoint(gameId, field)}
      applyData={(field: FieldSyncTarget, candidateIds: string[]) =>
        isScalarSyncField(field) ? { field, candidateIds } : { candidateIds }
      }
      onApplied={dispatchFieldSyncApplied}
      getFieldLabel={field => t(`field.${field}` as any)}
    />
  )
}
