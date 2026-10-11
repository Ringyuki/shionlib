import { DescriptionDetails, DescriptionList, DescriptionTerm, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { Disc } from '../inspection'
import { discFormat } from '../inspection-facts'

export function DiscFacts({ disc }: { disc: Disc }) {
  const t = useTranslations('inspection.facts')
  const bytes = useBytes()
  return (
    <DescriptionList orientation="horizontal" className="[--hn-dl-term-width:8.25rem]">
      <DescriptionTerm>{t('discFile')}</DescriptionTerm>
      <DescriptionDetails className="break-all">{disc.name}</DescriptionDetails>
      <DescriptionTerm>{t('format')}</DescriptionTerm>
      <DescriptionDetails>
        <Text as="span" tone={disc.unreadable ? 'muted' : undefined}>
          {t('discFormat', { format: discFormat(disc) })}
        </Text>
      </DescriptionDetails>
      {disc.label !== '' && (
        <>
          <DescriptionTerm>{t('label')}</DescriptionTerm>
          <DescriptionDetails className="break-all">{disc.label}</DescriptionDetails>
        </>
      )}
      <DescriptionTerm>{t('size')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">{bytes(disc.size)}</DescriptionDetails>
      <DescriptionTerm>{t('contents')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">
        <Text as="span" tone={disc.unreadable ? 'muted' : undefined}>
          {disc.unreadable
            ? t('unreadable')
            : t('contentsValue', { files: disc.files, folders: disc.folders })}
        </Text>
      </DescriptionDetails>
    </DescriptionList>
  )
}
