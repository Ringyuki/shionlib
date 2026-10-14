import { cn, Image, Tag } from '@hina-ui/react'
import { href, Link } from 'react-router'
import { useTranslations } from 'use-intl'
import { bannerRatio, type Shown, type Slot } from '../ad'
import { useAdView } from '../use-ad-views'

type AdBannerProps = {
  ad: Shown
  slot: Slot
  className?: string
}

export function AdBanner({ ad, slot, className }: AdBannerProps) {
  const t = useTranslations('ad')
  const watch = useAdView({ ad_id: ad.id, slot })
  return (
    <Link
      ref={watch}
      to={`${href('/out/:id', { id: String(ad.id) })}?slot=${slot}`}
      target="_blank"
      rel="sponsored noopener"
      className={cn('hn-interactive relative block overflow-hidden rounded-lg', className)}
    >
      <Image src={ad.image} alt={ad.name} ratio={bannerRatio} lazy={false} eager />
      <Tag size="sm" variant="solid" className="absolute end-1.5 bottom-1.5">
        {t('mark')}
      </Tag>
    </Link>
  )
}
