import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@hina-ui/react'
import { CirclePause, CirclePlay, Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { IconButton } from '~/shared/ui/button'
import type { AdminAd } from '../admin-ad'

export type AdActions = {
  onEdit: (ad: AdminAd) => void
  onToggle: (ad: AdminAd) => void
  onRemove: (ad: AdminAd) => void
}

type AdMenuProps = AdActions & {
  ad: AdminAd
  busy: boolean
}

export function AdMenu({ ad, busy, onEdit, onToggle, onRemove }: AdMenuProps) {
  const t = useTranslations('adminAd.menu')
  const label = t('label', { name: ad.name })
  return (
    <DropdownMenu
      label={label}
      align="end"
      content={
        <>
          <DropdownMenuItem icon={<Pencil />} onSelect={() => onEdit(ad)}>
            {t('edit')}
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={ad.enabled ? <CirclePause /> : <CirclePlay />}
            onSelect={() => onToggle(ad)}
          >
            {t(ad.enabled ? 'disable' : 'enable')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<Trash2 />} tone="danger" onSelect={() => onRemove(ad)}>
            {t('remove')}
          </DropdownMenuItem>
        </>
      }
    >
      <IconButton
        variant="ghost"
        tone="neutral"
        size="sm"
        label={label}
        tooltip={false}
        loading={busy}
      >
        <Ellipsis />
      </IconButton>
    </DropdownMenu>
  )
}
