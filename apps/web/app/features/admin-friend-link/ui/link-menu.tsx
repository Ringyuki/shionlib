import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@hina-ui/react'
import { Ellipsis, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { IconButton } from '~/shared/ui/button'
import type { Link } from '../admin-friend-link'

type LinkMenuProps = {
  link: Link
  busy: boolean
  onEdit: (link: Link) => void
  onToggle: (link: Link) => void
  onRemove: (link: Link) => void
}

export function LinkMenu({ link, busy, onEdit, onToggle, onRemove }: LinkMenuProps) {
  const t = useTranslations('adminFriendLink.menu')
  const label = t('label', { name: link.name })
  return (
    <DropdownMenu
      label={label}
      align="end"
      content={
        <>
          <DropdownMenuItem icon={<Pencil />} onSelect={() => onEdit(link)}>
            {t('edit')}
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={link.visible ? <EyeOff /> : <Eye />}
            onSelect={() => onToggle(link)}
          >
            {t(link.visible ? 'hide' : 'show')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<Trash2 />} tone="danger" onSelect={() => onRemove(link)}>
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
