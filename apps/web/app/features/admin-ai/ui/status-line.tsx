import { useTranslations } from 'use-intl'
import { StatusLine } from '~/features/admin'
import { healthOf, type RouteCounts } from '../admin-ai'

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
