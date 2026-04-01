'use client'

import { useAds } from '@/hooks/useAds'
import { AdList } from './AdItem'

export const AdSlotClient = ({ placement }: { placement: string }) => {
  const ads = useAds(placement)
  return <AdList ads={ads} />
}
