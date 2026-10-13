import { AlertDialog } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { SettingDrafts } from '../use-setting-drafts'

export function LeaveDialog({ guard }: { guard: SettingDrafts['guard'] }) {
  const t = useTranslations('adminSetting')
  return (
    <AlertDialog
      title={t('leaveConfirm')}
      confirmText={t('discard')}
      cancelText={t('stay')}
      tone="danger"
      open={guard.leaving}
      onOpenChange={open => {
        if (!open) {
          guard.stay()
        }
      }}
      onConfirm={() => guard.leave()}
    />
  )
}
