import { PageHeader, Stack, Tabs, TabsContent, TabsList, TabsTrigger } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { aiPaths, aiTabs, type AiTab } from '../admin-ai'

type GatewayFrameProps = {
  tab: AiTab
  actions?: ReactNode
  head?: ReactNode
  children: ReactNode
}

export function GatewayFrame({ tab, actions, head, children }: GatewayFrameProps) {
  const t = useTranslations('adminAi')
  const navigate = useNavigate()
  const open = (value: string) => {
    const next = aiTabs.find(candidate => candidate === value)
    if (next !== undefined) {
      void navigate(aiPaths[next])
    }
  }
  return (
    <Stack gap="lg">
      {head ?? <PageHeader title={t('title')} actions={actions} />}
      <Tabs value={tab} onValueChange={open}>
        <TabsList label={t('tabs.label')}>
          {aiTabs.map(key => (
            <TabsTrigger
              key={key}
              value={key}
              onClick={head !== undefined && key === tab ? () => open(key) : undefined}
            >
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
