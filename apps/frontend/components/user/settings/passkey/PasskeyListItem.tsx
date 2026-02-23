'use client'

import { useTranslations } from 'next-intl'
import { PasskeyCredentialItem } from '@/interfaces/auth/passkey.interface'
import { PasskeyRemoveDialog } from '@/components/user/settings/passkey/PasskeyRemoveDialog'

interface PasskeyListItemProps {
  item: PasskeyCredentialItem
  removingId: number | null
  onRemove: (id: number) => void
}

const formatTime = (
  value: string | null | undefined,
  fallbackNever: string,
  fallbackUnknown: string,
) => {
  if (!value) return fallbackNever
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallbackUnknown
  return date.toLocaleString()
}

const formatDeviceType = (
  value: string | null | undefined,
  labels: { unknown: string; multiDevice: string; singleDevice: string },
) => {
  if (!value) return labels.unknown
  if (value === 'multiDevice') return labels.multiDevice
  if (value === 'singleDevice') return labels.singleDevice
  return value
}

export const PasskeyListItem = ({ item, removingId, onRemove }: PasskeyListItemProps) => {
  const t = useTranslations('Components.User.Settings.Passkey')

  return (
    <div className="flex gap-2 rounded-lg border border-border/60 p-3 items-center justify-between">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{item.name?.trim() || t('unnamed')}</div>
        <div className="text-muted-foreground text-xs">
          {formatDeviceType(item.device_type, {
            unknown: t('deviceType.unknown'),
            multiDevice: t('deviceType.multiDevice'),
            singleDevice: t('deviceType.singleDevice'),
          })}
          {item.credential_backed_up ? ` • ${t('backedUp')}` : ''}
        </div>
        <div className="text-muted-foreground text-xs">
          {t('lastUsedLabel')}: {formatTime(item.last_used_at, t('time.never'), t('time.unknown'))}
        </div>
      </div>
      <PasskeyRemoveDialog
        passkeyId={item.id}
        passkeyName={item.name}
        loading={removingId === item.id}
        onConfirm={onRemove}
      />
    </div>
  )
}
