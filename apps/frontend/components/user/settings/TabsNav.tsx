'use client'

import { useMemo } from 'react'
import { useSelectedLayoutSegment } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/shionui/animated/Tabs'
import { Link } from '@/i18n/navigation.client'
import { useTranslations } from 'next-intl'

const tabs = [
  { name: 'personal', href: 'personal' },
  { name: 'security', href: 'security' },
  { name: 'site', href: 'site' },
  { name: 'download', href: 'download' },
  { name: 'connections', href: 'connections' },
]

export const UserSettingsTabsNav = () => {
  const t = useTranslations('Components.User.Settings.TabsNav')
  const segment = useSelectedLayoutSegment()
  const active = useMemo(
    () => (segment && tabs.some(t => t.href === segment) ? segment : 'personal'),
    [segment],
  )

  return (
    <Tabs value={active}>
      <TabsList variant="light" intent="primary" scrollAreaClassName="bg-muted/40 w-fit">
        {tabs.map(tab => (
          <TabsTrigger key={tab.href} value={tab.href} className="py-1 px-8" asChild>
            <Link href={tab.href}>{t(tab.name)}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
