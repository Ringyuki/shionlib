import { Stack, Tabs, TabsContent, TabsList, TabsTrigger, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useFormatter, useTranslations } from 'use-intl'
import type { Profile } from '../profile'
import { profileTabFrom } from '../profile.schema'
import { useProfileTabs } from '../use-profile-tabs'

type ProfileTabsProps = {
  profile: Profile
  header: ReactNode
  children: ReactNode
}

export function ProfileTabs({ profile, header, children }: ProfileTabsProps) {
  const t = useTranslations('profile.tabs')
  const format = useFormatter()
  const { current, select } = useProfileTabs(profile.id)
  return (
    <Tabs
      value={current}
      onValueChange={value => {
        const tab = profileTabFrom(value)
        if (tab !== undefined) {
          select(tab)
        }
      }}
    >
      <Stack gap="lg">
        <Stack gap="xl">
          {header}
          <TabsList label={t('label')}>
            <TabsTrigger value="uploads">
              {t('uploads')}
              <Text as="span" size="sm" tone="faint" className="ms-1.5 tabular-nums">
                {format.number(profile.resource_count)}
              </Text>
            </TabsTrigger>
            <TabsTrigger value="favorites">{t('favorites')}</TabsTrigger>
            <TabsTrigger value="comments">
              {t('comments')}
              <Text as="span" size="sm" tone="faint" className="ms-1.5 tabular-nums">
                {format.number(profile.comment_count)}
              </Text>
            </TabsTrigger>
            <TabsTrigger value="walkthroughs">
              {t('walkthroughs')}
              <Text as="span" size="sm" tone="faint" className="ms-1.5 tabular-nums">
                {format.number(profile.walkthrough_count)}
              </Text>
            </TabsTrigger>
          </TabsList>
        </Stack>
        <TabsContent value={current}>{children}</TabsContent>
      </Stack>
    </Tabs>
  )
}
