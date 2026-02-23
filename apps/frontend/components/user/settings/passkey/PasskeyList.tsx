'use client'

import { PasskeyCredentialItem } from '@/interfaces/auth/passkey.interface'
import { useTranslations } from 'next-intl'
import { PasskeyListItem } from '@/components/user/settings/passkey/PasskeyListItem'

interface PasskeyListProps {
  items: PasskeyCredentialItem[]
  removingId: number | null
  onRemove: (id: number) => void
}

export const PasskeyList = ({ items, removingId, onRemove }: PasskeyListProps) => {
  const t = useTranslations('Components.User.Settings.Passkey')
  if (items.length === 0) {
    return <div className="text-muted-foreground text-sm">{t('empty')}</div>
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map(item => (
        <PasskeyListItem key={item.id} item={item} removingId={removingId} onRemove={onRemove} />
      ))}
    </div>
  )
}
