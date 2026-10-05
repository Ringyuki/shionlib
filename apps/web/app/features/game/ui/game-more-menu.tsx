import { DropdownMenu, DropdownMenuItem, toast } from '@hina-ui/react'
import { Ellipsis, ExternalLink, Link2, PencilLine } from 'lucide-react'
import { useLocale, useTranslations } from 'use-intl'
import { hikarinagiEditUrl, hikarinagiEntryUrl } from '~/shared/catalog/hikarinagi'
import { usePublicConfig } from '~/shared/config/public-config'
import { Button } from '~/shared/ui/button'
import { gamePath, type GameHeader } from '../game'

export function GameMoreMenu({ game }: { game: GameHeader }) {
  const t = useTranslations('game.actions')
  const locale = useLocale()
  const { hikarinagiSiteUrl } = usePublicConfig()
  const entry = game.h_id
  const copyLink = async () => {
    const url = new URL(gamePath(locale, game.id), window.location.origin).href
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('linkCopied'))
    } catch {
      toast.danger(t('copyFailed'))
    }
  }
  const visit = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')
  return (
    <DropdownMenu
      label={t('more')}
      content={
        <>
          <DropdownMenuItem icon={<Link2 />} onSelect={() => void copyLink()}>
            {t('copyLink')}
          </DropdownMenuItem>
          {entry !== null && (
            <>
              <DropdownMenuItem
                icon={<ExternalLink />}
                onSelect={() => visit(hikarinagiEntryUrl(hikarinagiSiteUrl, 'galgame', entry))}
              >
                {t('viewOnHikarinagi')}
              </DropdownMenuItem>
              <DropdownMenuItem
                icon={<PencilLine />}
                onSelect={() => visit(hikarinagiEditUrl(hikarinagiSiteUrl, 'galgame', entry))}
              >
                {t('editOnHikarinagi')}
              </DropdownMenuItem>
            </>
          )}
        </>
      }
    >
      <Button
        variant="outline"
        tone="neutral"
        iconOnly
        aria-label={t('more')}
        icon={<Ellipsis />}
      />
    </DropdownMenu>
  )
}
