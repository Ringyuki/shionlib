import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@hina-ui/react'
import { Ban, Ellipsis, RotateCcw, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { adminPaths } from '~/features/admin'
import { IconButton } from '~/shared/ui/button'
import type { AdminKey } from '../admin-open'

type KeyMenuProps = {
  item: AdminKey
  busy: boolean
  onSuspend: (item: AdminKey) => void
  onRestore: (item: AdminKey) => void
}

export function KeyMenu({ item, busy, onSuspend, onRestore }: KeyMenuProps) {
  const t = useTranslations('adminOpen.menu')
  const navigate = useNavigate()
  const label = t('label', { name: item.name })
  const suspended = item.status === 'suspended'
  return (
    <DropdownMenu
      label={label}
      align="end"
      content={
        <>
          <DropdownMenuItem
            icon={<UserRound />}
            onSelect={() => void navigate(adminPaths.user(item.owner.id))}
          >
            {t('user')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {suspended ? (
            <DropdownMenuItem icon={<RotateCcw />} onSelect={() => onRestore(item)}>
              {t('restore')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem icon={<Ban />} tone="danger" onSelect={() => onSuspend(item)}>
              {t('suspend')}
            </DropdownMenuItem>
          )}
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
