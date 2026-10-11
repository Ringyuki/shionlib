import { Inline, Text } from '@hina-ui/react'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

type HistoryChangeProps = {
  before: ReactNode
  after: ReactNode
  label?: string
}

export function HistoryChange({ before, after, label }: HistoryChangeProps) {
  return (
    <Inline gap="sm" align="center" className="gap-y-0.5">
      {label !== undefined && (
        <Text as="span" size="sm" tone="muted">
          {label}
        </Text>
      )}
      <Text as="s" size="sm" tone="muted" className="break-all">
        {before}
      </Text>
      <ArrowRight aria-hidden className="size-3.5 shrink-0 text-faint" />
      <Text as="span" size="sm" className="break-all">
        {after}
      </Text>
    </Inline>
  )
}
