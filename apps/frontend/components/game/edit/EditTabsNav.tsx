'use client'

import { useEffect, useMemo } from 'react'
import { useSelectedLayoutSegment } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/shionui/animated/Tabs'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { useParams, redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation.client'
import { useTranslations } from 'next-intl'
import { useScrollToElem } from '@/hooks/useScrollToElem'

const tabs = [
  { name: 'scalar', href: 'scalar' },
  { name: 'link', href: 'link', disabled: true },
  { name: 'cover', href: 'cover' },
  { name: 'image', href: 'image' },
  { name: 'developer', href: 'developer' },
  { name: 'character', href: 'character' },
]

export const EditTabsNav = () => {
  const t = useTranslations('Components.Game.Edit.EditTabsNav')
  const { id } = useParams()
  const segment = useSelectedLayoutSegment()
  const active = useMemo(
    () => (segment && tabs.some(t => t.href === segment) ? segment : 'scalar'),
    [segment],
  )
  const scrollToElem = useScrollToElem()
  useEffect(() => {
    if (active) {
      const gameContent = document.getElementById('game-content')
      if (gameContent) {
        scrollToElem(gameContent)
      }
    }
  }, [active, scrollToElem])
  const { gamePermissions: permissions } = useEditPermissionStore()
  if (!permissions) {
    redirect(`/game/${id}`)
  }
  return (
    <Tabs value={active}>
      <TabsList scrollAreaClassName="bg-muted w-fit">
        {tabs.map(
          tab =>
            !tab.disabled && (
              <TabsTrigger key={tab.href} value={tab.href} asChild className="py-1 px-8">
                <Link href={tab.href}>{t(tab.name)}</Link>
              </TabsTrigger>
            ),
        )}
      </TabsList>
    </Tabs>
  )
}
