import { Button, Sheet } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { LibraryAddress } from '../library'
import { LibraryFilters } from './library-filters'

type FilterSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: LibraryAddress
  years: readonly number[]
  filtered: boolean
  total: number
  resettable: boolean
  onChange: (changes: Partial<LibraryAddress>) => void
  onReset: () => void
}

export function FilterSheet({
  open,
  onOpenChange,
  address,
  years,
  filtered,
  total,
  resettable,
  onChange,
  onReset,
}: FilterSheetProps) {
  const t = useTranslations('library.filters')
  return (
    <Sheet
      title={t('title')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <LibraryFilters address={address} years={years} filtered={filtered} onChange={onChange} />
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="outline" tone="neutral" disabled={!resettable} onClick={onReset}>
            {t('reset')}
          </Button>
          <Button onClick={close}>{t('done', { total })}</Button>
        </>
      )}
    />
  )
}
