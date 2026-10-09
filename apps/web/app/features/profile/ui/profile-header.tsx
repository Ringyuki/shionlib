import {
  Avatar,
  cn,
  Heading,
  Image,
  Inline,
  Stack,
  Tag,
  Text,
  useImageResolver,
} from '@hina-ui/react'
import { Heart, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { sitePaths } from '~/features/shell'
import { Button } from '~/shared/ui/button'
import type { Profile } from '../profile'

type ProfileHeaderProps = {
  profile: Profile
  own: boolean
}

export function ProfileHeader({ profile, own }: ProfileHeaderProps) {
  const t = useTranslations('profile')
  const locale = useLocale()
  const format = useFormatter()
  const resolveImage = useImageResolver()
  const staged = profile.cover !== null
  const bio = (profile.bio ?? '').trim()
  return (
    <Stack as="header" gap="none">
      {profile.cover !== null && (
        <Image
          src={profile.cover}
          alt=""
          fit="cover"
          eager
          className="h-36 w-full rounded-2xl sm:h-52"
        />
      )}
      <Inline
        gap="lg"
        align="start"
        wrap={false}
        className={cn('max-sm:gap-4', staged && 'px-2 sm:px-6')}
      >
        <Avatar
          src={profile.avatar === null ? undefined : resolveImage(profile.avatar, 'image')}
          name={profile.name}
          alt=""
          eager
          className={cn(
            'size-20 text-2xl sm:size-24',
            staged && '-mt-8 ring-4 ring-canvas sm:-mt-10',
          )}
        />
        <Stack gap="sm" className={cn('min-w-0 flex-1', staged && 'pt-3')}>
          <Inline gap="md" align="start" justify="between" wrap={false}>
            <Inline gap="sm" align="center" className="min-w-0">
              <Heading level={1} size="xl" weight="semibold" className="break-all">
                {profile.name}
              </Heading>
              {profile.is_sponsor && (
                <Tag size="sm" tone="accent">
                  <Heart aria-hidden />
                  {t('sponsor')}
                </Tag>
              )}
              {profile.is_admin && (
                <Tag size="sm" variant="outline">
                  <ShieldCheck aria-hidden />
                  {t('admin')}
                </Tag>
              )}
              {profile.is_banned && (
                <Tag size="sm" tone="danger">
                  {t('banned')}
                </Tag>
              )}
            </Inline>
            {own && (
              <Button asChild size="sm" variant="outline" tone="neutral" className="shrink-0">
                <Link to={sitePaths(locale).settings}>{t('edit')}</Link>
              </Button>
            )}
          </Inline>
          {bio !== '' && (
            <Text tone="muted" className="max-w-prose break-words whitespace-pre-line">
              {bio}
            </Text>
          )}
          <Text size="sm" tone="faint">
            {t('joined', {
              date: format.dateTime(new Date(profile.created), { dateStyle: 'long' }),
            })}
          </Text>
        </Stack>
      </Inline>
    </Stack>
  )
}
