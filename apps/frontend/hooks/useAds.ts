'use client'

import { useState, useEffect } from 'react'
import { Ad } from '@/interfaces/site/ad.interface'
import { fetchAdsByPlacement } from '@/libs/ad/fetch-ads'

export const useAds = (placement: string) => {
  const [ads, setAds] = useState<Ad[]>([])

  useEffect(() => {
    fetchAdsByPlacement(placement).then(setAds)
  }, [placement])

  return ads
}
