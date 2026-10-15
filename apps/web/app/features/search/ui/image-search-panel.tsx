import {
  Image,
  Inline,
  Listbox,
  ScrollArea,
  Spinner,
  Stack,
  Text,
  type ListboxValue,
} from '@hina-ui/react'
import { ImageUp } from 'lucide-react'
import type { Ref } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import {
  listedSightings,
  shotWidthRem,
  type ImageFindings,
  type ImageSource,
  type Shot,
} from '../search-image'
import { useImageEntries } from '../use-image-entries'
import type { ImageSearchControl } from '../use-image-search'
import { ImageCredit } from './image-credit'
import { ImageDrop } from './image-drop'
import { PaletteOption } from './palette-option'

type ImageSearchPanelProps = {
  control: ImageSearchControl
  source: ImageSource | null
  list: Ref<HTMLElement>
  onClose: () => void
}

export function ImageSearchPanel({ control, source, list, onClose }: ImageSearchPanelProps) {
  const { search } = control
  if (search.phase === 'off') {
    return null
  }
  if (search.phase === 'choosing') {
    return <ImageDrop source={source} onChoose={control.choose} />
  }
  return (
    <ScrollArea style={{ maxHeight: 'min(60vh, 32rem)' }}>
      <ShotRow
        shot={search.shot}
        found={search.phase === 'done' ? search.findings : undefined}
        source={source}
        onAgain={control.open}
      />
      {search.phase === 'done' && (
        <ImageResults
          findings={search.findings}
          crops={search.crops}
          list={list}
          onClose={onClose}
        />
      )}
    </ScrollArea>
  )
}

type ShotRowProps = {
  shot: Shot
  found: ImageFindings | undefined
  source: ImageSource | null
  onAgain: () => void
}

function ShotRow({ shot, found, source, onAgain }: ShotRowProps) {
  const t = useTranslations('search.image')
  const count = found === undefined ? 0 : listedSightings(found.characters).length
  return (
    <Inline gap="md" align="center" wrap={false} className="px-3.5 py-3">
      <Image
        src={shot.src}
        alt={t('picked')}
        fit="cover"
        lazy={false}
        className="h-12 shrink-0 rounded-md"
        style={{ width: `${shotWidthRem(shot.ratio)}rem` }}
      />
      <Stack gap="none" className="min-w-0 flex-1" aria-live="polite">
        <Inline as="span" gap="sm" align="center" wrap={false}>
          {found === undefined && <Spinner size="sm" label={t('reading')} />}
          <Text as="span" size="sm" weight="medium" truncate>
            {found === undefined ? t('reading') : count === 0 ? t('none') : t('found', { count })}
          </Text>
        </Inline>
        <ImageCredit source={found?.source ?? source} />
      </Stack>
      {found !== undefined && (
        <Button variant="link" size="xs" icon={<ImageUp />} onClick={onAgain}>
          {t('again')}
        </Button>
      )}
    </Inline>
  )
}

type ImageResultsProps = {
  findings: ImageFindings
  crops: readonly string[]
  list: Ref<HTMLElement>
  onClose: () => void
}

function ImageResults({ findings, crops, list, onClose }: ImageResultsProps) {
  const t = useTranslations('search.image')
  const entries = useImageEntries(findings, crops, onClose)
  const pick = (value: ListboxValue) => {
    entries
      .flatMap(item => ('options' in item ? item.options : [item]))
      .find(option => option.value === value)
      ?.action()
  }
  if (entries.length === 0) {
    return null
  }
  return (
    <Listbox
      ref={list}
      variant="bare"
      options={entries}
      value={null}
      onValueChange={pick}
      renderOption={({ option }) => <PaletteOption entry={option} />}
      renderTrailing={() => null}
      maxHeight="none"
      aria-label={t('results')}
    />
  )
}
