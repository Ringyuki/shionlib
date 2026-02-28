import { Avatar } from '@/components/common/user/Avatar'
import { FadeImage } from '@/components/common/shared/FadeImage'
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

interface ProfileBannerProps {
  user: UserProfileType
}

export const ProfileBanner = async ({ user }: ProfileBannerProps) => {
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
  const hasCover = Boolean(user.cover)

  return (
    <div className={cn('relative overflow-hidden rounded-xl shadow-card')}>
      {hasCover && (
        <>
          <FadeImage
            src={user.cover}
            alt={`${user.name}'s cover`}
            fill
            className="absolute inset-0"
            imageClassName="object-cover blur-sm scale-105"
            showSkeleton={false}
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-background/60 dark:bg-background/70" />
        </>
      )}
      <div className="relative p-6 flex flex-col gap-4">
        <div className="flex gap-4 items-start">
          <Avatar clickable={false} user={user} className="size-24" />
          <div className="flex flex-col justify-center gap-2">
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <div className="flex gap-2 items-center flex-wrap">
              <Badge className={cn(badgeColor.bg, badgeColor.fg, badgeColor.border)}>
                <span className="font-bold">{t(`role.${role}`)}</span>
              </Badge>
              {user.status === UserStatus.BANNED && (
                <Badge intent="neutral" appearance="outline">
                  <Ban className="size-4" />
                  <span className="font-bold">{t('banned')}</span>
                </Badge>
              )}
            </div>
            <div className="flex gap-4 text-sm font-medium flex-wrap">
              <div className="flex gap-2 items-center">
                <CalendarDays className="size-4" />
                {t('joined')} {timeFromNow(user.created, locale)}
              </div>
              <div className="flex gap-2 items-center">
                <IdCard className="size-4" />
                {user.id}
              </div>
            </div>
          </div>
        </div>
        {user.bio && (
          <p className="text-sm text-muted-foreground break-all bg-background/40 backdrop-blur-sm rounded-md p-2">
            {user.bio}
          </p>
        )}
        <Datas user={user} hasCover={hasCover} />
      </div>
    </div>
  )
}
