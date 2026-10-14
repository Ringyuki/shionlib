import { Grid, Stack } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { Shown, Slot } from '../ad'
import { AdBanner } from './ad-banner'

type AdSlotProps = {
  slot: Exclude<Slot, 'sidebar'>
  ads: Shown[]
}

export function AdSlot({ slot, ads }: AdSlotProps) {
  const t = useTranslations('ad')
  if (ads.length === 0) {
    return null
  }
  return (
    <Stack as="aside" gap="none" aria-label={t('label')} className="@container">
      <Grid className="w-full grid-cols-1 gap-4 @min-[45rem]:grid-cols-2">
        {ads.map((ad, index) => (
          <AdBanner
            key={ad.id}
            ad={ad}
            slot={slot}
            className={index > 0 ? 'hidden @min-[45rem]:block' : undefined}
          />
        ))}
      </Grid>
    </Stack>
  )
}
