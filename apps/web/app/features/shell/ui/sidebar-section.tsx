import { useTranslations } from 'use-intl'
import type { NavSection } from '../shell'
import { SidebarGroup } from './sidebar-group'
import { SiteNavLink } from './site-nav-link'

type SidebarSectionProps = {
  section: NavSection
  rail: boolean
}

export function SidebarSection({ section, rail }: SidebarSectionProps) {
  const t = useTranslations('shell')
  return (
    <SidebarGroup label={t(`section.${section.key}`)} rail={rail}>
      {section.entries.map(entry => (
        <SiteNavLink key={entry.key} entry={entry} rail={rail} />
      ))}
    </SidebarGroup>
  )
}
