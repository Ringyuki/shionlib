import { PageHeader, Stack, Tabs, TabsContent, TabsList, TabsTrigger } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { adminPaths } from '~/features/admin'
import { Button } from '~/shared/ui/button'

const tabs = ['ads', 'slots'] as const

type Tab = (typeof tabs)[number]

const tabPaths: Record<Tab, string> = { ads: adminPaths.ads, slots: adminPaths.adSlots }

type AdsFrameProps = {
  tab: Tab
  onCreate: () => void
  children: ReactNode
}

export function AdsFrame({ tab, onCreate, children }: AdsFrameProps) {
  const t = useTranslations('adminAd')
  const navigate = useNavigate()
  const open = (value: string) => {
    const next = tabs.find(candidate => candidate === value)
    if (next !== undefined && next !== tab) {
      void navigate(tabPaths[next])
    }
  }
  return (
    <Stack gap="lg">
      <PageHeader
        title={t('title')}
        actions={
          <Button icon={<Plus />} onClick={onCreate}>
            {t('add')}
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={open}>
        <TabsList label={t('tabs.label')}>
          {tabs.map(key => (
            <TabsTrigger key={key} value={key}>
              {t(`tabs.${key}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="pt-4">
          {children}
        </TabsContent>
      </Tabs>
    </Stack>
  )
}
