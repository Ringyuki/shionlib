import { Divider, Flex, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { NavSection } from '../shell'
import { SiteNavLink } from './site-nav-link'

type SidebarSectionProps = {
  section: NavSection
  rail: boolean
}

export function SidebarSection({ section, rail }: SidebarSectionProps) {
  const t = useTranslations('shell')
  const label = t(`section.${section.key}`)
  return (
    <Stack gap="xs" role="group" aria-label={label}>
      <Flex align="center" className="relative h-6">
        <Text
          as="span"
          size="xs"
          weight="medium"
          tone="faint"
          aria-hidden={rail || undefined}
          data-collapsed={rail ? '' : undefined}
          className="hn-sidebar-label px-3 whitespace-nowrap"
        >
          {label}
        </Text>
        <Divider
          aria-hidden
          data-collapsed={rail ? undefined : ''}
          className="hn-sidebar-label pointer-events-none absolute inset-x-2 top-1/2 w-auto"
        />
      </Flex>
      {section.entries.map(entry => (
        <SiteNavLink key={entry.key} entry={entry} rail={rail} />
      ))}
    </Stack>
  )
}
