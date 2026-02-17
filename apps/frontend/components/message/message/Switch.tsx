'use client'

import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger } from '@/components/shionui/animated/Tabs'
import { useSearchParams } from 'next/navigation'
import { useRouter, usePathname } from '@/i18n/navigation.client'
import { Card, CardContent } from '@/components/shionui/Card'
import { ReadAll } from './ReadAll'

const tabs = [
  { name: 'all', href: 'all' },
  { name: 'read', href: 'read' },
  { name: 'unread', href: 'unread' },
]

export const Switch = () => {
  const t = useTranslations('Components.Message.Message.Switch')
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const unread = searchParams.get('unread')
  const router = useRouter()

  const handleChange = (value: string) => {
    if (value === 'all') router.push(`${pathname}?page=1`)
    else router.push(`${pathname}?unread=${value === 'unread'}&page=1`)
  }

  return (
    <Card className="rounded-md sticky md:top-24 top-18 z-20 py-0 dark:bg-[rgba(0,0,0,0.5)] bg-[rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-[3.5]">
      <CardContent className="p-0 flex items-center justify-between">
        <Tabs
          value={unread === null ? 'all' : unread === 'true' ? 'unread' : 'read'}
          onValueChange={handleChange}
        >
          <TabsList className="bg-transparent!" variant="light" intent="primary">
            {tabs.map(tab => (
              <TabsTrigger key={tab.href} value={tab.href} className="py-1 px-8">
                {t(tab.name)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ReadAll />
      </CardContent>
    </Card>
  )
}
