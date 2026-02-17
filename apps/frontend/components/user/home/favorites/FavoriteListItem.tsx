'use client'

import { Favorite } from '@/interfaces/favorite/favorite.interface'
import { Link, useRouter } from '@/i18n/navigation.client'
import { Badge } from '@/components/shionui/Badge'
import { Card, CardContent } from '@/components/shionui/Card'
import { cn } from '@/utils/cn'
import { Folder, FolderCheck, Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface FavoriteListItemProps {
  favorite: Favorite
  userId: string
  selected?: boolean
}

export const FavoriteListItem = ({ favorite, selected = false, userId }: FavoriteListItemProps) => {
  const router = useRouter()
  const Icon = selected ? FolderCheck : Folder
  const t = useTranslations('Components.User.Home.Favorites.FavoriteListItem')
  const href = `/user/${userId}/favorites?folder=${favorite.id}`
  return (
    <Link
      href={href}
      onClick={event => {
        event.preventDefault()
        router.push(href, { showProgress: true })
      }}
    >
      <Card
        className={cn(
          'py-0 transition-colors shadow-none',
          selected ? 'border-primary/50 bg-primary/5' : 'hover:bg-accent/30',
        )}
      >
        <CardContent className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="size-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">
                {favorite.default ? t('default') : favorite.name}
              </span>
              {favorite.is_private && <Lock className="size-3 text-muted-foreground shrink-0" />}
            </div>
            <Badge variant="neutral" size="sm">
              {favorite.game_count}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
