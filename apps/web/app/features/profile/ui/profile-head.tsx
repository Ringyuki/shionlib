import {
  Avatar,
  Flex,
  Heading,
  Image,
  Inline,
  Stack,
  Tag,
  Text,
  useImageResolver,
} from '@hina-ui/react'
import { CalendarDays, PencilLine } from 'lucide-react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { sitePaths } from '~/features/shell'
import { Button } from '~/shared/ui/button'
import type { Profile } from '../profile'

type ProfileHeadProps = {
  profile: Profile
  onEdit?: () => void
}

const avatarOnBanner =
  'ms-4 -mt-10.5 size-21 text-[1.75rem] ring-3 ring-canvas md:ms-0 md:-mt-16.5 md:size-33 md:text-[2.75rem] md:ring-4'

export function ProfileHead({ profile, onEdit }: ProfileHeadProps) {
  const t = useTranslations('profile')
  const format = useFormatter()
  const locale = useLocale()
  const resolveImage = useImageResolver()
  const bio = (profile.bio ?? '').trim()
  return (
    <Stack as="header" gap="none">
      <Stack gap="none" className="px-4 sm:px-6 md:px-0">
        {profile.cover === null ? (
          <Flex aria-hidden className="bg-subtle aspect-3/1 rounded-lg" />
        ) : (
          <Image
            src={profile.cover}
            alt={t('coverOf', { name: profile.name })}
            ratio={3}
            fit="cover"
            eager
            className="rounded-lg"
          />
        )}
      </Stack>
      <Stack gap="none" className="px-4 sm:px-6">
        <Inline align="start" justify="between" wrap={false}>
          <Avatar
            src={profile.avatar === null ? undefined : resolveImage(profile.avatar, 'image')}
            name={profile.name}
            alt={t('avatarOf', { name: profile.name })}
            eager
            className={avatarOnBanner}
          />
          {onEdit !== undefined && (
            <Button
              variant="outline"
              tone="neutral"
              icon={<PencilLine />}
              onClick={onEdit}
              className="mt-3"
            >
              {t('edit.open')}
            </Button>
          )}
        </Inline>
        <Inline gap="sm" align="center" className="mt-3 md:mt-4">
          <Heading level={1} size="xl" weight="semibold" className="break-all">
            {profile.name}
          </Heading>
          {profile.is_admin && <Tag size="sm">{t('admin')}</Tag>}
          {profile.is_sponsor && (
            <Tag asChild size="sm" tone="accent">
              <Link to={sitePaths(locale).sponsor} prefetch="intent">
                {t('sponsor')}
              </Link>
            </Tag>
          )}
          {profile.is_banned && (
            <Tag size="sm" tone="danger">
              {t('banned')}
            </Tag>
          )}
        </Inline>
        {bio !== '' && <Text className="mt-2 break-words whitespace-pre-line">{bio}</Text>}
        <Inline gap="xs" align="center" wrap={false} className="text-faint mt-2">
          <CalendarDays aria-hidden className="size-3.5 shrink-0" />
          <Text size="xs" tone="faint">
            {t('joined', {
              date: format.dateTime(new Date(profile.created), { dateStyle: 'long' }),
            })}
          </Text>
        </Inline>
      </Stack>
    </Stack>
  )
}
