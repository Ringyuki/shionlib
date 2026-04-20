'use client'

import { useTranslations } from 'next-intl'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/shionui/Button'
import { FieldSyncModal } from './FieldSyncModal'
import { useFieldSyncController } from './useFieldSyncController'
import type { FieldSyncTarget } from './types'

interface FieldSyncButtonProps {
  gameId: number
  field: FieldSyncTarget
  onApplied: () => void | Promise<void>
  compact?: boolean
}

export type { GameScalarSyncField } from './types'

export const FieldSyncButton = ({ gameId, field, onApplied, compact }: FieldSyncButtonProps) => {
  const t = useTranslations('Components.Game.Edit.FieldSync')
  const controller = useFieldSyncController({ gameId, field, onApplied })

  return (
    <>
      <Button
        type="button"
        intent="secondary"
        appearance="outline"
        size={compact ? 'sm' : 'default'}
        onClick={controller.loadPreview}
        loading={controller.loading}
        renderIcon={<RefreshCw className="size-4" />}
      >
        {t('button')}
      </Button>

      <FieldSyncModal
        field={field}
        open={controller.open}
        onOpenChange={controller.setOpen}
        preview={controller.preview}
        selected={controller.selected}
        setSelected={controller.setSelected}
        applying={controller.applying}
        onApply={controller.applySelected}
      />
    </>
  )
}
