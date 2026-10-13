import { Grid, PageHeader, Result, SegmentedControl, Stack } from '@hina-ui/react'
import { CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { categories, inboxPath, type Inbox } from '../message'
import { categoryFrom } from '../message.schema'
import { useMarkAllRead } from '../use-mark-all-read'
import { MessageList } from './message-list'
import { MessageView } from './message-view'

export function InboxPage({ inbox }: { inbox: Inbox | null }) {
  const t = useTranslations('message')
  const locale = useLocale()
  const navigate = useNavigate()
  const reading = useMarkAllRead()
  if (inbox === null) {
    return (
      <Stack gap="lg">
        <PageHeader title={t('title')} />
        <Result
          status="info"
          title={t('signIn')}
          actions={<Button loginRequired>{t('signInAction')}</Button>}
        />
      </Stack>
    )
  }
  const viewing = inbox.opened !== null
  return (
    <Stack gap="lg">
      <PageHeader
        title={t('title')}
        description={t('unreadCount', { count: inbox.unread })}
        actions={
          <Button
            variant="outline"
            tone="neutral"
            icon={<CheckCheck />}
            disabled={inbox.unread === 0}
            loading={reading.pending}
            onClick={() => void reading.run()}
          >
            {t('markAllRead')}
          </Button>
        }
      />
      <SegmentedControl
        aria-label={t('categories')}
        value={inbox.category}
        onValueChange={value => {
          const category = categoryFrom(value === 'all' ? undefined : String(value))
          if (category !== undefined) {
            void navigate(inboxPath(locale, { category }))
          }
        }}
        options={categories.map(category => ({
          value: category,
          label: t(`category.${category}`),
        }))}
        className="self-start"
      />
      <Grid className="items-start gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <MessageList inbox={inbox} className={viewing ? 'max-lg:hidden' : undefined} />
        <MessageView inbox={inbox} className={viewing ? undefined : 'max-lg:hidden'} />
      </Grid>
    </Stack>
  )
}
