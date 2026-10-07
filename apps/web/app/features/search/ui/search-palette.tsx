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
        variant="soft"
        tone="neutral"
        icon={<Search />}
        onClick={palette.show}
        className="max-md:hidden"
      >
        <Text as="span" tone="muted" className="font-normal">
          {t('placeholder')}
        </Text>
        <Kbd>/</Kbd>
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
