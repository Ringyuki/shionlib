import { Tooltip } from '@hina-ui/react'
import { NavLink } from 'react-router'
import { useTranslations } from 'use-intl'
import type { NavEntry } from '../shell'
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
  return (
    <Tooltip content={label} side="right" disabled={!rail}>
      <NavLink
        to={entry.to}
        end={entry.end}
        prefetch="intent"
        aria-label={rail ? label : undefined}
        className="hn-interactive hn-state-layer hn-press-none text-muted aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-text relative isolate flex h-10 items-center gap-3 rounded-lg ps-3 pe-2 text-base select-none aria-[current=page]:font-medium [&_svg]:size-5 [&_svg]:shrink-0"
      >
        <Icon aria-hidden />
        <SidebarLabel collapsed={rail}>{label}</SidebarLabel>
      </NavLink>
    </Tooltip>
  )
}
