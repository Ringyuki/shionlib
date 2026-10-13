import { Alert, Avatar, Heading, Inline, Stack, Text, Time, useImageResolver } from '@hina-ui/react'
import { Ban as BanIcon, ExternalLink } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { profilePath } from '~/features/profile'
import { Button } from '~/shared/ui/button'
import { banEnd, banned, type UserDetail } from '../admin-user'
import { StatusTag } from './user-tags'

type UserHeadProps = {
  detail: UserDetail
  punishable: boolean
  onBan: () => void
  onUnban: () => void
}

export function UserHead({ detail, punishable, onBan, onUnban }: UserHeadProps) {
  const t = useTranslations('adminUser.head')
  const locale = useLocale()
  const format = useFormatter()
  const resolveImage = useImageResolver()
  const ban = detail.latest_ban
  const until = ban === null ? undefined : banEnd(ban)
  return (
    <Stack gap="md">
      <Inline gap="md" align="center" justify="between">
        <Inline gap="md" align="center" wrap={false} className="min-w-0">
          <Avatar
            size="lg"
            name={detail.name}
            src={detail.avatar === null ? undefined : resolveImage(detail.avatar, 'image')}
            className="size-16 shrink-0 text-xl"
          />
          <Stack gap="xs" className="min-w-0">
            <Inline gap="sm" align="center">
              <Heading level={1} size="xl" className="break-all">
                {detail.name}
              </Heading>
              <StatusTag status={detail.status} />
            </Inline>
            <Text as="span" size="sm" tone="muted">
              {t.rich('facts', {
                id: detail.id,
                seen: String(detail.last_login_at !== null),
                joined: () => <Time value={detail.created} format="date" />,
                last: () => <Time value={detail.last_login_at} format="relative" />,
              })}
            </Text>
          </Stack>
        </Inline>
        <Inline gap="sm" align="center">
          <Button
            as="a"
            href={profilePath(locale, detail.id)}
            target="_blank"
            rel="noreferrer"
            variant="outline"
            tone="neutral"
            icon={<ExternalLink />}
          >
            {t('profile')}
          </Button>
          {!banned(detail) && (
            <Button
              variant="outline"
              tone="danger"
              icon={<BanIcon />}
              disabled={!punishable}
              onClick={onBan}
            >
              {t('ban')}
            </Button>
          )}
        </Inline>
      </Inline>
      <Alert
        tone="danger"
        open={banned(detail)}
        title={
          until === undefined
            ? t('bannedForever')
            : t('bannedUntil', {
                date: format.dateTime(until, { dateStyle: 'long', timeStyle: 'short' }),
              })
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            tone="neutral"
            disabled={!punishable}
            onClick={onUnban}
          >
            {t('unban')}
          </Button>
        }
      >
        {ban !== null && (
          <Text as="span" size="inherit">
            {t.rich('banFacts', {
              by: ban.banned_by?.name ?? t('system'),
              permanent: String(ban.is_permanent),
              days: ban.banned_duration_days ?? 0,
              reason: ban.banned_reason ?? '',
              known: String(ban.banned_reason !== null && ban.banned_reason !== ''),
              time: () => <Time value={ban.banned_at} format="date" />,
            })}
          </Text>
        )}
      </Alert>
    </Stack>
  )
}
