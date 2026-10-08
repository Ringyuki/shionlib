import { Stack, Tabs, TabsContent, TabsList, TabsTrigger, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import { gameTabFrom } from '../game.schema'
import { useGameTabs } from '../use-game-tabs'

type GameTabsProps = {
  gameId: number
  counts: { resources: number; characters: number; comments: number; walkthroughs: number }
  renderHeader: (tabs: ReactNode) => ReactNode
  children: ReactNode
}

export function GameTabs({ gameId, counts, renderHeader, children }: GameTabsProps) {
  const t = useTranslations('game.tabs')
  const { current, select } = useGameTabs(gameId)
  const change = (value: string) => {
    const tab = gameTabFrom(value)
    if (tab !== undefined) {
      select(tab)
    }
  }
  const tabs = (
    <TabsList label={t('label')}>
      <TabsTrigger value="resources">
        {t('resources')}
        <Count value={counts.resources} />
      </TabsTrigger>
      <TabsTrigger value="info">{t('info')}</TabsTrigger>
      <TabsTrigger value="characters">
        {t('characters')}
        <Count value={counts.characters} />
      </TabsTrigger>
      <TabsTrigger value="comments">
        {t('comments')}
        <Count value={counts.comments} />
      </TabsTrigger>
      <TabsTrigger value="walkthrough">
        {t('walkthrough')}
        <Count value={counts.walkthroughs} />
      </TabsTrigger>
    </TabsList>
  )
  return (
    <Tabs value={current} onValueChange={change}>
      <Stack gap="lg">
        {renderHeader(tabs)}
        <TabsContent value={current}>{children}</TabsContent>
      </Stack>
    </Tabs>
  )
}

function Count({ value }: { value: number }) {
  return (
    <Text as="span" size="sm" tone="faint" className="ms-1.5 tabular-nums">
      {value}
    </Text>
  )
}
