import { Button, Dialog, Kbd, Text } from '@hina-ui/react'
import { Search } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { useSearchPalette } from '../use-search-palette'
import { PalettePanel } from './palette-panel'

export function SearchPalette() {
  const t = useTranslations('search')
  const palette = useSearchPalette()

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
      <Dialog
        title={t('label')}
        open={palette.open}
        onOpenChange={palette.setOpen}
        placement="top"
        size="xl"
        renderBody={() => <PalettePanel palette={palette} />}
      />
    </>
  )
}
