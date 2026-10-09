import {
  Divider,
  Empty,
  Inline,
  Listbox,
  ScrollArea,
  SearchInput,
  Spinner,
  Stack,
  Text,
  type InputHandle,
  type ListboxValue,
} from '@hina-ui/react'
import { CloudOff, SearchX, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { usePaletteEntries, type PaletteEntry } from '../use-palette-entries'
import type { PaletteSource } from '../use-palette-source'
import { useSearchPalette } from '../use-search-palette'
import { PictureOption } from './picture-option'

export function PalettePanel({ source, onClose }: { source: PaletteSource; onClose: () => void }) {
  const t = useTranslations('search')
  const palette = useSearchPalette(source, onClose)
  const { entries, recentShown, status, searchAll } = usePaletteEntries(palette)
  const input = useRef<InputHandle>(null)
  const list = useRef<HTMLElement>(null)
  const [refills, setRefills] = useState(0)
  useEffect(() => {
    if (refills > 0) {
      input.current?.focus()
    }
  }, [refills])
  const pick = (value: ListboxValue) => {
    const entry = entries
      .flatMap(item => ('options' in item ? item.options : [item]))
      .find(option => option.value === value)
    entry?.action()
    if (entry?.stays === true) {
      setRefills(count => count + 1)
    }
  }
  const enterList = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      list.current?.focus()
    }
  }
  return (
    <Stack gap="none">
      <SearchInput
        ref={input}
        autoFocus
        variant="bare"
        size="lg"
        value={palette.search}
        onValueChange={palette.setSearch}
        onSearch={searchAll}
        onKeyDown={enterList}
        placeholder={t('placeholder')}
        aria-label={t('label')}
      />
      <Divider />
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
                onClick={() => {
                  palette.clearRecent()
                  setRefills(count => count + 1)
                }}
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
            onValueChange={pick}
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
      {status === 'empty' && (
        <Empty icon={<SearchX />} title={t('empty', { query: palette.query })} size="sm" />
      )}
      {status === 'unavailable' && <Empty icon={<CloudOff />} title={t('unavailable')} size="sm" />}
    </Stack>
  )
}

function PaletteOption({ entry }: { entry: PaletteEntry }) {
  if (entry.kind === 'picture') {
    return <PictureOption name={entry.label} detail={entry.description} picture={entry.picture} />
  }
  const Icon = entry.icon
  return (
    <Inline as="span" gap="sm" align="center" wrap={false}>
      <Icon aria-hidden className="shrink-0 text-muted" />
      <Stack as="span" gap="none" className="min-w-0">
        <Text as="span" size="sm" truncate>
          {entry.label}
        </Text>
        {entry.description !== undefined && (
          <Text as="span" size="xs" tone="muted" truncate>
            {entry.description}
          </Text>
        )}
      </Stack>
    </Inline>
  )
}
