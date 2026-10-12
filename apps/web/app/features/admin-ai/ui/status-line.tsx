import { Indicator, Inline, Stack, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import { healthOf, type RouteCounts } from '../admin-ai'

export type StatusTone = 'success' | 'danger' | 'warning' | 'neutral'

type StatusLineProps = {
  tone: StatusTone
  label: string
  note?: ReactNode
  alarming?: boolean
}

export function StatusLine({ tone, label, note, alarming = false }: StatusLineProps) {
  return (
    <Stack gap="none" className="min-w-0">
      <Inline gap="xs" align="center" wrap={false}>
        <Indicator tone={tone} size="sm" />
        <Text as="span" size="sm" tone={tone === 'neutral' ? 'muted' : undefined}>
          {label}
        </Text>
      </Inline>
      {note !== undefined && note !== null && (
        <Text as="span" size="sm" tone={alarming ? 'danger' : 'muted'} className="line-clamp-2">
          {note}
        </Text>
      )}
    </Stack>
  )
}

const tones = { empty: 'neutral', off: 'neutral', suspended: 'danger', fine: 'success' } as const

export function useRoutesHealth() {
  const t = useTranslations('adminAi.health')
  return (enabled: boolean, counts: RouteCounts) => {
    const health = healthOf(enabled, counts)
    const label =
      health.state === 'fine'
        ? t(health.active === health.total ? 'fine' : 'fineOf', health)
        : health.state === 'empty'
          ? t('empty')
          : t(health.state, health)
    return { tone: tones[health.state], label, alarming: health.state === 'suspended' }
  }
}

type RoutesHealthProps = {
  enabled: boolean
  counts: RouteCounts
  note?: string
}

export function RoutesHealth({ enabled, counts, note }: RoutesHealthProps) {
  const health = useRoutesHealth()(enabled, counts)
  return <StatusLine {...health} note={health.alarming ? note : undefined} />
}
