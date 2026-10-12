import { Badge, cn, Flex, Indicator, Tag, Tooltip, VisuallyHidden } from '@hina-ui/react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { alsoWithin } from '../shell'
import { SidebarLabel } from './sidebar-label'

type SidebarLinkProps = {
  icon: LucideIcon
  label: string
  to: string
  rail: boolean
  end?: boolean
  count?: number
  countLabel?: string
  alert?: string
  also?: readonly string[]
}

export function SidebarLink({
  icon: Icon,
  label,
  to,
  rail,
  end = false,
  count = 0,
  countLabel,
  alert,
  also = [],
}: SidebarLinkProps) {
  const { pathname } = useLocation()
  return (
    <Tooltip content={label} side="right" disabled={!rail}>
      <NavLink
        to={to}
        end={end}
        prefetch="intent"
        aria-label={rail ? label : undefined}
        className={cn(
          'hn-interactive hn-state-layer hn-press-none text-muted aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-text relative isolate flex h-10 items-center gap-3 rounded-lg ps-3 pe-2 text-base select-none aria-[current=page]:font-medium [&_svg]:size-5 [&_svg]:shrink-0',
          alsoWithin({ also }, pathname) && 'bg-accent-soft text-accent-text font-medium',
        )}
      >
        <Badge content={rail ? count : 0} tone="accent" label={countLabel}>
          <Icon aria-hidden />
        </Badge>
        <SidebarLabel collapsed={rail} className="flex-1">
          {label}
        </SidebarLabel>
        {count > 0 && (
          <Flex
            as="span"
            aria-hidden={rail || undefined}
            data-collapsed={rail ? '' : undefined}
            className="hn-sidebar-label"
          >
            <Tag variant="solid" tone="accent" pill aria-hidden className="tabular-nums">
              {count > 99 ? '99+' : count}
            </Tag>
            <VisuallyHidden>{countLabel}</VisuallyHidden>
          </Flex>
        )}
        {alert !== undefined && (
          <Flex as="span" data-collapsed={rail ? '' : undefined} className="hn-sidebar-label me-1">
            <Indicator tone="danger" size="sm" label={alert} />
          </Flex>
        )}
      </NavLink>
    </Tooltip>
  )
}
