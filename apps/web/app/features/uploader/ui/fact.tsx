import { Inline, Text } from '@hina-ui/react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function Fact({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <Inline gap="xs" align="center" wrap={false} className="min-h-5.5 min-w-0">
      <Icon aria-hidden className="size-3.5 shrink-0 text-faint" />
      <Text size="sm" tone="muted" className="min-w-0 break-words tabular-nums">
        {children}
      </Text>
    </Inline>
  )
}
