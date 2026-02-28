import { UserProfile as UserProfileType } from '@/interfaces/user/user.interface'
import { Upload, MessageCircle, Heart, Pencil, Footprints } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/utils/cn'
import { ScrollArea } from '@/components/shionui/ScrollArea'

interface DatasProps {
  user: UserProfileType
  hasCover?: boolean
}

export const Datas = async ({ user, hasCover }: DatasProps) => {
  const t = await getTranslations('Components.User.Home.Profile.Datas')
  return (
    <ScrollArea className="w-full" scrollbarOrientation="horizontal">
      <div className="w-full flex gap-2">
        <div
          className={cn(
            'w-40 md:w-48 shrink-0 flex gap-2 items-center shadow-content-subtle shadow-purple-600/10 dark:shadow-purple-600/25 border border-purple-600/25 rounded-md p-2 md:p-4',
            hasCover && 'bg-background/40 backdrop-blur-sm',
          )}
        >
          <div className="flex gap-3 items-center">
            <Upload className="size-8 text-purple-600" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">{t('upload')}</span>
              <span className="text-lg font-bold">{user.resource_count}</span>
            </div>
          </div>
        </div>
        <div
          className={cn(
            'w-40 md:w-48 shrink-0 flex gap-2 items-center shadow-content-subtle shadow-success/10 dark:shadow-success/25 border border-success/25 rounded-md p-2 md:p-4',
            hasCover && 'bg-background/40 backdrop-blur-sm',
          )}
        >
          <div className="flex gap-3 items-center">
            <MessageCircle className="size-8 text-success" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">{t('comment')}</span>
              <span className="text-lg font-bold">{user.comment_count}</span>
            </div>
          </div>
        </div>
        <div
          className={cn(
            'w-40 md:w-48 shrink-0 flex gap-2 items-center shadow-content-subtle shadow-destructive/10 dark:shadow-destructive/25 border border-destructive/25 rounded-md p-2 md:p-4',
            hasCover && 'bg-background/40 backdrop-blur-sm',
          )}
        >
          <div className="flex gap-3 items-center">
            <Heart className="size-8 text-destructive" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">{t('favorite')}</span>
              <span className="text-lg font-bold">{user.favorite_count}</span>
            </div>
          </div>
        </div>
        <div
          className={cn(
            'w-40 md:w-48 shrink-0 flex gap-2 items-center shadow-content-subtle shadow-primary/10 dark:shadow-primary/25 border border-primary/25 rounded-md p-2 md:p-4',
            hasCover && 'bg-background/40 backdrop-blur-sm',
          )}
        >
          <div className="flex gap-3 items-center">
            <Pencil className="size-8 text-primary" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">{t('edit')}</span>
              <span className="text-lg font-bold">{user.edit_count}</span>
            </div>
          </div>
        </div>
        <div
          className={cn(
            'w-40 md:w-48 shrink-0 flex gap-2 items-center shadow-content-subtle shadow-warning/10 dark:shadow-warning/25 border border-warning/25 rounded-md p-2 md:p-4',
            hasCover && 'bg-background/40 backdrop-blur-sm',
          )}
        >
          <div className="flex gap-3 items-center">
            <Footprints className="size-8 text-warning" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-muted-foreground">{t('walkthrough')}</span>
              <span className="text-lg font-bold">{user.walkthrough_count}</span>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
