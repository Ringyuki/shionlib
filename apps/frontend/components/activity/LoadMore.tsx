'use client'

import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'

interface ActivityLoadMoreProps {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
}

export const ActivityLoadMore = ({ hasMore, loading, onLoadMore }: ActivityLoadMoreProps) => {
  const t = useTranslations('Components.Home.Activity.LoadMore')

  if (!hasMore) {
    return <div className="flex justify-center text-sm text-muted-foreground">{t('noMore')}</div>
  }

  return (
    <div className="flex justify-center">
      <Button onClick={onLoadMore} loading={loading} disabled={loading}>
        {t('button')}
      </Button>
    </div>
  )
}
