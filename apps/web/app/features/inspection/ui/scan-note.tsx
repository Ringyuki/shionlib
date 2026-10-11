import { Inline, Text } from '@hina-ui/react'
import { Shield, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'use-intl'
import type { Inspection } from '../inspection'
import { scanVerdict, scanned } from '../inspection-facts'

export function ScanNote({ inspection }: { inspection: Inspection | undefined }) {
  const t = useTranslations('inspection.facts')
  if (inspection === undefined || !scanned(inspection)) {
    return (
      <Inline as="span" gap="xs" align="center" wrap={false}>
        <Shield aria-hidden className="text-muted size-4 shrink-0" />
        <Text as="span" size="sm" tone="muted">
          {t('earlier', { check: 'passed' })}
        </Text>
      </Inline>
    )
  }
  if (scanVerdict(inspection) !== 'clean') {
    return null
  }
  return (
    <Inline as="span" gap="xs" align="center" wrap={false}>
      <ShieldCheck aria-hidden className="text-success-text size-4 shrink-0" />
      <Text as="span" size="sm" tone="success">
        {t('clean')}
      </Text>
    </Inline>
  )
}
