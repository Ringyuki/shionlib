import { Badge, Button, Inline, Select, Text } from '@hina-ui/react'
import { SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { orderOf, orders, type LibraryAddress } from '../library'

type ListToolbarProps = {
  address: LibraryAddress
  total: number
  conditions: number
  onChange: (changes: Partial<LibraryAddress>) => void
  onOpenFilters: () => void
}

export function ListToolbar({
  address,
  total,
  conditions,
  onChange,
  onOpenFilters,
}: ListToolbarProps) {
  const t = useTranslations('library')
  return (
    <>
      <Text size="sm" tone="muted" className="tabular-nums">
        {t('count', { total })}
      </Text>
      <Inline gap="sm" align="center" wrap={false}>
        <Select
          size="sm"
          aria-label={t('orderLabel')}
          value={orderOf(address).name}
          onValueChange={value => {
            const chosen = orders.find(order => order.name === value)
            if (chosen !== undefined) {
              onChange({ sort: chosen.sort, ascending: chosen.ascending })
            }
          }}
          options={orders.map(order => ({ value: order.name, label: t(`order.${order.name}`) }))}
          className="w-44 shrink-0 max-sm:w-40"
        />
        <Badge content={conditions} tone="accent" className="xl:hidden">
          <Button size="sm" variant="outline" tone="neutral" onClick={onOpenFilters}>
            <SlidersHorizontal aria-hidden />
            {t('filters.open')}
          </Button>
        </Badge>
      </Inline>
    </>
  )
}
