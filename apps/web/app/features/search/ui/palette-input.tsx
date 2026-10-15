import { Inline, SearchInput, Toggle, type InputHandle } from '@hina-ui/react'
import { ScanSearch } from 'lucide-react'
import type { KeyboardEvent, Ref } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'

type PaletteInputProps = {
  input: Ref<InputHandle>
  value: string
  onValueChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  canSearch: boolean
  onSearch: () => void
  imageOn: boolean
  onImageChange: (on: boolean) => void
}

export function PaletteInput({
  input,
  value,
  onValueChange,
  onKeyDown,
  canSearch,
  onSearch,
  imageOn,
  onImageChange,
}: PaletteInputProps) {
  const t = useTranslations('search')
  return (
    <Inline gap="xs" align="center" wrap={false} className="pe-2">
      <SearchInput
        ref={input}
        autoFocus
        variant="bare"
        size="lg"
        className="min-w-0 flex-1"
        value={value}
        onValueChange={onValueChange}
        onSearch={onSearch}
        onKeyDown={onKeyDown}
        placeholder={t('placeholder')}
        aria-label={t('label')}
      />
      <Toggle
        size="sm"
        value={imageOn}
        onValueChange={onImageChange}
        label={t('image.label')}
        side="bottom"
        renderIcon={() => <ScanSearch />}
      />
      <Button size="sm" disabled={!canSearch} onClick={onSearch}>
        {t('submit')}
      </Button>
    </Inline>
  )
}
