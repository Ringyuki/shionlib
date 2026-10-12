import { useTranslations } from 'use-intl'
import type { NavEntry } from '../shell'
import { navIcons } from './nav-icons'
import { SidebarLink } from './sidebar-link'

type SiteNavLinkProps = {
  entry: NavEntry
  rail: boolean
}

export function SiteNavLink({ entry, rail }: SiteNavLinkProps) {
  const t = useTranslations('shell')
  return (
    <SidebarLink
      icon={navIcons[entry.key]}
      label={t(`nav.${entry.key}`)}
      to={entry.to}
      rail={rail}
      end={entry.end}
      count={entry.count}
      countLabel={t('unreadCount', { count: entry.count })}
      also={entry.also}
    />
  )
}
