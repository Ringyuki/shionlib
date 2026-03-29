'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/shionui/Button'
import { ChevronsDown } from 'lucide-react'

interface LoadMoreTriggerProps {
  isPaused: boolean
  hasMore: boolean
  loadMore: () => void
  loading?: boolean
}

export const LoadMoreTrigger = ({ isPaused, hasMore, loadMore, loading }: LoadMoreTriggerProps) => {
  const t = useTranslations('Components.Common.InfiniteScroll')

  if (!isPaused || !hasMore) return null

  return (
    <div className="flex justify-center">
      <Button appearance="soft" onClick={loadMore} loading={loading} renderIcon={<ChevronsDown />}>
        {t('load-more')}
      </Button>
    </div>
  )
}
