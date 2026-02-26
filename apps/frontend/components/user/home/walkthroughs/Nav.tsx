import { Card, CardContent } from '@/components/shionui/Card'
import { Tabs, TabsList, TabsTrigger } from '@/components/shionui/animated/Tabs'
import { Link } from '@/i18n/navigation.client'
import { useTranslations } from 'next-intl'

type WalkthroughStatusFilter = 'all' | 'PUBLISHED' | 'DRAFT' | 'HIDDEN'

interface WalkthroughsNavProps {
  userId: string
  activeStatus: WalkthroughStatusFilter
}

export const WalkthroughsNav = ({ userId, activeStatus }: WalkthroughsNavProps) => {
  const t = useTranslations('Components.User.Home.Walkthroughs.WalkthroughContent')

  const statusTabs: Array<{ value: WalkthroughStatusFilter; label: string }> = [
    { value: 'all', label: t('status.all') },
    { value: 'PUBLISHED', label: t('status.published') },
    { value: 'DRAFT', label: t('status.draft') },
    { value: 'HIDDEN', label: t('status.hidden') },
  ]

  const hrefByStatus = (status: WalkthroughStatusFilter) =>
    status === 'all'
      ? `/user/${userId}/walkthroughs`
      : `/user/${userId}/walkthroughs?status=${encodeURIComponent(status)}`

  return (
    <Card className="rounded-md py-0 dark:bg-[rgba(0,0,0,0.5)] bg-[rgba(255,255,255,0.7)] backdrop-blur-xl backdrop-saturate-[3.5] z-10 sticky top-30 md:top-39.5">
      <CardContent className="p-0">
        <Tabs value={activeStatus} className="w-full!">
          <TabsList className="w-full! bg-transparent!" highlightClassName="bg-secondary">
            {statusTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} asChild>
                <Link href={hrefByStatus(tab.value)}>{tab.label}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardContent>
    </Card>
  )
}
