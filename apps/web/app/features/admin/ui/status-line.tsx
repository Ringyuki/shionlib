import { Indicator, Inline, Stack, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'

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
