import { ads } from '@/config/site/ads'
import { FadeImage } from '@/components/common/shared/FadeImage'
import Link from 'next/link'
import { cn } from '@/utils/cn'
import { useTranslations, useLocale } from 'next-intl'
import { getLocalImageUrl } from './helpers/ad'
import { SupportedLocales } from '@/config/i18n/supported'

interface AdProps {
  id: number
}

export const Ad = ({ id }: AdProps) => {
  const t = useTranslations('Components.Common.Site.Ad')
  const locale = useLocale() as SupportedLocales
  const aspect = ads.find(ad => ad.id === id)?.aspect
  const ad = ads.find(ad => ad.id === id)
  if (!ad || ad.excludeLocales?.includes(locale)) return null

  const image = getLocalImageUrl(locale, ad)
  return (
    <div className="w-full">
      <Link
        href={ad.link}
        target="_blank"
        className={cn(
          'w-full h-auto hover:opacity-80 transition-opacity duration-200',
          'rounded-md overflow-hidden bg-card-soft relative block',
        )}
        style={{ aspectRatio: aspect }}
      >
        <FadeImage src={image} alt={ad.id.toString()} fill={true} sizes="100vw" />
        <div className="absolute flex items-center justify-center right-2 top-2 p-0.5 px-1 md:p-0.5 md:px-1.5 bg-black/50 rounded-md">
          <span className="text-white text-xs md:text-sm">{t('ad')}</span>
        </div>
      </Link>
    </div>
  )
}
