import { DescriptionDetails, DescriptionList, DescriptionTerm, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { Inspection } from '../inspection'
import { formatName, nameEncoding, volumesOf } from '../inspection-facts'
import { encodingNames } from '../inspection-preview'

export function ArchiveFacts({ inspection }: { inspection: Inspection }) {
  const t = useTranslations('inspection.facts')
  const bytes = useBytes()
  const { archive } = inspection
  const volumes = volumesOf(archive)
  const encoding = nameEncoding(archive)
  return (
    <DescriptionList orientation="horizontal" className="[--hn-dl-term-width:8.25rem]">
      <DescriptionTerm>{t('format')}</DescriptionTerm>
      <DescriptionDetails>
        {t('formatValue', { format: formatName(archive.format), volumes })}
      </DescriptionDetails>
      <DescriptionTerm>{t('contents')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">
        {t('contentsValue', { files: inspection.files, folders: inspection.folders })}
      </DescriptionDetails>
      <DescriptionTerm>{t('unpacked')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">{bytes(inspection.size)}</DescriptionDetails>
      <DescriptionTerm>{t('solid')}</DescriptionTerm>
      <DescriptionDetails>{t('yesNo', { value: String(archive.solid) })}</DescriptionDetails>
      {archive.recovery && (
        <>
          <DescriptionTerm>{t('recovery')}</DescriptionTerm>
          <DescriptionDetails className="tabular-nums">
            {t('recoveryValue', { percent: archive.recovery_percent })}
          </DescriptionDetails>
        </>
      )}
      {encoding !== undefined && (
        <>
          <DescriptionTerm>{t('nameEncoding')}</DescriptionTerm>
          <DescriptionDetails>
            <Stack gap="none">
              <Text as="span">{encodingNames[encoding]}</Text>
              <Text as="span" size="sm" tone="muted">
                {t('nameEncodingHint', { encoding })}
              </Text>
            </Stack>
          </DescriptionDetails>
        </>
      )}
    </DescriptionList>
  )
}
