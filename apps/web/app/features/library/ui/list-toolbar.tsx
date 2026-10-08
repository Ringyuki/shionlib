import { Badge, Button, Inline, Text } from '@hina-ui/react'
import { SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { OrderSelect } from '~/features/game'
import type { LibraryAddress } from '../library'

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
        <OrderSelect
          order={address}
          onChange={chosen => onChange({ sort: chosen.sort, ascending: chosen.ascending })}
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
