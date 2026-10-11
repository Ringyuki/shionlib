import { Flex, Inline, Link, Tabs, TabsContent, TabsList, TabsTrigger, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { sitePaths } from '~/features/shell'
import { countOf, type Profile, type ProfileTab } from '../profile'
import { profileTabFrom } from '../profile.schema'

type ProfileTabsProps = {
  profile: Profile
  own: boolean
  tabs: { current: ProfileTab; shown: ProfileTab[]; select: (tab: ProfileTab) => void }
  children: ReactNode
}

export function ProfileTabs({ profile, own, tabs, children }: ProfileTabsProps) {
  const t = useTranslations('profile.tabs')
  const locale = useLocale()
  const format = useFormatter()
  return (
    <Tabs
      value={tabs.current}
      onValueChange={value => {
        const tab = profileTabFrom(value)
        if (tab !== undefined) {
          tabs.select(tab)
        }
      }}
      size="lg"
      className="mt-5"
    >
      <Inline gap="none" align="stretch" wrap={false}>
        <TabsList label={t('label')} className="min-w-0 flex-1">
          {tabs.shown.map(tab => (
            <TabsTrigger key={tab} value={tab} className="first:ms-0.5 sm:first:ms-2.5">
              {t(tab)}
              <Text as="span" size="sm" tone="faint" className="ms-2 font-normal tabular-nums">
                {format.number(countOf(profile, tab))}
              </Text>
            </TabsTrigger>
          ))}
        </TabsList>
        {own && tabs.current === 'uploads' && (
          <Flex align="center" className="border-line shrink-0 border-b pe-4 sm:pe-6">
            <Link asChild className="text-sm">
              <RouterLink to={sitePaths(locale).uploads}>{t('manageUploads')}</RouterLink>
            </Link>
          </Flex>
        )}
      </Inline>
      <TabsContent value={tabs.current}>{children}</TabsContent>
    </Tabs>
  )
}
