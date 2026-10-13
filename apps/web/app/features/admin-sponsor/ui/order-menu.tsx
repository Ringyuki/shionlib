import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@hina-ui/react'
import { Check, Ellipsis, Trash2, Undo2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { IconButton } from '~/shared/ui/button'
import { offered, type Order, type Settable } from '../admin-sponsor'

type OrderMenuProps = {
  order: Order
  busy: boolean
  onMark: (order: Order, status: Settable) => void
  onRemove: (order: Order) => void
}

const icons = { DONE: <Check />, REFUND: <Undo2 /> }

export function OrderMenu({ order, busy, onMark, onRemove }: OrderMenuProps) {
  const t = useTranslations('adminSponsor.menu')
  const label = t('label', { number: order.providerOrderId })
  return (
    <DropdownMenu
      label={label}
      align="end"
      content={
        <>
          {offered(order).map(status => (
            <DropdownMenuItem
              key={status}
              icon={icons[status]}
              onSelect={() => onMark(order, status)}
            >
              {t(status)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<Trash2 />} tone="danger" onSelect={() => onRemove(order)}>
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
