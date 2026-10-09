import { cn, DataList, Empty, Flex, Indicator, Inline, Stack, Text } from '@hina-ui/react'
import { useNavigate } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { InPageLink } from '~/shared/route/in-page-link'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { inboxPath, pageSize, type Inbox } from '../message'

type MessageListProps = {
  inbox: Inbox
  className?: string
}

export function MessageList({ inbox, className }: MessageListProps) {
  const t = useTranslations('message')
  const locale = useLocale()
  const format = useFormatter()
  const navigate = useNavigate()
  const pages = usePageTurn()
  const { category, page } = inbox
  return (
    <DataList
      label={t('list')}
      items={inbox.items}
      itemKey="id"
      size="sm"
      divided={false}
      manual
      pagination
      total={inbox.total}
      page={page}
      pageSize={pageSize}
      onPageChange={next => void navigate(inboxPath(locale, { category, page: next }))}
      loading={pages.turning}
      className={className}
      itemClass="py-0.5"
      renderEmpty={() => <Empty title={t(`empty.${category}`)} size="sm" />}
    >
      {({ item }) => (
        <InPageLink
          href={inboxPath(locale, { category, page, opened: item.id })}
          prefetch="none"
          aria-current={inbox.opened?.id === item.id ? 'page' : undefined}
          className="hn-interactive hn-state-layer hn-press-none aria-[current=page]:bg-accent-soft relative isolate block rounded-lg px-3 py-2.5"
        >
          <Inline gap="sm" align="start" wrap={false}>
            <Flex align="center" justify="center" className="h-lh w-2 shrink-0">
              {!item.read && <Indicator tone="accent" size="sm" label={t('unread')} />}
            </Flex>
            <Stack gap="none" className="min-w-0 flex-1">
              <Inline gap="sm" align="baseline" justify="between" wrap={false}>
                <Text weight={item.read ? 'normal' : 'semibold'} truncate>
                  {item.title}
                </Text>
                <Text size="xs" tone="faint" className="shrink-0 tabular-nums">
                  {format.dateTime(new Date(item.created), {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </Inline>
              <Text
                size="sm"
                tone="muted"
                className={cn('line-clamp-2', item.read && 'text-faint')}
              >
                {item.excerpt}
              </Text>
            </Stack>
          </Inline>
        </InPageLink>
      )}
    </DataList>
  )
}
