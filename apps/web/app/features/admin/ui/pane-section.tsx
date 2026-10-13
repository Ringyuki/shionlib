import { Stack, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'

type PaneSectionProps = {
  label: string
  children: ReactNode
}

export function PaneSection({ label, children }: PaneSectionProps) {
  return (
    <Stack as="section" gap="sm" aria-label={label}>
      <Text as="span" size="sm" weight="medium" tone="muted">
        {label}
      </Text>
      {children}
    </Stack>
  )
}
