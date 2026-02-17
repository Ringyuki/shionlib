'use client'

import { useMemo, useEffect, useState } from 'react'
import { useSelectedLayoutSegment } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/shionui/animated/Tabs'
import { Link } from '@/i18n/navigation.client'
import { useTranslations } from 'next-intl'
import { useParams, usePathname } from 'next/navigation'

const tabs = [
  { name: 'description', href: '/' },
  { name: 'characters', href: 'characters' },
  { name: 'comments', href: 'comments' },
]

export const GameTabsNav = () => {
  const t = useTranslations('Components.Game.TabsNav')
  const { id } = useParams()
  const pathname = usePathname()
  const segment = useSelectedLayoutSegment()
  const active = useMemo(
    () => (segment && tabs.some(t => t.href === segment) ? segment : id ? '/' : 'characters'),
    [segment, id],
  )

  const [isEdit, setIsEdit] = useState(false)
  useEffect(() => {
    setIsEdit(pathname.includes('/edit'))
  }, [pathname])
  if (isEdit) return null

  return (
    <Tabs value={active}>
      <TabsList variant="light" intent="primary" className="w-full!">
        {tabs.map(tab => (
          <TabsTrigger key={tab.href} value={tab.href} asChild>
            <Link href={`/game/${id}/${tab.href}`}>{t(tab.name)}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
