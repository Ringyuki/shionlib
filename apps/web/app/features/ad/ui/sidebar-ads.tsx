import { cn, Divider, Flex, Image, Stack, Tag, Tooltip } from '@hina-ui/react'
import { href, Link } from 'react-router'
import { useTranslations } from 'use-intl'
import { sidebarRow } from '~/features/shell'
import type { Shown } from '../ad'
import { useAdView } from '../use-ad-views'

type SidebarAdsProps = {
  ads: Shown[]
  rail: boolean
}

export function SidebarAds({ ads, rail }: SidebarAdsProps) {
  const t = useTranslations('ad')
  if (ads.length === 0) {
    return null
  }
  return (
    <Stack as="aside" gap="xs" aria-label={t('label')}>
      <Divider className="mb-1" />
      {ads.map(ad => (
        <SidebarAd key={ad.id} ad={ad} rail={rail} />
      ))}
    </Stack>
  )
}

function SidebarAd({ ad, rail }: { ad: Shown; rail: boolean }) {
  const t = useTranslations('ad')
  const watch = useAdView({ ad_id: ad.id, slot: 'sidebar' })
  const label = t('sideLabel', { name: ad.name })
  return (
    <Tooltip content={label} side="right" disabled={!rail}>
      <Link
        ref={watch}
        to={`${href('/out/:id', { id: String(ad.id) })}?slot=sidebar`}
        target="_blank"
        rel="sponsored noopener"
        aria-label={label}
        className={cn(sidebarRow, 'overflow-hidden')}
      >
        <Flex
          as="span"
          aria-hidden
          data-collapsed={rail ? undefined : ''}
          className="hn-sidebar-label absolute inset-y-0 start-2 items-center"
        >
          <Image src={ad.icon ?? ad.image} alt="" lazy={false} className="size-7 rounded-md" />
        </Flex>
        <Flex
          as="span"
          aria-hidden
          data-collapsed={rail ? '' : undefined}
          className="hn-sidebar-label min-w-0 flex-1 items-center gap-2"
        >
          <Image
            src={ad.image}
            alt=""
            fit="contain"
            lazy={false}
            className="h-10 min-w-0 flex-1"
            imageClass="object-left"
          />
          <Tag size="sm" className="shrink-0">
            {t('mark')}
          </Tag>
        </Flex>
      </Link>
    </Tooltip>
  )
}
