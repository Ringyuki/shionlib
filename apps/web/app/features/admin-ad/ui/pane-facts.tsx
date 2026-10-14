import { DescriptionDetails, DescriptionList, DescriptionTerm, Link, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { AdminAd } from '../admin-ad'
import { useAdLabels } from '../use-ad-labels'

const facts = 'text-sm [--hn-dl-term-width:6rem]'

export function PaneFacts({ ad }: { ad: AdminAd }) {
  const t = useTranslations('adminAd.pane')
  const labels = useAdLabels()
  const adult = [ad.banner_adult && t('banner'), ad.side_adult && t('side')].filter(
    part => part !== false,
  )
  const unset = (
    <Text as="span" size="sm" tone="muted">
      {t('notSet')}
    </Text>
  )
  return (
    <DescriptionList orientation="horizontal" className={facts}>
      {ad.banner === null && (
        <>
          <DescriptionTerm>{t('banner')}</DescriptionTerm>
          <DescriptionDetails>{unset}</DescriptionDetails>
        </>
      )}
      {ad.side_image === null && (
        <>
          <DescriptionTerm>{t('side')}</DescriptionTerm>
          <DescriptionDetails>{unset}</DescriptionDetails>
        </>
      )}
      <DescriptionTerm>{t('link')}</DescriptionTerm>
      <DescriptionDetails>
        <Link href={ad.link} target="_blank" rel="noreferrer" className="break-all">
          {ad.link}
        </Link>
      </DescriptionDetails>
      <DescriptionTerm>{t('slots')}</DescriptionTerm>
      <DescriptionDetails>{labels.slots(ad.slots)}</DescriptionDetails>
      <DescriptionTerm>{t('languages')}</DescriptionTerm>
      <DescriptionDetails>{labels.languages(ad.languages)}</DescriptionDetails>
      <DescriptionTerm>{t('adult')}</DescriptionTerm>
      <DescriptionDetails>{adult.length === 0 ? t('no') : adult.join('、')}</DescriptionDetails>
      <DescriptionTerm>{t('weight')}</DescriptionTerm>
      <DescriptionDetails>{ad.weight}</DescriptionDetails>
      <DescriptionTerm>{t('schedule')}</DescriptionTerm>
      <DescriptionDetails>{labels.schedule(ad)}</DescriptionDetails>
    </DescriptionList>
  )
}
