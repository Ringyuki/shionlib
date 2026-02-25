'use client'

import { Walkthrough } from '@/interfaces/walkthrough/walkthrough.interface'
import { GameWalkthroughList } from './List'
import { useTranslations } from 'next-intl'
import { Empty } from '@/components/common/content/Empty'
import { Button } from '@/components/shionui/Button'
import { Sparkles } from 'lucide-react'
import { useRouter } from '@/i18n/navigation.client'

interface GameWalkthroughProps {
  walkthroughs: Walkthrough[]
  gameId: string
}

export const GameWalkthrough = ({ walkthroughs, gameId }: GameWalkthroughProps) => {
  const t = useTranslations('Components.Game.Walkthrough')
  const router = useRouter()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-4 text-lg font-bold">
          <div className="w-1 h-6 bg-primary rounded" />
          <span>{t('walkthroughs')}</span>
        </h2>
        {walkthroughs && walkthroughs.length > 0 && (
          <Button
            appearance="outline"
            onClick={() => router.push(`/game/${gameId}/walkthrough/edit`)}
            renderIcon={<Sparkles />}
            loginRequired
          >
            {t('create')}
          </Button>
        )}
      </div>
      {walkthroughs && walkthroughs.length > 0 ? (
        <GameWalkthroughList walkthroughs={walkthroughs} gameId={gameId} />
      ) : (
        <Empty
          title={t('no_walkthroughs')}
          action={
            <Button
              loginRequired
              onClick={() => router.push(`/game/${gameId}/walkthrough/edit`)}
              renderIcon={<Sparkles />}
            >
              {t('create')}
            </Button>
          }
        />
      )}
    </div>
  )
}
