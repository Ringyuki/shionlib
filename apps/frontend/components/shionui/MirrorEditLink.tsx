import { Button } from '@/components/shionui/Button'
import { SquareArrowOutUpRight } from 'lucide-react'
import { hikarinagiEditUrl, type HikarinagiEntityType } from '@/config/site/hikarinagi'

interface MirrorEditLinkProps {
  type: HikarinagiEntityType
  hikarinagiId: number
  label: string
  appearance?: 'outline' | 'ghost'
  className?: string
}

/**
 * Entry data is maintained on hikarinagi once mirror mode is on, so the local edit button becomes
 * a link out. Callers hide it entirely when the entry carries no hikarinagi id yet.
 */
export const MirrorEditLink = ({
  type,
  hikarinagiId,
  label,
  appearance = 'outline',
  className,
}: MirrorEditLinkProps) => {
  return (
    <Button intent="primary" appearance={appearance} asChild className={className}>
      <a href={hikarinagiEditUrl(type, hikarinagiId)} target="_blank" rel="noreferrer noopener">
        {label}
        <SquareArrowOutUpRight data-slot="icon" />
      </a>
    </Button>
  )
}
