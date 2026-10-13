import { Card, cn } from '@hina-ui/react'
import type { ReactNode } from 'react'

type ChoiceCardProps = {
  chosen: boolean
  onChoose: () => void
  className?: string
  children: ReactNode
}

export function ChoiceCard({ chosen, onChoose, className, children }: ChoiceCardProps) {
  return (
    <Card
      as="button"
      padded={false}
      aria-pressed={chosen}
      onClick={onChoose}
      className={cn(
        'hn-interactive hn-state-layer text-start',
        'aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:ring-accent aria-pressed:ring-1',
        className,
      )}
    >
      {children}
    </Card>
  )
}
