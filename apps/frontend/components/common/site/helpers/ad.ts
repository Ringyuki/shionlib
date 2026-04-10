import { Ad } from '@/interfaces/site/ad.interface'
import { SupportedLocales } from '@/config/i18n/supported'

export const getLocalImageUrl = (locale: SupportedLocales, ad: Ad): string => {
  switch (locale) {
    case 'en':
      return ad.image_en ?? ad.image_ja ?? ad.image_zh
    case 'zh':
      return ad.image_zh
    case 'ja':
      return ad.image_ja ?? ad.image_en ?? ad.image_zh
  }
}

export const needShowAd = (locale: SupportedLocales, ads: Ad[]): boolean => {
  const needShow = (locale: SupportedLocales, ad: Ad): boolean => {
    if (!ad) return false
    if (!ad.image_zh && !ad.image_ja && !ad.image_en) return false
    if (ad.exclude_locales?.includes(locale)) return false
    return true
  }
  return ads.some(ad => needShow(locale, ad))
}
