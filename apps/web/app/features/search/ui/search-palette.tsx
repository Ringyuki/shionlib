import { Button, Dialog, Kbd, Text } from '@hina-ui/react'
import { Search } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { usePaletteOpen } from '../use-palette-open'
import { usePaletteSource } from '../use-palette-source'
import { PalettePanel } from './palette-panel'

export function SearchPalette() {
  const t = useTranslations('search')
  const { open, setOpen } = usePaletteOpen()
  const source = usePaletteSource()
  const show = () => setOpen(true)

  return (
    <>
      <Button
        variant="soft"
        tone="neutral"
        icon={<Search />}
        onClick={show}
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
        onClick={show}
        className="ms-auto md:hidden"
      >
        <Search />
      </Button>
      <Dialog
        title={t('label')}
        open={open}
        onOpenChange={setOpen}
        placement="top"
        size="xl"
        renderBody={({ close }) => <PalettePanel source={source} onClose={close} />}
      />
    </>
  )
}
