import { DescriptionDetails, DescriptionList, DescriptionTerm, Stack, Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import type { Inspection } from '../inspection'
import { integrityOf, scanLimitMegabytes, scanVerdict } from '../inspection-facts'

export function CheckFacts({ inspection }: { inspection: Inspection }) {
  const t = useTranslations('inspection.facts')
  const format = useFormatter()
  const { scan } = inspection
  const detections = scan.detections ?? []
  const skipped = scan.skipped ?? []
  const day = (instant: string | null) =>
    instant === null ? '' : format.dateTime(new Date(instant), { dateStyle: 'long' })
  return (
    <DescriptionList orientation="horizontal" className="[--hn-dl-term-width:8.25rem]">
      <DescriptionTerm>{t('integrity')}</DescriptionTerm>
      <DescriptionDetails>
        {t('integrityValue', { integrity: integrityOf(inspection) })}
      </DescriptionDetails>
      <DescriptionTerm>{t('scan')}</DescriptionTerm>
      <DescriptionDetails>
        {t('scanValue', {
          verdict: scanVerdict(inspection),
          count: detections.length,
          date: day(scan.cleared_at),
        })}
      </DescriptionDetails>
      {detections.length > 0 && (
        <>
          <DescriptionTerm>{t('detections')}</DescriptionTerm>
          <DescriptionDetails>
            <Stack gap="sm">
              {detections.map(detection => (
                <Stack key={`${detection.path}:${detection.signature}`} gap="none">
                  <Text as="span" size="sm" className="font-mono break-all">
                    {detection.path}
                  </Text>
                  <Text as="span" size="sm" tone="muted" className="break-all">
                    {detection.signature}
                  </Text>
                </Stack>
              ))}
            </Stack>
          </DescriptionDetails>
        </>
      )}
      <DescriptionTerm>{t('scope')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">
        {t('scopeValue', {
          status: inspection.status,
          discs: (inspection.discs ?? []).length,
          count: scan.scanned,
        })}
      </DescriptionDetails>
      {skipped.length > 0 && (
        <>
          <DescriptionTerm>{t('skipped')}</DescriptionTerm>
          <DescriptionDetails>
            <Stack gap="none">
              {skipped.map(path => (
                <Text key={path} as="span" size="sm" className="font-mono break-all">
                  {path}
                </Text>
              ))}
              <Text as="span" size="sm" tone="muted" className="tabular-nums">
                {t('skippedHint', {
                  unsupported: String(inspection.archive.unsupported),
                  limit: format.number(scanLimitMegabytes(inspection)),
                })}
              </Text>
            </Stack>
          </DescriptionDetails>
        </>
      )}
      <DescriptionTerm>{t('engine')}</DescriptionTerm>
      <DescriptionDetails>
        {t('engineValue', { engine: scan.engine, date: day(scan.signatures_at) })}
      </DescriptionDetails>
      <DescriptionTerm>{t('checked')}</DescriptionTerm>
      <DescriptionDetails>
        {scan.at === null
          ? ''
          : format.dateTime(new Date(scan.at), { dateStyle: 'long', timeStyle: 'short' })}
      </DescriptionDetails>
    </DescriptionList>
  )
}
