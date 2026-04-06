'use client'

import { useAds } from '@/hooks/useAds'
import { AdItem } from '@/components/common/site/AdItem'
import { Skeleton } from '@/components/shionui/Skeleton'

interface NavAdContentProps {
  placement: string
}

export const NavAdContent = ({ placement }: NavAdContentProps) => {
  const ads = useAds(placement)

  if (!ads.length) {
    return <Skeleton className="w-124 h-20" />
  }

  return (
    <div className="w-lg space-y-2">
      {ads.map(ad => (
        <AdItem key={ad.id} ad={ad} />
      ))}
    </div>
  )
}
