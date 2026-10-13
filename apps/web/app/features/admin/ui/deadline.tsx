import { cn, Inline, Text, Time } from '@hina-ui/react'
import { Clock } from 'lucide-react'
import { useTranslations } from 'use-intl'

type DeadlineProps = {
  at: string
  outcome: 'autoDelete' | 'autoRemove'
}

export function Deadline({ at, outcome }: DeadlineProps) {
  const t = useTranslations('admin.overview.pending')
  const urgent = outcome === 'autoDelete'
  return (
    <Inline
      gap="xs"
      align="center"
      wrap={false}
      className={cn('text-sm font-medium', urgent ? 'text-warning-text' : 'text-muted')}
    >
      <Clock aria-hidden className="size-3.5 shrink-0" />
      <Text as="span" size="inherit" className="text-inherit">
        {t.rich(outcome, { time: () => <Time value={at} format="relative" /> })}
      </Text>
    </Inline>
  )
}
