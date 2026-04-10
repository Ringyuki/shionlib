'use client'

import { useState, useEffect } from 'react'
import { Ad } from '@/interfaces/site/ad.interface'
import { fetchAdsByPlacement } from '@/libs/ad/fetch-ads'
import { useShionlibUserStore } from '@/store/userStore'

const TTL = 30 * 60_000

interface CachedAds {
  expire: number
  ads: Ad[]
}

const getKey = (placement: string) => `shionlib:ads:${placement}`
const getValue = (ads: Ad[]): CachedAds => {
  return {
    expire: Date.now() + TTL,
    ads,
  }
}

const isExpire = (cache: CachedAds) => {
  return cache.expire < Date.now()
}

export const useAds = (placement: string) => {
  const isSponsor = useShionlibUserStore(state => state.user.is_sponsor)
  const [ads, setAds] = useState<Ad[]>([])

  useEffect(() => {
    if (isSponsor) {
      setAds([])
      return
    }

    const cached = localStorage.getItem(getKey(placement))
    if (cached) {
      const cache = JSON.parse(cached) as CachedAds
      if (isExpire(cache)) {
        fetchAdsByPlacement(placement).then(ads => {
          setAds(ads)
          ads.length && localStorage.setItem(getKey(placement), JSON.stringify(getValue(ads)))
        })
      } else {
        setAds(cache.ads)
      }
      return
    }
    fetchAdsByPlacement(placement).then(ads => {
      setAds(ads)
      ads.length && localStorage.setItem(getKey(placement), JSON.stringify(getValue(ads)))
    })
  }, [placement, isSponsor])

  return ads
}
