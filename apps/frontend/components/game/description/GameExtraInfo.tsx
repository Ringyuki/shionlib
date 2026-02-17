import { useTranslations } from 'next-intl'
import { ExtraInfo } from '@/interfaces/game/game.interface'
import { Info } from 'lucide-react'
import { BangumiExtraInfoKeyMap } from './constants/BangumiExtraInfoKeyMap'

interface GameExtraInfoProps {
  extra_info: ExtraInfo[]
}

export const GameExtraInfo = ({ extra_info }: GameExtraInfoProps) => {
  const t = useTranslations('Components.Game.Description.GameDetail')
  const keyTrans = useTranslations('Components.Game.Description.BangumiExtraInfoKeyMap')

  const getKeyTrans = (key: string) => {
    const _key = BangumiExtraInfoKeyMap[key]
    if (_key) {
      return keyTrans(_key)
    }
    return key
  }
  return (
    extra_info.length > 0 && (
      <>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Info />
          <span>{t('extraInfo')}</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {extra_info.map(info => (
            <div key={info.key} className="flex flex-col gap-1">
              <div className="text-sm text-gray-500">{getKeyTrans(info.key)}</div>
              <div className="text-sm">{info.value}</div>
            </div>
          ))}
        </div>
      </>
    )
  )
}
