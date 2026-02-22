import { GameLink } from '@/interfaces/game/game.interface'
import { Button } from '@/components/shionui/Button'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface GameLinksProps {
  link: GameLink[]
}

export const GameLinks = ({ link }: GameLinksProps) => {
  const t = useTranslations('Components.Game.Description.GameLinks')
  const uniqueLink = link.filter((l, index, self) => index === self.findIndex(t => t.url === l.url))
  return (
    <>
      <h2 className="flex items-center gap-4 text-lg font-bold">
        <div className="w-1 h-6 bg-primary rounded" />
        <span>{t('links')}</span>
      </h2>
      <div className="flex gap-6 flex-wrap">
        {uniqueLink.map(l => (
          <div key={l.id} className="flex items-center">
            <Link href={l.url} target="_blank" rel="noopener noreferrer">
              <Button
                appearance="link"
                intent="neutral"
                className="p-0"
                renderIcon={<ExternalLink className="size-4" />}
              >
                {l.label}
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </>
  )
}
