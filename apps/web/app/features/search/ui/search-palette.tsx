import { Button, CommandPalette, Kbd, Text } from '@hina-ui/react'
import { Search } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { usePaletteItems, type SearchShortcut } from '../use-palette-items'
import { useSearchPalette } from '../use-search-palette'

type SearchPaletteProps = {
  shortcuts: readonly SearchShortcut[]
}

export function SearchPalette({ shortcuts }: SearchPaletteProps) {
  const t = useTranslations('search')
  const palette = useSearchPalette()
  const items = usePaletteItems(palette, shortcuts)

  return (
    <>
      <Button
        variant="outline"
        tone="neutral"
        icon={<Search />}
        trailing={<Kbd>/</Kbd>}
        onClick={palette.show}
        className="w-full max-w-md justify-start max-md:hidden [&>.hn-transition]:flex-1"
      >
        <Text as="span" tone="muted" className="flex-1 text-start font-normal">
          {t('placeholder')}
        </Text>
      </Button>
      <Button
        variant="ghost"
        tone="neutral"
        iconOnly
        aria-label={t('label')}
        onClick={palette.show}
        className="ms-auto md:hidden"
      >
        <Search />
      </Button>
      <CommandPalette
        open={palette.open}
        onOpenChange={palette.setOpen}
        search={palette.search}
        onSearchChange={palette.setSearch}
        items={items}
        ignoreFilter
        hotkey="mod+k"
        label={t('label')}
        placeholder={t('placeholder')}
      />
    </>
  )
}
