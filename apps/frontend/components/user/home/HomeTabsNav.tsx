'use client'

import { useMemo } from 'react'
import { UserProfile as UserProfileType } from '@/interfaces/user/user.interface'
import { useSelectedLayoutSegment } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/shionui/animated/Tabs'
import { Link } from '@/i18n/navigation.client'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/shionui/Card'

interface HomeTabsNavProps {
  user: UserProfileType
}

export const HomeTabsNav = ({ user }: HomeTabsNavProps) => {
  const t = useTranslations('Components.User.Home.HomeTabsNav')

  const tabs = [
    { name: 'upload', href: 'uploads' },
    { name: 'comment', href: 'comments' },
    { name: 'favorite', href: 'favorites' },
    { name: 'edit', href: 'edits' },
  ]

  const segment = useSelectedLayoutSegment()
  const active = useMemo(
    () => (segment && tabs.some(t => t.href === segment) ? segment : 'uploads'),
    [segment],
  )
  return (
    <Card className="rounded-md sticky md:top-24 top-18 z-20 py-0 dark:bg-[rgba(0,0,0,0.5)] bg-[rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-[3.5]">
      <CardContent className="p-0">
        <Tabs value={active} className="w-full!">
          <TabsList className="w-full! bg-transparent!" highlightClassName="bg-secondary">
            {tabs.map(tab => (
              <TabsTrigger key={tab.href} value={tab.href} asChild>
                <Link href={tab.href}>{t(tab.name)}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardContent>
    </Card>
  )
}
