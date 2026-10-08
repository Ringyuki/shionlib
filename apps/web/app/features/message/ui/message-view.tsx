import {
  Avatar,
  Card,
  Empty,
  Heading,
  Inline,
  Link,
  Stack,
  Tag,
  Text,
  useImageResolver,
} from '@hina-ui/react'
import { ArrowLeft, ExternalLink, Mail } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { GameRow } from '~/features/game'
import { keepScroll, sitePaths } from '~/features/shell'
import { Button } from '~/shared/ui/button'
import { categoryOf, inboxPath, linkTarget, type Inbox } from '../message'

type MessageViewProps = {
  inbox: Inbox
  className?: string
}

export function MessageView({ inbox, className }: MessageViewProps) {
  const t = useTranslations('message')
  const locale = useLocale()
  const format = useFormatter()
  const resolveImage = useImageResolver()
  const { opened, category, page } = inbox
  if (opened === null) {
    return (
      <Card className={className}>
        <Empty icon={<Mail />} title={t('choose')} />
      </Card>
    )
  }
  const target = linkTarget(locale, opened)
  const { sender } = opened
  return (
    <Card as="article" aria-labelledby="opened-message" className={className}>
      <Stack gap="md">
        <Button asChild size="sm" variant="ghost" tone="neutral" className="self-start lg:hidden">
          <RouterLink
            to={inboxPath(locale, { category, page })}
            state={keepScroll}
            preventScrollReset
          >
            <ArrowLeft aria-hidden />
            {t('back')}
          </RouterLink>
        </Button>
        <Stack gap="sm">
          <Heading
            id="opened-message"
            level={2}
            size="lg"
            weight="semibold"
            className="break-words"
          >
            {opened.title}
          </Heading>
          <Inline gap="md" align="center">
            <Tag size="sm" variant="outline">
              {t(`category.${categoryOf(opened.type)}`)}
            </Tag>
            {sender !== null && (
              <Link asChild tone="neutral">
                <RouterLink to={sitePaths(locale).profile(sender.id)}>
                  <Inline as="span" gap="xs" align="center" wrap={false}>
                    <Avatar
                      size="sm"
                      name={sender.name}
                      src={
                        sender.avatar === null ? undefined : resolveImage(sender.avatar, 'image')
                      }
                    />
                    {sender.name}
                  </Inline>
                </RouterLink>
              </Link>
            )}
            <Text size="sm" tone="muted" className="tabular-nums">
              {format.dateTime(new Date(opened.created), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          </Inline>
        </Stack>
        <Text className="max-w-prose break-words whitespace-pre-line">{opened.content}</Text>
        {opened.game !== null && <GameRow game={opened.game} />}
        {target !== undefined && opened.link_text !== null && (
          <Inline>
            {target.external ? (
              <Link href={target.href} target="_blank" rel="noreferrer">
                <Inline as="span" gap="xs" align="center" wrap={false}>
                  {opened.link_text}
                  <ExternalLink aria-hidden className="size-3.5" />
                </Inline>
              </Link>
            ) : (
              <Button asChild>
                <RouterLink to={target.href}>{opened.link_text}</RouterLink>
              </Button>
            )}
          </Inline>
        )}
      </Stack>
    </Card>
  )
}
