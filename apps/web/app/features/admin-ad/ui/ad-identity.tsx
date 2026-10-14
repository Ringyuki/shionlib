import { Image, Inline, Tag } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { TwoLines } from '~/features/admin'
import { bannerRatio, hostOf, previewOf, type AdminAd } from '../admin-ad'

export function AdIdentity({ ad }: { ad: AdminAd }) {
  const t = useTranslations('adminAd.mark')
  const preview = previewOf(ad)
  return (
    <Inline gap="md" align="center" wrap={false} className="min-w-0">
      <Image
        src={preview ?? ''}
        alt=""
        ratio={bannerRatio}
        fit={ad.banner === null ? 'contain' : 'cover'}
        className="bg-subtle w-30 shrink-0 rounded"
      />
      <TwoLines
        first={ad.name}
        second={
          <Inline as="span" gap="xs" align="center" wrap={false}>
            {hostOf(ad.link)}
            {ad.banner_adult && (
              <Tag size="sm" tone="warning">
                {t('adultBanner')}
              </Tag>
            )}
            {ad.side_image !== null && (
              <Tag size="sm" tone={ad.side_adult ? 'warning' : 'neutral'}>
                {t(ad.side_adult ? 'adultSide' : 'side')}
              </Tag>
            )}
          </Inline>
        }
      />
    </Inline>
  )
}
