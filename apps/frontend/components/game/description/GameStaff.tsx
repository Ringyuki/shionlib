import { GameStaff as GameStaffType } from '@/interfaces/game/game.interface'
import { Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { BangumiExtraInfoKeyMap } from './constants/BangumiExtraInfoKeyMap'

interface GameStaffProps {
  staffs: GameStaffType[]
}

export const GameStaff = ({ staffs }: GameStaffProps) => {
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
    staffs.length > 0 && (
      <>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Users />
          <span>{t('staff')}</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {staffs.map(staff => (
            <div key={staff.role} className="flex flex-col gap-1">
              <div className="text-sm text-gray-500">{getKeyTrans(staff.role)}</div>
              <div className="text-sm">{staff.name}</div>
            </div>
          ))}
        </div>
      </>
    )
  )
}
