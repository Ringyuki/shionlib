import { Stack, Tabs, TabsContent, TabsList, TabsTrigger, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import { resourceTabFrom } from '../resource-page.schema'
import { useResourceTabs } from '../use-resource-tabs'

type ResourceTabsProps = {
  resourceId: number
  comments: number
  children: ReactNode
}

export function ResourceTabs({ resourceId, comments, children }: ResourceTabsProps) {
  const t = useTranslations('resource.page.tabs')
  const { current, select } = useResourceTabs(resourceId)
  const change = (value: string) => {
    const tab = resourceTabFrom(value)
    if (tab !== undefined) {
      select(tab)
    }
  }
  return (
    <Tabs value={current} onValueChange={change}>
      <Stack gap="lg">
        <TabsList label={t('label')}>
          <TabsTrigger value="contents">{t('contents')}</TabsTrigger>
          <TabsTrigger value="details">{t('details')}</TabsTrigger>
          <TabsTrigger value="history">{t('history')}</TabsTrigger>
          <TabsTrigger value="comments">
            {t('comments')}
            <Text as="span" size="sm" tone="faint" className="ms-1.5 tabular-nums">
              {comments}
            </Text>
          </TabsTrigger>
        </TabsList>
        <TabsContent value={current}>{children}</TabsContent>
      </Stack>
    </Tabs>
  )
}
