import { Inline, Link, Stack, Text, Time } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { commentPath } from '~/features/comment'
import { gamePath, gameTitle } from '~/features/game'
import { profilePath } from '~/features/profile'
import { resourceAnchor } from '~/features/resource'
import { walkthroughPath } from '~/features/walkthrough'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { Happening } from '../activity'

export function HappeningRow({ happening }: { happening: Happening }) {
  const t = useTranslations('activity')
  const locale = useLocale()
  const bytes = useBytes()
  const { user, game } = happening
  const place = gamePath(locale, game.id)
  const target =
    happening.kind === 'resources'
      ? { pathname: place, hash: resourceAnchor(happening.resourceId) }
      : happening.kind === 'comments'
        ? commentPath(locale, game.id, happening.commentId)
        : walkthroughPath(locale, game.id, happening.walkthroughId)
  const linked = (to: Parameters<typeof RouterLink>[0]['to'], label: ReactNode) => (
    <Link asChild>
      <RouterLink to={to} prefetch="intent">
        {label}
      </RouterLink>
    </Link>
  )
  return (
    <Stack gap="xs" className="min-w-0">
      <Text className="break-words">
        {t.rich(`did.${happening.kind}`, {
          user: () => linked(profilePath(locale, user.id), user.name),
          game: () =>
            linked(happening.kind === 'walkthroughs' ? place : target, gameTitle(game, locale)),
          guide: chunks => linked(target, chunks),
        })}
      </Text>
      {happening.kind === 'resources' &&
        happening.files.map(file => (
          <Inline key={file.id} gap="sm" align="baseline" wrap={false} className="min-w-0">
            <Text size="sm" tone="muted" truncate>
              {file.file_name}
            </Text>
            <Text size="sm" tone="faint" className="shrink-0 tabular-nums">
              {bytes(file.file_size)}
            </Text>
          </Inline>
        ))}
      <Text size="sm" tone="faint">
        <Time value={happening.created} format="relative" />
      </Text>
    </Stack>
  )
}
