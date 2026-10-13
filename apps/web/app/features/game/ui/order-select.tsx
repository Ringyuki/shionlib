import { Select } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { orderOf, orders, type GameOrder, type Order } from '../game-order'

type OrderSelectProps = {
  order: GameOrder
  options?: readonly Order[]
  onChange: (order: Order) => void
  className?: string
}

export function OrderSelect({ order, options = orders, onChange, className }: OrderSelectProps) {
  const t = useTranslations('game')
  return (
    <Select
      size="sm"
      aria-label={t('orderLabel')}
      value={orderOf(order).name}
      onValueChange={value => {
        const chosen = options.find(option => option.name === value)
        if (chosen !== undefined) {
          onChange(chosen)
        }
      }}
      options={options.map(option => ({ value: option.name, label: t(`order.${option.name}`) }))}
      className={className}
    />
  )
}
