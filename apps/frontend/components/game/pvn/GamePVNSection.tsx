'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { sileo } from 'sileo'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
} from '@/components/shionui/Card'
import { Button } from '@/components/shionui/Button'
import { Badge } from '@/components/shionui/Badge'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { shionlibRequest } from '@/utils/request'
import { PvnGameData } from '@/interfaces/potatovn/pvn-game-data.interface'
import { timeFromNow, timeFormat, TimeFormatEnum } from '@/utils/time-format'
import { PLAY_TYPE_KEYS } from './constants/pvn'
import { Question } from '@/components/common/content/Question'
import { GameCover } from '@/interfaces/game/game.interface'
import { cn } from '@/utils/cn'

interface GamePVNSectionProps {
  gameId: number
  initialData: PvnGameData | null
  cover?: GameCover
}

function formatPlayTime(
  minutes: number,
  t: (key: string, values?: Record<string, number>) => string,
): string {
  if (minutes <= 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
  if (hours > 0) return `${hours}h`
  return `${mins}m`
}

export const GamePVNSection = ({ gameId, initialData, cover }: GamePVNSectionProps) => {
  const t = useTranslations('Components.Game.PVN')
  const locale = useLocale()

  const [pvnData, setPvnData] = useState<PvnGameData | null>(initialData)
  const [isAdding, setIsAdding] = useState(false)

  const inLibrary = !!pvnData

  const handleAdd = async () => {
    setIsAdding(true)
    try {
      const res = await shionlibRequest().post<PvnGameData>(`/potatovn/game/${gameId}`)
      setPvnData(res.data!)
      sileo.success({ title: t('addSuccess') })
    } catch {
    } finally {
      setIsAdding(false)
    }
  }

  const isNsfw = cover && (cover.sexual >= 1 || cover.violence >= 1)

  return (
    <Card className={cn('relative overflow-hidden', cover && 'bg-transparent')}>
      {cover && (
        <>
          <div className="absolute inset-0 overflow-hidden">
            <FadeImage
              src={cover.url}
              alt=""
              className="w-full h-full scale-110"
              imageClassName={cn(
                'object-cover saturate-150',
                isNsfw
                  ? 'blur-3xl brightness-50 dark:brightness-40'
                  : 'blur-2xl brightness-75 dark:brightness-60',
              )}
              showSkeleton={false}
            />
          </div>
          <div className="absolute inset-0 bg-card/75" />
        </>
      )}
      <div className="relative z-10 flex flex-col gap-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FadeImage
              src="/assets/images/pvn/pvn-logo.png"
              alt="PotatoVN"
              className="size-6 rounded-sm object-contain"
            />
            {t('title')}
          </CardTitle>
          <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
          {inLibrary && (
            <CardAction>
              <Badge intent="success" appearance="solid">
                {t('inLibrary')}
              </Badge>
            </CardAction>
          )}
        </CardHeader>
        {inLibrary && pvnData && (
          <div className="px-6 pb-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">{t('totalPlayTime')}</span>
              <p className="font-medium">{formatPlayTime(pvnData.total_play_time, t)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('lastPlayed')}</span>
              <p className="font-medium">
                {pvnData.last_play_date
                  ? timeFromNow(pvnData.last_play_date, locale)
                  : t('notPlayed')}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('playType')}</span>
              <p className="font-medium">
                {t(
                  PLAY_TYPE_KEYS[pvnData.play_type as keyof typeof PLAY_TYPE_KEYS] ??
                    'pvnPlayType0',
                )}
              </p>
            </div>
            {pvnData.my_rate > 0 && (
              <div>
                <span className="text-muted-foreground">{t('myRate')}</span>
                <p className="font-medium">{pvnData.my_rate}</p>
              </div>
            )}
            <div className="col-span-2">
              <span className="text-muted-foreground text-xs flex items-center gap-1">
                {t('syncedAt')}
                {timeFormat(pvnData.synced_at, locale, TimeFormatEnum.YYYY_MM_DD_HH_MM_SS)}
                <Question iconClassName="size-3" content={t('syncedAtTooltip')} />
              </span>
            </div>
          </div>
        )}
        {!inLibrary && (
          <CardFooter>
            <Button intent="primary" onClick={handleAdd} loading={isAdding}>
              {t('addToLibrary')}
            </Button>
          </CardFooter>
        )}
      </div>
    </Card>
  )
}
