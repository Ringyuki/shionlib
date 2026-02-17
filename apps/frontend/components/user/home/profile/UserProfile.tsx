import { Avatar } from '@/components/common/user/Avatar'
import { Card, CardContent } from '@/components/shionui/Card'
import {
  User,
  userRoleMap,
  UserProfile as UserProfileType,
  UserStatus,
} from '@/interfaces/user/user.interface'
import { Badge } from '@/components/shionui/Badge'
import { getTranslations, getLocale } from 'next-intl/server'
import { cn } from '@/utils/cn'
import { IdCard, CalendarDays, Ban } from 'lucide-react'
import { timeFromNow } from '@/utils/time-format'
import { Datas } from './Datas'

interface UserProfileProps {
  user: UserProfileType
}

export const UserProfile = async ({ user }: UserProfileProps) => {
  const t = await getTranslations('Components.User.Home.Profile.UserProfile')
  const locale = await getLocale()
  const role = userRoleMap[user.role]
  const roleBadgeTokenMap: { [key in User['role']]: Record<string, string> } = {
    1: {
      bg: 'bg-primary/25',
      fg: 'text-primary',
      border: 'border-primary/25',
    },
    2: {
      bg: 'bg-warning/25',
      fg: 'text-warning',
      border: 'border-warning/25',
    },
    3: {
      bg: 'bg-warning/25',
      fg: 'text-warning',
      border: 'border-warning/25',
    },
  }
  const badgeColor = roleBadgeTokenMap[user.role]
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <Avatar clickable={false} user={user} className="size-20" />
            <div className="flex flex-col justify-center gap-3">
              <h2 className="text-xl font-bold">{user.name}</h2>
              {user.bio && <p className="text-sm text-muted-foreground">{user.bio}</p>}
              <div className="flex gap-2 items-center">
                <Badge className={cn(badgeColor.bg, badgeColor.fg, badgeColor.border)}>
                  <span className="font-bold">{t(`role.${role}`)}</span>
                </Badge>
                {user.status === UserStatus.BANNED && (
                  <Badge variant="neutral">
                    <Ban className="size-4" />
                    <span className="font-bold">{t('banned')}</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <div className="flex gap-2 items-center">
              <CalendarDays className="size-4" />
              {t('joined')} {timeFromNow(user.created, locale)}
            </div>
            <div className="flex gap-2 items-center">
              <IdCard className="size-4" />
              {user.id}
            </div>
          </div>
          <Datas user={user} />
        </div>
      </CardContent>
    </Card>
  )
}
