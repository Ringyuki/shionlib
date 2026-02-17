'use client'

import * as React from 'react'
import { Avatar as ShionlibAvatar, AvatarImage, AvatarFallback } from '@/components/shionui/Avatar'
import { User, UserAvatar } from '@/interfaces/user/user.interface'
import { cn } from '@/utils/cn'
import { isCJK } from './helpers/is-cjk'
import { useRouter } from '@/i18n/navigation.client'

type UserAvatarProps = {
  user: User | UserAvatar
  clickable?: boolean
  homeUrl?: string
} & React.ComponentPropsWithoutRef<typeof ShionlibAvatar>
export const Avatar = React.forwardRef<React.ComponentRef<typeof ShionlibAvatar>, UserAvatarProps>(
  ({ user, clickable = true, homeUrl, className, ...props }, ref) => {
    const router = useRouter()
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!clickable) return
      e.preventDefault()
      if (homeUrl) window.open(homeUrl, '_blank')
      else router.push(`/user/${user.id}`)
    }
    return (
      <ShionlibAvatar
        ref={ref}
        className={cn('rounded-full select-none', clickable && 'cursor-pointer', className)}
        {...props}
        onClick={handleClick}
      >
        <AvatarImage
          src={
            user.avatar
              ? user.avatar.startsWith('http')
                ? user.avatar
                : process.env.NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL + user.avatar
              : ''
          }
        />
        {!user.avatar && (
          <AvatarFallback className="bg-primary/20">
            {isCJK(user.name) ? user.name.slice(0, 1) : user.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        )}
      </ShionlibAvatar>
    )
  },
)

Avatar.displayName = 'UserAvatar'
