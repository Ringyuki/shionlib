import { Heading, Inline, Link } from '@hina-ui/react'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router'

type SectionHeaderProps = {
  heading: string
  controls?: ReactNode
  more?: { label: string; to: string }
}

export function SectionHeader({ heading, controls, more }: SectionHeaderProps) {
  return (
    <Inline gap="md" align="center" justify="between" wrap={false}>
      <Inline gap="sm" align="center" wrap={false}>
        <Heading level={2} size="lg" weight="semibold">
          {heading}
        </Heading>
        {controls}
      </Inline>
      {more !== undefined && (
        <Link asChild tone="neutral">
          <RouterLink to={more.to}>
            <Inline as="span" gap="none" align="center" wrap={false}>
              {more.label}
              <ChevronRight aria-hidden className="size-4" />
            </Inline>
          </RouterLink>
        </Link>
      )}
    </Inline>
  )
}
