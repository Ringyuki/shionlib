'use client'

import { useTranslations } from 'next-intl'
import { Empty } from '@/components/common/content/Empty'
import { UserWalkthroughItem as UserWalkthroughItemData } from '@/interfaces/user/walkthroughs.interface'
import { WalkthroughsNav } from './Nav'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { UserWalkthroughItem } from './Item'

type WalkthroughStatusFilter = 'all' | 'PUBLISHED' | 'DRAFT' | 'HIDDEN'

interface WalkthroughContentProps {
  userId: string
  walkthroughs: UserWalkthroughItemData[]
  is_current_user: boolean
  activeStatus: WalkthroughStatusFilter
  content_limit?: ContentLimit
}

export const WalkthroughContent = ({
  userId,
  walkthroughs,
  is_current_user,
  activeStatus,
  content_limit,
}: WalkthroughContentProps) => {
  const t = useTranslations('Components.User.Home.Walkthroughs.WalkthroughContent')

  return (
    <div className="flex flex-col gap-4">
      {is_current_user && <WalkthroughsNav userId={userId} activeStatus={activeStatus} />}
      {walkthroughs.length > 0 ? (
        <div className="flex flex-col gap-6">
          {walkthroughs.map(walkthrough => {
            return (
              <div key={walkthrough.id} className="flex flex-col gap-2">
                <UserWalkthroughItem walkthrough={walkthrough} content_limit={content_limit} />
              </div>
            )
          })}
        </div>
      ) : (
        <Empty title={t('empty')} />
      )}
    </div>
  )
}
