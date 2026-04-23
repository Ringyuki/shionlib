'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { FieldSyncButton } from '@/components/edit/sync/FieldSyncButton'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { applyData, applyEndpoint, batchPreviewEndpoint } from './endpoints'
import { dispatchFieldSyncApplied } from './field-sync-events'
import { getAvailableFieldSyncTargets } from './field-sync-config'
import type { FieldSyncTarget } from '../types/field-sync'

interface DeveloperFieldSyncButtonProps {
  developerId: number
}

export const DeveloperFieldSyncButton = ({ developerId }: DeveloperFieldSyncButtonProps) => {
  const t = useTranslations('Components.Common.Edit.FieldSync')
  const { developerPermissions: permissions } = useEditPermissionStore()
  const fields = useMemo(() => getAvailableFieldSyncTargets(permissions), [permissions])

  return (
    <FieldSyncButton
      fields={fields}
      batchPreviewEndpoint={batchPreviewEndpoint(developerId)}
      applyEndpoint={() => applyEndpoint(developerId)}
      applyData={applyData}
      onApplied={dispatchFieldSyncApplied}
      getFieldLabel={(field: FieldSyncTarget) => t(`field.${field}` as any)}
    />
  )
}
