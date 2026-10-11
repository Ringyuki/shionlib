import { Heading, Stack, Text } from '@hina-ui/react'
import { useId, type ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import type { Inspection } from '../inspection'
import { scanned, type EarlierCheck } from '../inspection-facts'
import { ArchiveFacts } from './archive-facts'
import { CheckFacts } from './check-facts'
import { DiscFacts } from './disc-facts'

type Inspected = { inspection: Inspection | undefined }

export function FactsPart({ heading, children }: { heading: string; children: ReactNode }) {
  const label = useId()
  return (
    <Stack as="section" gap="md" aria-labelledby={label}>
      <Heading id={label} level={2} size="md">
        {heading}
      </Heading>
      {children}
    </Stack>
  )
}

export function ArchiveSection({ inspection }: Inspected) {
  const t = useTranslations('inspection.facts')
  return (
    <FactsPart heading={t('archive')}>
      {inspection?.status === 'ready' ? (
        <ArchiveFacts inspection={inspection} />
      ) : (
        <Text tone="muted">{t('status', { status: inspection?.status ?? 'unread' })}</Text>
      )}
    </FactsPart>
  )
}

export function CheckSection({ inspection, earlier }: Inspected & { earlier: EarlierCheck }) {
  const t = useTranslations('inspection.facts')
  return (
    <FactsPart heading={t('check')}>
      {inspection !== undefined && scanned(inspection) ? (
        <CheckFacts inspection={inspection} />
      ) : (
        <Text tone="muted">{t('earlier', { check: earlier })}</Text>
      )}
    </FactsPart>
  )
}

export function DiscSections({ inspection }: Inspected) {
  const t = useTranslations('inspection.facts')
  return (inspection?.discs ?? []).map(disc => (
    <FactsPart key={disc.entry_id} heading={t('disc')}>
      <DiscFacts disc={disc} />
    </FactsPart>
  ))
}
