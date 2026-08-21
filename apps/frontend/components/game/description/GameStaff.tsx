import { GameStaff as GameStaffType } from '@/interfaces/game/game.interface'
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
  const grouped = staffs.reduce<{ role: string; names: string[] }[]>((acc, staff) => {
    const existing = acc.find(item => item.role === staff.role)
    if (existing) existing.names.push(staff.name)
    else acc.push({ role: staff.role, names: [staff.name] })
    return acc
  }, [])

  return (
    staffs.length > 0 && (
      <>
        <h2 className="flex items-center gap-4 text-lg font-bold">
          <div className="w-1 h-6 bg-primary rounded" />
          <span>{t('staff')}</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {grouped.map(item => (
            <div key={item.role} className="flex flex-col gap-1">
              <div className="text-sm text-gray-500">{getKeyTrans(item.role)}</div>
              <div className="text-sm">{item.names.join('、')}</div>
            </div>
          ))}
        </div>
      </>
    )
  )
}
