import { Badge, cn, Tooltip } from '@hina-ui/react'
import { NavLink, useLocation } from 'react-router'
import { useTranslations } from 'use-intl'
import { alsoWithin, type NavEntry } from '../shell'
import { navIcons } from './nav-icons'
import { SidebarLabel } from './sidebar-label'

type SiteNavLinkProps = {
  entry: NavEntry
  rail: boolean
}

export function SiteNavLink({ entry, rail }: SiteNavLinkProps) {
  const t = useTranslations('shell')
  const Icon = navIcons[entry.key]
  const label = t(`nav.${entry.key}`)
  const { pathname } = useLocation()
  return (
    <Tooltip content={label} side="right" disabled={!rail}>
      <NavLink
        to={entry.to}
        end={entry.end}
        prefetch="intent"
        aria-label={rail ? label : undefined}
        className={cn(
          'hn-interactive hn-state-layer hn-press-none text-muted aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-text relative isolate flex h-10 items-center gap-3 rounded-lg ps-3 pe-2 text-base select-none aria-[current=page]:font-medium [&_svg]:size-5 [&_svg]:shrink-0',
          alsoWithin(entry, pathname) && 'bg-accent-soft text-accent-text font-medium',
        )}
      >
        <Badge content={entry.count} tone="accent" label={t('unreadCount', { count: entry.count })}>
          <Icon aria-hidden />
        </Badge>
        <SidebarLabel collapsed={rail}>{label}</SidebarLabel>
      </NavLink>
    </Tooltip>
  )
}
