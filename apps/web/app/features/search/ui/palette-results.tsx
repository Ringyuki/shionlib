import {
  Empty,
  Inline,
  Listbox,
  ScrollArea,
  Spinner,
  Text,
  type ListboxValue,
  type SelectItems,
} from '@hina-ui/react'
import { CloudOff, SearchX, Trash2 } from 'lucide-react'
import type { Ref } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { PaletteEntry, PaletteStatus } from '../use-palette-entries'
import { PaletteOption } from './palette-option'

type PaletteResultsProps = {
  entries: SelectItems<PaletteEntry>
  recentShown: boolean
  status: PaletteStatus
  query: string
  list: Ref<HTMLElement>
  onPick: (value: ListboxValue) => void
  onClearRecent: () => void
}

export function PaletteResults({
  entries,
  recentShown,
  status,
  query,
  list,
  onPick,
  onClearRecent,
}: PaletteResultsProps) {
  const t = useTranslations('search')
  return (
    <>
      {entries.length > 0 && (
        <ScrollArea style={{ maxHeight: 'min(60vh, 32rem)' }}>
          {recentShown && (
            <Inline align="center" justify="between" wrap={false} className="px-3.5 pt-2.5 pb-1.5">
              <Text size="xs" tone="muted" weight="medium">
                {t('groups.recent')}
              </Text>
              <Button
                variant="link"
                tone="danger"
                size="xs"
                icon={<Trash2 />}
                aria-label={t('clearRecent')}
                onClick={onClearRecent}
              >
                {t('clear')}
              </Button>
            </Inline>
          )}
          <Listbox
            ref={list}
            variant="bare"
            options={entries}
            value={null}
            onValueChange={onPick}
            renderOption={({ option }) => <PaletteOption entry={option} />}
            renderTrailing={() => null}
            maxHeight="none"
            aria-label={t('list')}
          />
        </ScrollArea>
      )}
      {status === 'searching' && (
        <Inline gap="sm" justify="center" align="center" className="py-6">
          <Spinner size="sm" label={t('searching')} />
          <Text size="sm" tone="muted">
            {t('searching')}
          </Text>
        </Inline>
      )}
      {status === 'empty' && <Empty icon={<SearchX />} title={t('empty', { query })} size="sm" />}
      {status === 'unavailable' && <Empty icon={<CloudOff />} title={t('unavailable')} size="sm" />}
    </>
  )
}
